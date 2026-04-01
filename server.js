const express = require('express');
const { google } = require('googleapis');
const app = express();
app.use(express.json());
 
const PORT = process.env.PORT || 3000;
const INCOMING_WEBHOOK_URL = process.env.INCOMING_WEBHOOK_URL;
const BOT_OWNER_ID = process.env.BOT_OWNER_ID;
const SHEET_ID = process.env.SHEET_ID;
const TRACKER_SHEET_ID = process.env.TRACKER_SHEET_ID;
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
 
// In-memory store for pending site confirmations
const pendingConfirmations = {};
 
// Detect on site messages
function isOnSiteMessage(text) {
  const normalized = text.toLowerCase().trim();
  return /\bon.?site\b/.test(normalized) ||
    normalized.includes('on location') ||
    normalized.startsWith('arrived');
}
 
// Detect off site messages
function isOffSiteMessage(text) {
  const normalized = text.toLowerCase().trim();
  return /\boff.?site\b/.test(normalized) ||
    normalized.includes('left site') ||
    normalized.includes('leaving') ||
    normalized.startsWith('heading off') ||
    normalized.startsWith('heading out') ||
    normalized.includes('job done') ||
    normalized.includes('all done');
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
      return `${data.firstName || ''}`.trim() || personId;
    }
  } catch (err) {
    console.error('Failed to get user name:', err.message);
  }
  return personId;
}
 
// Look up scanner's assignments for today from the Scanning Dashboard
async function getScannersAssignments(firstName) {
  if (!googleAuth || !TRACKER_SHEET_ID) return [];
  try {
    const dayOfWeek = new Date().toLocaleDateString('en-GB', { weekday: 'long' });
    const sheets = google.sheets({ version: 'v4', auth: googleAuth });
 
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: TRACKER_SHEET_ID,
      range: 'Scanning Dashboard!C5:H1000',
    });
 
    const rows = result.data.values || [];
    const assignments = [];
 
    for (const row of rows) {
      const day      = row[1]; // D
      const client   = row[2]; // E
      const site     = row[3]; // F
      const employee = row[4]; // G
      const batch    = row[5]; // H
 
      if (
        day && day.toLowerCase().trim() === dayOfWeek.toLowerCase() &&
        employee && employee.toLowerCase().trim() === firstName.toLowerCase().trim()
      ) {
        assignments.push({ client, site, batch });
      }
    }
 
    console.log(`Found ${assignments.length} assignment(s) for ${firstName} on ${dayOfWeek}`);
    return assignments;
  } catch (err) {
    console.error('Failed to look up assignments:', err.message);
    return [];
  }
}
 
// Log on site check-in to the On Site Google Sheet
async function logOnSite(name, site, batch, time, date) {
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
 
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A:E',
      valueInputOption: 'RAW',
      resource: { values: [[date, time, name, site || '', batch || '', '']] },
    });
    console.log(`Logged on site: ${name} at ${site} (${batch}) — ${time}`);
  } catch (err) {
    console.error('Failed to log to Google Sheets:', err.message);
  }
}
 
