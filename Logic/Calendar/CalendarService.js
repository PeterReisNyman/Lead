const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const moment = require('moment');
const config = require('./config');

const app = express();
app.use(bodyParser.json());

// Create Google Calendar API client
const auth = new google.auth.GoogleAuth({
  credentials: config.google,
  scopes: ['https://www.googleapis.com/auth/calendar']
});

let calendar;

// Initialize Google Calendar API
async function initializeCalendar() {
  try {
    const authClient = await auth.getClient();
    calendar = google.calendar({ version: 'v3', auth: authClient });
    console.log('Google Calendar API initialized successfully');
  } catch (error) {
    console.error('Error initializing Google Calendar API:', error);
  }
}

// Initialize the calendar when the service starts
initializeCalendar();

// Endpoint to create a calendar event
app.post('/create-event', async (req, res) => {
  const { 
    fullName, 
    phone, 
    date, 
    time, 
    realtorName,
    timeZone = 'America/Los_Angeles' // Default timezone
  } = req.body;
  
  if (!fullName || !phone || !date || !time || !realtorName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  console.log(`Creating calendar event for ${fullName} with ${realtorName} on ${date} at ${time}`);

  try {
    if (!calendar) {
      await initializeCalendar();
      if (!calendar) {
        throw new Error('Calendar API not initialized');
      }
    }
    
    // Parse date and time to create DateTime objects
    // Format for time should be "HH:MM" (24-hour format)
    const startDateTime = moment(`${date}T${time}`);
    // Create a 5-minute appointment slot
    const endDateTime = moment(startDateTime).add(5, 'minutes');
    
    // Create event object
    const event = {
      summary: `Appointment with ${realtorName}`,
      description: `${fullName} has booked a meeting with ${realtorName}\nPhone Number: ${phone}`,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: timeZone,
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: timeZone,
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day email reminder
          { method: 'popup', minutes: 30 }, // 30 minute popup reminder
        ],
      },
    };
    
    console.log('Submitting event to Google Calendar:', {
      start: event.start.dateTime,
      end: event.end.dateTime,
      summary: event.summary
    });
    
    // Insert the event
    const response = await calendar.events.insert({
      calendarId: config.calendarId,
      resource: event,
    });
    
    console.log('Event created successfully:', response.data.htmlLink);
    res.json({ 
      success: true, 
      eventId: response.data.id,
      eventLink: response.data.htmlLink
    });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    res.status(500).json({ 
      error: 'Failed to create calendar event', 
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'calendar' });
});

// Start the server
const PORT = config.port;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Calendar service running on port ${PORT}`);
});