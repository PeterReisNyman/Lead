// Configuration for the Calendar Service
// This file should be properly secured in production environments

require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3002,
  google: {
    type: "service_account",
    project_id: process.env.GOOGLE_PROJECT_ID || "sound-coil-455613-q9",
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : "",
    client_email: process.env.GOOGLE_CLIENT_EMAIL || "customers-booking-account@sound-coil-455613-q9.iam.gserviceaccount.com",
    client_id: process.env.GOOGLE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL,
    universe_domain: "googleapis.com"
  },
  calendarId: process.env.CALENDAR_ID || 'primary'
};