// Log off site time in the same row as the on site entry
async function logOffSite(name, site, time, date) {
  if (!googleAuth || !SHEET_ID) {
    console.error('Google Sheets not configured');
    return;
  }
  try {
    const sheets = google.sheets({ version: 'v4', auth: googleAuth });
 
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A2:F1000',
    });
 
    const rows = result.data.values || [];
    let matchRowIndex = -1;
 
    for (let i = 0; i < rows.length; i++) {
      const [rowDate, , rowName, rowSite, , rowTimeOut] = rows[i];
      const siteMatch = site ? rowSite === site : true;
      if (rowDate === date && rowName === name && siteMatch && !rowTimeOut) {
        matchRowIndex = i + 2;
        break;
      }
    }
 
    if (matchRowIndex === -1) {
      console.log(`No matching on site entry for ${name} today`);
      return;
    }
 
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Sheet1!F${matchRowIndex}`,
      valueInputOption: 'RAW',
      resource: { values: [[time]] },
    });
    console.log(`Logged off site: ${name} at ${time}`);
  } catch (err) {
    console.error('Failed to log off site:', err.message);
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
 
    // Ignore messages with no sender (e.g. incoming webhook posts from the bot itself)
    if (!creatorId) {
      return res.status(200).send();
    }
 
    // Ignore bot's own messages
    if (BOT_OWNER_ID && creatorId === BOT_OWNER_ID) {
      return res.status(200).send();
    }
 
    // Ignore bot confirmation/question messages
    if (text && (text.trim().startsWith('✅') || text.trim().startsWith('⚠️') || text.trim().startsWith('Hi ') || text.trim().startsWith('Please reply'))) {
      return res.status(200).send();
    }
 
    if (text && text.trim()) {
      const cleanText = text.trim();
      const now = new Date();
      const date = now.toLocaleDateString('en-GB');
      const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
 
      // --- Handle pending site confirmation (scanner replied with a number) ---
      if (pendingConfirmations[creatorId]) {
        const pending = pendingConfirmations[creatorId];
        const choice = parseInt(cleanText);
 
        if (!isNaN(choice) && choice >= 1 && choice <= pending.assignments.length) {
          const selected = pending.assignments[choice - 1];
          delete pendingConfirmations[creatorId];
 
          if (pending.type === 'onsite') {
            await logOnSite(pending.name, selected.site, selected.batch, pending.time, pending.date);
            await sendMessage(`✅ Check-in recorded for ${pending.name} at ${selected.site} (${selected.batch}) at ${pending.time}`);
          } else {
            await logOffSite(pending.name, selected.site, pending.time, pending.date);
            await sendMessage(`✅ Check-out recorded for ${pending.name} at ${selected.site} at ${pending.time}`);
          }
        } else {
          await sendMessage(`Please reply with a number between 1 and ${pending.assignments.length}.`);
        }
 
        return res.status(200).send();
      }
 
      // --- Handle on site messages ---
      if (isOnSiteMessage(cleanText)) {
        const name = await getUserName(creatorId);
        const assignments = await getScannersAssignments(name);
 
        if (assignments.length === 0) {
          await sendMessage(`⚠️ Hi ${name}, I couldn't find your schedule for today. Please contact your ops team.`);
        } else if (assignments.length === 1) {
          const { site, batch } = assignments[0];
          await logOnSite(name, site, batch, time, date);
          await sendMessage(`✅ Check-in recorded for ${name} at ${site} (${batch}) at ${time}`);
        } else {
          // Multiple sites — ask which one
          pendingConfirmations[creatorId] = { type: 'onsite', assignments, name, time, date };
          const list = assignments.map((a, i) => `${i + 1}. ${a.site} — ${a.batch}`).join('\n');
          await sendMessage(`Hi ${name}, you're scheduled at multiple sites today:\n${list}\nPlease reply with the number of the site you're arriving at.`);
        }
 
      // --- Handle off site messages ---
      } else if (isOffSiteMessage(cleanText)) {
        const name = await getUserName(creatorId);
        const assignments = await getScannersAssignments(name);
 
        if (assignments.length === 0) {
          await sendMessage(`⚠️ Hi ${name}, I couldn't find your schedule for today. Please contact your ops team.`);
        } else if (assignments.length === 1) {
          const { site } = assignments[0];
          await logOffSite(name, site, time, date);
          await sendMessage(`✅ Check-out recorded for ${name} at ${site} at ${time}`);
        } else {
          // Multiple sites — ask which one they're leaving
          pendingConfirmations[creatorId] = { type: 'offsite', assignments, name, time, date };
          const list = assignments.map((a, i) => `${i + 1}. ${a.site} — ${a.batch}`).join('\n');
          await sendMessage(`Hi ${name}, you're scheduled at multiple sites today:\n${list}\nPlease reply with the number of the site you're leaving.`);
        }
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
