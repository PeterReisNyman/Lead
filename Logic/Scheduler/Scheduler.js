const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const cron = require('node-cron');
const axios = require('axios');
const { OpenAI } = require('openai');
const REMINDER_DELAY_MINUTES = 5; // TODO: Change this to 24 * 60 for production (24 hours)

const app = express();
app.use(bodyParser.json());

// Create a connection pool to MySQL database
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Connection check when app starts
function checkDatabaseConnection() {
  db.query('SELECT 1', (err) => {
    if (err) {
      console.error('Error connecting to database:', err);
      return;
    }
    console.log('Database connection successful');
  });
}

// Check database connection when app starts
checkDatabaseConnection();

// Endpoint to schedule a follow-up message
app.post('/schedule', async (req, res) => {
  const { phone, messageType = 'initial_followup', messageText } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  // 1. Cancel any previous pending scheduled reminder for this phone
  await new Promise((resolve, reject) => {
    const cancelSql = `UPDATE scheduled_messages SET message_status = 'canceled' WHERE phone = ? AND message_status = 'pending'`;
    db.query(cancelSql, [phone], (err) => {
      if (err) {
        console.error('Error canceling previous scheduled messages:', err);
        return reject(err);
      }
      resolve();
    });
  });

  // 2. Prevent scheduling if a reminder has already been sent
  const alreadySent = await new Promise((resolve, reject) => {
    const checkSql = `SELECT COUNT(*) as cnt FROM scheduled_messages WHERE phone = ? AND message_status = 'sent' AND message_type = 'reminder'`;
    db.query(checkSql, [phone], (err, results) => {
      if (err) {
        console.error('Error checking sent reminders:', err);
        return reject(err);
      }
      resolve(results[0].cnt > 0);
    });
  });
  if (alreadySent) {
    return res.status(409).json({ error: 'A reminder has already been sent to this number.' });
  }

  // 3. Schedule new reminder
  const scheduledTime = new Date();
  scheduledTime.setMinutes(scheduledTime.getMinutes() + REMINDER_DELAY_MINUTES);

  const sql = `
    INSERT INTO scheduled_messages 
      (phone, scheduled_time, message_type, message_text) 
    VALUES (?, ?, ?, ?)
  `;

  db.query(sql, [
    phone, 
    scheduledTime, 
    messageType === 'reminder' ? 'reminder' : messageType,
    messageText || `Hello! Thanks for your interest. Would you like to schedule a call?`
  ], (err, result) => {
    if (err) {
      console.error('Error scheduling message:', err);
      return res.status(500).json({ error: 'Failed to schedule message' });
    }
    console.log(`Message scheduled for ${phone} at ${scheduledTime.toISOString()}`);
    res.json({ 
      success: true, 
      id: result.insertId,
      scheduledTime: scheduledTime
    });
  });
});

// Endpoint to schedule an AI-generated follow-up message
app.post('/schedule-ai-followup', async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  // 1. Cancel any previous pending scheduled reminder for this phone
  await new Promise((resolve, reject) => {
    const cancelSql = `UPDATE scheduled_messages SET message_status = 'canceled' WHERE phone = ? AND message_status = 'pending'`;
    db.query(cancelSql, [phone], (err) => {
      if (err) {
        console.error('Error canceling previous scheduled messages:', err);
        return reject(err);
      }
      resolve();
    });
  });

  // 2. Prevent scheduling if a reminder has already been sent
  const alreadySent = await new Promise((resolve, reject) => {
    const checkSql = `SELECT COUNT(*) as cnt FROM scheduled_messages WHERE phone = ? AND message_status = 'sent' AND message_type = 'reminder'`;
    db.query(checkSql, [phone], (err, results) => {
      if (err) {
        console.error('Error checking sent reminders:', err);
        return reject(err);
      }
      resolve(results[0].cnt > 0);
    });
  });
  if (alreadySent) {
    return res.status(409).json({ error: 'A reminder has already been sent to this number.' });
  }

  try {
    // Get lead information and conversation history
    const leadInfo = await getLeadInfo(phone);
    const conversationHistory = await getConversationHistory(phone);

    // Generate a personalized follow-up using AI
    const systemMessage = `You are an AI assistant for a real estate company. 
    Generate a brief, friendly follow-up message to a lead who is considering selling their home.

    Lead information:
    - Name: ${leadInfo.firstName} ${leadInfo.lastName}
    - Home Type: ${leadInfo.homeType || 'home'}
    - Selling Timeline: ${leadInfo.sellTime || 'unknown'}

    Your goal is to encourage them to schedule a home evaluation appointment with Realtor ${leadInfo.realtorName}.
    Keep the message short (max 2 sentences).`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemMessage },
        ...conversationHistory.slice(-3) // Include last 3 messages for context
      ]
    });

    const followUpMessage = completion.choices[0].message.content;

    // Calculate scheduled time
    const scheduledTime = new Date();
    scheduledTime.setMinutes(scheduledTime.getMinutes() + REMINDER_DELAY_MINUTES);

    const sql = `
      INSERT INTO scheduled_messages 
        (phone, scheduled_time, message_type, message_text) 
      VALUES (?, ?, ?, ?)
    `;

    db.query(sql, [
      phone, 
      scheduledTime, 
      'reminder', // treat all reminders as 'reminder' for tracking
      followUpMessage
    ], (err, result) => {
      if (err) {
        console.error('Error scheduling AI follow-up message:', err);
        return res.status(500).json({ error: 'Failed to schedule follow-up message' });
      }
      
      console.log(`AI follow-up message scheduled for ${phone} at ${scheduledTime.toISOString()}`);
      res.json({ 
        success: true, 
        id: result.insertId,
        scheduledTime: scheduledTime,
        message: followUpMessage
      });
    });
  } catch (error) {
    console.error('Error scheduling AI follow-up:', error);
    res.status(500).json({ error: 'Failed to schedule AI follow-up', details: error.message });
  }
});

