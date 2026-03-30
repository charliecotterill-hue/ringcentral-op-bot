const express = require('express');
const { google } = require('googleapis');
const app = express();
app.use(express.json());
 
const PORT = process.env.PORT || 3000;
const INCOMING_WEBHOOK_URL = process.env.INCOMING_WEBHOOK_URL;
const BOT_OWNER_ID = process.env.BOT_OWNER_ID;
const SHEET_ID = process.env.SHEET_ID;
const RC_BOT_TOKEN = process.env.RC_BOT_TOKEN;
 
// Set up Google Sheets authentication
let googleAuth;
try {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  googleAuth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  console.log('Google Sheets auth configured');
} catch (err) {
  console.error('Failed to configure Google auth:', err.message);
}
 
// Detect on site messages
function isOnSiteMessage(text) {
  const normalized = text.toLowerCase().trim();
  return /\bon.?site\b/.test(normalized) ||
    normalized.includes('on location') ||
    normalized.startsWith('arrived');
}
 
// Look up operative name from RingCentral
async function getUserName(personId) {
  if (!RC_BOT_TOKEN) return personId;
  try {
    const response = await fetch(
      `https://platform.ringcentral.com/restapi/v1.0/glip/persons/${personId}`,
      { headers: { Authorization: `Bearer ${RC_BOT_TOKEN}` } }
    );
    if (response.ok) {
      const data = await response.json();
      return `${data.firstName || ''} ${data.lastName || ''}`.trim() || personId;
    }
  } catch (err) {
    console.error('Failed to get user name:', err.message);
  }
  return personId;
}
 
// Look up channel/site name from RingCentral
async function getChannelName(groupId) {
  if (!RC_BOT_TOKEN) return groupId;
  try {
    const response = await fetch(
      `https://platform.ringcentral.com/restapi/v1.0/glip/groups/${groupId}`,
      { headers: { Authorization: `Bearer ${RC_BOT_TOKEN}` } }
    );
    if (response.ok) {
      const data = await response.json();
      return data.name || groupId;
    }
  } catch (err) {
    console.error('Failed to get channel name:', err.message);
  }
  return groupId;
}
 
// Log check-in to Google Sheets
async function logOnSite(name, site, time, date) {
  if (!googleAuth || !SHEET_ID) {
    console.error('Google Sheets not configured');
    return;
  }
  try {
    const sheets = google.sheets({ version: 'v4', auth: googleAuth });
 
    // Check if it's a new day — if so, clear previous data
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A2',
    });
    const firstDate = existing.data.values?.[0]?.[0];
    if (firstDate && firstDate !== date) {
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SHEET_ID,
        range: 'Sheet1!A2:Z1000',
      });
      console.log('New day detected — cleared previous entries');
    }
 
    // Append the new check-in row
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A:D',
      valueInputOption: 'RAW',
      resource: { values: [[date, time, name, site]] },
    });
    console.log(`Logged: ${name} at ${site} (${time})`);
  } catch (err) {
    console.error('Failed to log to Google Sheets:', err.message);
  }
}
 
app.get('/', (req, res) => res.send('Bot is running'));
 
app.post('/webhook', async (req, res) => {
  const validationToken = req.headers['validation-token'];
  if (validationToken) {
    console.log('Validation received');
    res.setHeader('Validation-Token', validationToken);
    return res.status(200).send();
  }
 
  const event = req.body;
 
  if (event && event.body && event.body.text !== undefined) {
    const text = event.body.text;
    const creatorId = event.body.creatorId;
    const groupId = event.body.groupId;
 
    // Ignore the bot's own messages
    if (BOT_OWNER_ID && creatorId === BOT_OWNER_ID) {
      return res.status(200).send();
    }
 
    // Ignore messages from incoming webhooks (they start with a checkmark)
    if (text && text.trim().startsWith('✅')) {
      return res.status(200).send();
    }
 
    if (text && text.trim()) {
      const cleanText = text.trim();
 
      if (isOnSiteMessage(cleanText)) {
        const now = new Date();
        const date = now.toLocaleDateString('en-GB');
        const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
 
        // Look up name and site in parallel
        const [name, site] = await Promise.all([
          getUserName(creatorId),
          getChannelName(groupId),
        ]);
 
        // Log to Google Sheets
        await logOnSite(name, site, time, date);
 
        // Send confirmation — no trigger words to avoid loops
        await sendMessage(`✅ Check-in recorded for ${name} at ${time}`);
      }
    }
  }
 
  res.status(200).send();
});
 
async function sendMessage(text) {
  if (!INCOMING_WEBHOOK_URL) return;
  try {
    const response = await fetch(INCOMING_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) console.error('Send failed:', await response.text());
    else console.log('Message sent!');
  } catch (err) {
    console.error('Error sending message:', err.message);
  }
}
 
app.listen(PORT, () => console.log(`Bot running on port ${PORT}`));
