

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios'); // Keep axios for scheduler call
const mysql = require('mysql');

const app = express();
app.use(bodyParser.json());

// Create a connection pool to your MySQL database
const db = mysql.createPool({
  host: process.env.DB_HOST, // Should be 'database' or 'mysql' in Docker
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10
});

// --- REMOVED THE NEED FOR FACEBOOK_API_URL ---

app.post('/webhook', async (req, res) => {
  // Directly get the full lead data from the request body
  const leadData = req.body;

  // Basic validation
  if (!leadData || !leadData.phone || !leadData.uuid || !leadData.full_name) {
    console.error('Received invalid lead data:', leadData);
    return res.status(400).send('Invalid lead data received.');
  }

  console.log('Received direct lead data via webhook:', leadData);

  try {
    // Split the full name into first name and last name
    const nameParts = leadData.full_name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Retrieve the realtor_id using the UUID provided in the lead data
    db.query(`SELECT realtor_id FROM Realtor WHERE uuid = ?`, [leadData.uuid], async (err, results) => {
      if (err) {
        console.error('Error fetching realtor:', err);
        return res.status(500).send('Database error fetching realtor');
      }
      if (!results || results.length === 0) {
        console.error(`Realtor not found for UUID: ${leadData.uuid}`);
        return res.status(404).send(`Realtor not found for UUID: ${leadData.uuid}`);
      }
      const realtor_id = results[0].realtor_id;
      console.log(`Found realtor_id: ${realtor_id} for UUID: ${leadData.uuid}`);

      // Insert the lead into the Leads table
      const sql = `INSERT INTO Leads (
        realtor_id, first_name, last_name, phone, address, lead_state, home_type, home_built, home_worth,
        sell_time, home_condition, working_with_agent, looking_to_buy, ad_id, tracking_parameters
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        realtor_id=VALUES(realtor_id), first_name=VALUES(first_name), last_name=VALUES(last_name), 
        address=VALUES(address), lead_state=VALUES(lead_state), home_type=VALUES(home_type), 
        home_built=VALUES(home_built), home_worth=VALUES(home_worth), sell_time=VALUES(sell_time), 
        home_condition=VALUES(home_condition), working_with_agent=VALUES(working_with_agent), 
        looking_to_buy=VALUES(looking_to_buy), ad_id=VALUES(ad_id), 
        tracking_parameters=VALUES(tracking_parameters), created_at=NOW()`; // Update if exists

      db.query(sql, [
        realtor_id,
        firstName,
        lastName,
        leadData.phone,
        leadData.address,
        leadData.lead_state,
        leadData.home_type,
        leadData.home_built,
        leadData.home_worth,
        leadData.sell_time,
        leadData.home_condition,
        leadData.working_with_agent,
        leadData.looking_to_buy,
        leadData.ad_id,
        leadData.tracking_parameters,
      ], async (err, result) => {
        if (err) {
          console.error('Error inserting/updating lead:', err);
          return res.status(500).send('Database insert/update error');
        }
        console.log('Inserted/Updated lead for phone:', leadData.phone);

        // Schedule a follow-up message to be sent (e.g., in 2 minutes)
        try {
          const messageText = `Hello ${firstName}! Thank you for your interest in selling your ${leadData.home_type || 'home'}. Would you like to schedule a call to discuss your options?`;

          // Make sure the scheduler service name ('scheduler') is correct
          const schedulerResponse = await axios.post('http://scheduler:3001/schedule', {
            phone: leadData.phone,
            delayMinutes: 2, // Or adjust as needed
            messageType: 'initial_followup',
            messageText: messageText
          });

          console.log('Scheduled follow-up message:', schedulerResponse.data);
          res.send(`Lead processed and follow-up message scheduled for ${leadData.phone}`);
        } catch (scheduleError) {
          console.error('Error scheduling follow-up message:', scheduleError.message);
          // Send success for lead insertion, but note scheduling failure
          res.status(200).send(`Lead processed for ${leadData.phone}, but failed to schedule follow-up message.`);
        }
      });
    });
  } catch (error) {
    console.error('Unexpected error processing webhook:', error);
    res.status(500).send('Internal server error processing lead data');
  }
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Intermediary direct data server listening on port ${PORT}`);
});