// Get lead information from the database
function getLeadInfo(phone) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT l.first_name AS firstName, l.last_name AS lastName, l.phone, 
            l.address, l.lead_state AS leadState, l.home_type AS homeType,
            l.home_built AS homeBuilt, l.home_worth AS homeWorth, 
            l.sell_time AS sellTime, l.home_condition AS homeCondition,
            l.working_with_agent AS workingWithAgent, l.looking_to_buy AS lookingToBuy,
            CONCAT(r.f_name, ' ', r.e_name) AS realtorName
      FROM Leads l
      JOIN Realtor r ON l.realtor_id = r.realtor_id
      WHERE l.phone = ?
    `;
    
    db.query(sql, [phone], (err, results) => {
      if (err) {
        console.error('Error fetching lead info:', err);
        return reject(err);
      }
      
      if (results.length === 0) {
        // If lead not found, return default values
        return resolve({
          firstName: "Valued Customer",
          lastName: "",
          phone: phone,
          address: "",
          leadState: "Warm",
          homeType: "",
          homeBuilt: "",
          homeWorth: "",
          sellTime: "",
          homeCondition: "",
          workingWithAgent: "No",
          lookingToBuy: "Unknown",
          realtorName: "David Lee"
        });
      }
      
      resolve(results[0]);
    });
  });
}

// Get conversation history for a phone number
function getConversationHistory(phone) {
  return new Promise((resolve, reject) => {
    const sql = `SELECT messages_conversation FROM Messages WHERE phone = ?`;
    
    db.query(sql, [phone], (err, results) => {
      if (err) {
        console.error('Error fetching conversation history:', err);
        return reject(err);
      }
      
      if (results.length === 0 || !results[0].messages_conversation) {
        return resolve([]);
      }
      
      try {
        // Parse the JSON conversation history and convert to OpenAI format
        const conversation = JSON.parse(results[0].messages_conversation);
        const formattedConversation = conversation.map(msg => ({
          role: msg.direction === 'inbound' ? 'user' : 'assistant',
          content: msg.text
        }));
        
        resolve(formattedConversation);
      } catch (e) {
        console.error('Error parsing conversation history:', e);
        resolve([]);
      }
    });
  });
}

// Endpoint to cancel scheduled messages for a phone number
app.post('/cancel', (req, res) => {
  const { phone } = req.body;
  
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }
  
  const sql = `
    UPDATE scheduled_messages 
    SET message_status = 'canceled' 
    WHERE phone = ? AND message_status = 'pending'
  `;
  
  db.query(sql, [phone], (err, result) => {
    if (err) {
      console.error('Error canceling scheduled messages:', err);
      return res.status(500).json({ error: 'Failed to cancel scheduled messages' });
    }
    
    console.log(`Canceled ${result.affectedRows} scheduled messages for ${phone}`);
    res.json({ 
      success: true, 
      canceledCount: result.affectedRows 
    });
  });
});

// Check for messages that need to be sent every minute
cron.schedule('* * * * *', () => {
  console.log('Checking for messages to send...');

  const now = new Date();
  const allowedStart = new Date(now);
  allowedStart.setHours(7, 7, 0, 0); // 7:07
  const allowedEnd = new Date(now);
  allowedEnd.setHours(23, 23, 59, 999); // 23:23

  const sql = `
    SELECT id, phone, message_type, message_text 
    FROM scheduled_messages 
    WHERE scheduled_time <= ? 
    AND message_status = 'pending'
    LIMIT 10
  `;

  db.query(sql, [now], async (err, results) => {
    if (err) {
      return console.error('Error checking for scheduled messages:', err);
    }

    if (results.length === 0) {
      return;
    }

    console.log(`Found ${results.length} messages to send`);

    // Process each message
    for (const message of results) {
      try {
        // Only send between 7:07 and 23:23 local time
        if (now < allowedStart || now > allowedEnd) {
          console.log(`Skipping message ${message.id} for ${message.phone} because not in allowed time window.`);
          continue;
        }
        // Mark as being processed
        await markMessageAs(message.id, 'processing');

        // Send the message via the Messenger service
        const response = await axios.post('http://messenger:3000/send', {
          phone: message.phone,
          messageType: message.message_type,
          messageText: message.message_text
        });

        if (response.data.success) {
          await markMessageAs(message.id, 'sent');
          // Update the Leads table to reflect that a reminder was sent
          db.query(
            "UPDATE Leads SET sent_schedule_reminder = 'Yes' WHERE phone = ?",
            [message.phone],
            (err) => {
              if (err) {
                console.error(`Error updating sent_schedule_reminder for ${message.phone}:`, err);
              }
            }
          );
          console.log(`Message ${message.id} sent to ${message.phone}`);
        } else {
          await markMessageAs(message.id, 'failed');
          console.error(`Failed to send message ${message.id}: ${response.data.error}`);
        }
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        await markMessageAs(message.id, 'failed');
      }
    }
  });
});

// Helper function to update message status
function markMessageAs(id, status) {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE scheduled_messages SET message_status = ? WHERE id = ?`;
    db.query(sql, [status, id], (err) => {
      if (err) {
        console.error(`Error updating message ${id} status to ${status}:`, err);
        return reject(err);
      }
      resolve();
    });
  });
}

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Scheduler service running on port ${PORT}`);
});