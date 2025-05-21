const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const twilio = require('twilio');
const { OpenAI } = require('openai');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // For Twilio webhook

// Create a connection pool to MySQL database
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, 
  database: process.env.DB_NAME,
  connectionLimit: 10
});

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

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

// Endpoint to send a message
app.post('/send', async (req, res) => {
  const { phone, messageType, messageText } = req.body;
  
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }
  
  try {
    // Send message via Twilio
    const twilioResponse = await twilioClient.messages.create({
      body: messageText,
      from: twilioPhoneNumber,
      to: phone
    });
    
    console.log('==================================================');
    console.log(`SENT MESSAGE TO: ${phone}`);
    console.log(`MESSAGE TYPE: ${messageType}`);
    console.log(`MESSAGE CONTENT: ${messageText}`);
    console.log(`TWILIO SID: ${twilioResponse.sid}`);
    console.log('==================================================');
    
    // Store the message in the logs
    const sql = `
      INSERT INTO message_logs 
        (phone, message_type, message_text) 
      VALUES (?, ?, ?)
    `;
    
    db.query(sql, [phone, messageType, messageText], (err, result) => {
      if (err) {
        console.error('Error logging message:', err);
        return res.status(500).json({ error: 'Failed to log message' });
      }
      
      res.json({ 
        success: true, 
        id: result.insertId,
        twilioSid: twilioResponse.sid,
        message: 'Message sent successfully'
      });
    });
    
    // Update the Messages table with conversation
    updateMessagesTable(phone, messageText, 'outbound');
  } catch (error) {
    console.error('Error sending Twilio message:', error);
    res.status(500).json({ 
      error: 'Failed to send message', 
      details: error.message 
    });
  }
});

// Twilio webhook for incoming messages
app.post('/webhook/twilio', async (req, res) => {
  const incomingMessage = req.body.Body;
  const fromPhone = req.body.From;
  
  console.log('==================================================');
  console.log(`RECEIVED MESSAGE FROM: ${fromPhone}`);
  console.log(`MESSAGE CONTENT: ${incomingMessage}`);
  console.log('==================================================');
  
  // Store the incoming message
  updateMessagesTable(fromPhone, incomingMessage, 'inbound');
  
  try {
    // Process the message with AI and get a response
    const aiResponse = await processMessageWithAI(fromPhone, incomingMessage);
    
    // Send the AI response back to the user
    await twilioClient.messages.create({
      body: aiResponse.message,
      from: twilioPhoneNumber,
      to: fromPhone
    });
    
    // Store the outgoing message
    updateMessagesTable(fromPhone, aiResponse.message, 'outbound');
    
    // Log the outgoing message
    const logSql = `
      INSERT INTO message_logs 
        (phone, message_type, message_text) 
      VALUES (?, ?, ?)
    `;
    
    db.query(logSql, [fromPhone, 'ai_response', aiResponse.message]);
    
    // Schedule a follow-up message (3 minutes later)
    if (aiResponse.scheduleFollowUp) {
      axios.post('http://scheduler:3001/schedule', {
        phone: fromPhone,
        messageType: 'ai_followup',
        messageText: 'Just checking in - do you have any other questions about selling your home or scheduling an evaluation appointment?'
      }).catch(error => {
        console.error('Error scheduling follow-up message:', error);
      });
    }
    
    // Send an empty response to Twilio
    res.status(200).type('text/xml').send('<Response></Response>');
    // res.set('Content-Type', 'text/xml');
    // res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  } catch (error) {
    console.error('Error processing incoming message:', error);
    res.status(500).type('text/xml').send('<Response></Response>');
  }
});

// Process a message with AI
async function processMessageWithAI(phone, message) {
  // Get lead information from the database
  const leadInfo = await getLeadInfo(phone);
  
  // Get conversation history
  const conversationHistory = await getConversationHistory(phone);
  
  // Prepare system message with context
  let systemMessage = `You are an AI assistant for a real estate company. Your goal is to help schedule appointments between leads and realtors for house evaluations. 
  
  Here's information about the lead you're talking to:
  - Name: ${leadInfo.firstName} ${leadInfo.lastName}
  - Phone: ${leadInfo.phone}
  - Address: ${leadInfo.address}
  - Lead State: ${leadInfo.leadState}
  - Home Type: ${leadInfo.homeType}
  - Home Built: ${leadInfo.homeBuilt}
  - Home Worth: ${leadInfo.homeWorth}
  - Sell Time: ${leadInfo.sellTime}
  - Home Condition: ${leadInfo.homeCondition}
  - Working with Agent: ${leadInfo.workingWithAgent}
  - Looking to Buy: ${leadInfo.lookingToBuy}
  
  You're representing realtor ${leadInfo.realtorName} who can provide a professional home evaluation.
  
  Your primary goals are:
  1. Be helpful and professional
  2. Guide the lead to schedule an in-person appointment for a home evaluation
  3. Answer questions about the selling process
  4. If they want to schedule or reschedule a meeting, help them do so by explaining they can visit the booking page
  
  Keep your responses concise and friendly. Don't mention that you're an AI unless directly asked.`;
  
  // Build the messages array for the API call
  const messages = [
    { role: "system", content: systemMessage }
  ];
  
  // Add conversation history
  conversationHistory.forEach(msg => {
    messages.push(msg);
  });
  
  // Add the current message
  messages.push({ role: "user", content: message });
  
  // Call the OpenAI API
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: messages
  });
  
  const aiResponse = completion.choices[0].message.content;
  
  // Determine if we should schedule a follow-up
  const scheduleFollowUp = !aiResponse.toLowerCase().includes("appointment scheduled") && 
                          !aiResponse.toLowerCase().includes("goodbye") &&
                          !aiResponse.toLowerCase().includes("talk to you later");
  
  return {
    message: aiResponse,
    scheduleFollowUp: scheduleFollowUp
  };
}

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
        
        // Limit to last 10 messages to avoid context length issues
        const lastMessages = formattedConversation.slice(-10);
        resolve(lastMessages);
      } catch (e) {
        console.error('Error parsing conversation history:', e);
        resolve([]);
      }
    });
  });
}

// Helper function to update the Messages table with conversation
function updateMessagesTable(phone, messageText, direction) {
  // First check if the phone already has a messages entry
  const checkSql = `SELECT * FROM Messages WHERE phone = ?`;
  
  db.query(checkSql, [phone], (err, results) => {
    if (err) {
      return console.error('Error checking Messages table:', err);
    }
    
    const timestamp = new Date().toISOString();
    const messageObj = {
      text: messageText,
      timestamp: timestamp,
      direction: direction
    };
    
    if (results.length === 0) {
      // No existing record, create a new one
      const insertSql = `
        INSERT INTO Messages (phone, messages_conversation) 
        VALUES (?, ?)
      `;
      
      const conversation = JSON.stringify([messageObj]);
      db.query(insertSql, [phone, conversation], (err) => {
        if (err) {
          console.error('Error creating message conversation:', err);
        }
      });
    } else {
      // Update existing record
      try {
        let currentConversation = [];
        if (results[0].messages_conversation) {
          currentConversation = JSON.parse(results[0].messages_conversation);
        }
        
        currentConversation.push(messageObj);
        
        const updateSql = `
          UPDATE Messages 
          SET messages_conversation = ? 
          WHERE phone = ?
        `;
        
        db.query(updateSql, [JSON.stringify(currentConversation), phone], (err) => {
          if (err) {
            console.error('Error updating message conversation:', err);
          }
        });
      } catch (e) {
        console.error('Error parsing existing conversation:', e);
      }
    }
  });
}

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Messenger service running on port ${PORT}`);
});