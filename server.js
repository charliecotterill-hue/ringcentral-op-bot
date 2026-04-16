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
 
// Levenshtein distance — counts the minimum edits (insert, delete, substitute) to turn a into b
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
 
// Returns true if any single word in text is within maxDist edits of target
function fuzzyWord(text, target, maxDist = 1) {
  return text.split(/\s+/).some(w => levenshtein(w, target) <= maxDist);
}
 
// Returns true if any consecutive sequence of words in text is within maxDist edits of phrase
function fuzzyPhrase(text, phrase, maxDist = 1) {
  const words = text.split(/\s+/);
  const phraseLen = phrase.split(/\s+/).length;
  for (let i = 0; i <= words.length - phraseLen; i++) {
    const chunk = words.slice(i, i + phraseLen).join(' ');
    if (levenshtein(chunk, phrase) <= maxDist) return true;
  }
  return false;
}
 
// Detect on site messages
function isOnSiteMessage(text) {
  const t = text.toLowerCase().trim();
 
  // on site / onsite / on-site / on sight / on sit (common typos)
  if (/\bon.?si(te?|ght)\b/.test(t)) return true;
 
  // at site / at the site
  if (/\bat\s+(the\s+)?site\b/.test(t)) return true;
 
  // clock in / clocking in / clocked in / clockin
  if (/\bcloc?k(ed|ing)?\s*in\b/.test(t)) return true;
 
  // arrived / arriving / arived / ariving / arrvied and similar misspellings
  if (/\barri?v+(ed|ing|es)?\b/.test(t)) return true;
 
  // "here" or "her" (typo) only when the entire message is just that word
  if (t === 'here' || t === 'her' || t === 'here now') return true;
 
  // arriving now / arriving on site etc.
  if (/\barriv(ing|al)\b/.test(t)) return true;
 
  // catch-all phrase list — matches anywhere in the message
  const onPhrases = [
    'on location', 'on-location',
    "i'm here", "im here", "i am here",
    'here now', 'just got here', 'just got in',
    'just got to', 'made it', 'just made it',
    'starting now', 'just starting', 'ready to start', 'starting up',
    'just pulled up', 'pulling up',
  ];
  if (onPhrases.some(p => t.includes(p))) return true;
 
  // Fuzzy matches — catches any of the key trigger words/phrases with one character off
  if (fuzzyPhrase(t, 'on site'))     return true;
  if (fuzzyPhrase(t, 'at site'))     return true;
  if (fuzzyPhrase(t, 'clock in'))    return true;
  if (fuzzyPhrase(t, 'clocking in')) return true;
  if (fuzzyWord(t,   'arrived'))     return true;
  if (fuzzyWord(t,   'arriving'))    return true;
  if (fuzzyPhrase(t, 'on location')) return true;
  if (fuzzyPhrase(t, 'here now'))    return true;
 
  return false;
}
 
// Detect off site messages
function isOffSiteMessage(text) {
  const t = text.toLowerCase().trim();
 
  // off site / offsite / off-site / off sight / off sit (common typos)
  if (/\boff.?si(te?|ght)\b/.test(t)) return true;
 
  // clock out / clocking out / clocked out / clockout
  if (/\bcloc?k(ed|ing)?\s*out\b/.test(t)) return true;
 
  // leaving / leavin (typo)
  if (/\bleav(ing|in)\b/.test(t)) return true;
 
  // finished / finsihed / finshed / fnished and similar misspellings
  if (/\bfin+is?h(ed|ing)?\b/.test(t)) return true;
 
  // heading off / heading out / headin off / headng out
  if (/\bheadin+g?\s+(off|out)\b/.test(t)) return true;
 
  // catch-all phrase list — matches anywhere in the message
  const offPhrases = [
    'left site', 'left the site',
    'leaving now', 'just leaving',
    'job done', 'all done', 'all done here',
    'all finished', 'just finished', 'now finished',
    'wrapped up', 'just wrapped', 'all wrapped',
    'on my way', 'on my way back', 'on my way home',
    'done for the day', 'done here', 'done now',
    'left now', 'just left',
    "i'm off", "im off", 'i am off',
    "that's me done", 'thats me done',
    "that's me off", 'thats me off',
    "that's me", 'thats me',
    'signing off', 'sign off',
    'heading home', 'going home',
  ];
  if (offPhrases.some(p => t.includes(p))) return true;
 
  // Fuzzy matches — catches any of the key trigger words/phrases with one character off
  if (fuzzyPhrase(t, 'off site'))     return true;
  if (fuzzyPhrase(t, 'left site'))    return true;
  if (fuzzyPhrase(t, 'heading off'))  return true;
  if (fuzzyPhrase(t, 'heading out'))  return true;
  if (fuzzyPhrase(t, 'job done'))     return true;
  if (fuzzyPhrase(t, 'all done'))     return true;
  if (fuzzyPhrase(t, 'clock out'))    return true;
  if (fuzzyPhrase(t, 'clocking out')) return true;
  if (fuzzyWord(t,   'leaving'))      return true;
  if (fuzzyWord(t,   'finished'))     return true;
  if (fuzzyWord(t,   'wrapped'))      return true;
 
  return false;
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
    const dayOfWeek = new Date().toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'Europe/London' });
    const sheets = google.sheets({ version: 'v4', auth: googleAuth });
 
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: TRACKER_SHEET_ID,
      range: 'Scanning Dashboard!C5:H1000',
    });
 
    const rows = result.data.values || [];
    const assignments = [];
 
    for (let i = 0; i < rows.length; i++) {
      const row      = rows[i];
      const day      = row[1]; // D
      const client   = row[2]; // E
      const site     = row[3]; // F
      const employee = row[4]; // G
      const batch    = row[5]; // H
 
      if (
        day && day.toLowerCase().trim() === dayOfWeek.toLowerCase() &&
        employee && employee.toLowerCase().trim() === firstName.toLowerCase().trim()
      ) {
        // Row 5 is the first data row (index 0 → sheet row 5)
        console.log(`Match found — row ${i + 5}: day=${day}, employee=${employee}, site=${site}, batch=${batch}`);
        assignments.push({ client: client || '', site: site || '', batch: batch || '', rowNumber: i + 5 });
      }
    }
 
    console.log(`Found ${assignments.length} assignment(s) for ${firstName} on ${dayOfWeek}`);
    return assignments;
  } catch (err) {
    console.error('Failed to look up assignments:', err.message);
    return [];
  }
}
 
// Tick a checkbox (TRUE) in the Scanning Dashboard for the given row and column letter
async function tickCheckbox(rowNumber, col) {
  if (!googleAuth || !TRACKER_SHEET_ID) return;
  try {
    const sheets = google.sheets({ version: 'v4', auth: googleAuth });
    await sheets.spreadsheets.values.update({
      spreadsheetId: TRACKER_SHEET_ID,
      range: `Scanning Dashboard!${col}${rowNumber}`,
      valueInputOption: 'RAW',
      resource: { values: [[true]] },
    });
    console.log(`Ticked checkbox at ${col}${rowNumber}`);
  } catch (err) {
    console.error(`Failed to tick checkbox at ${col}${rowNumber}:`, err.message);
  }
}
 
// Calculate hours and minutes between two HH:MM time strings
function calcDuration(timeIn, timeOut) {
  const [inH, inM]   = timeIn.split(':').map(Number);
  const [outH, outM] = timeOut.split(':').map(Number);
  const diffMins = (outH * 60 + outM) - (inH * 60 + inM);
  if (diffMins <= 0) return '—';
  const hours = Math.floor(diffMins / 60);
  const mins  = diffMins % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}
 
// Append a check-in row to the Archive tab, inserting a two-row gap when the date changes
async function logArchiveCheckIn(name, site, time, date) {
  if (!googleAuth || !SHEET_ID) return;
  try {
    const sheets = google.sheets({ version: 'v4', auth: googleAuth });
 
    // Read existing archive data (A:F — column F stores the actual sheet row number as a helper)
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Archive!A:M',
    });
    const rows = existing.data.values || [];
 
    // Find the last data row by scanning backwards, skipping header (index 0)
    let lastDate = null;
    let lastSheetRow = 1; // default to header row (sheet row 1)
 
    for (let i = rows.length - 1; i >= 1; i--) {
      const row = rows[i];
      // Look for a row with an operative name in column C (index 2)
      if (row && row[2] && String(row[2]).trim()) {
        if (row[0]) lastDate = String(row[0]).trim();
        // Column F (index 5) holds the actual sheet row number written at check-in time
        if (row[12] && !isNaN(parseInt(row[12]))) {
          lastSheetRow = parseInt(row[12]);
        } else {
          lastSheetRow = i + 1; // fallback if column F is missing
        }
        break;
      }
    }
 
    // Calculate the exact row to write to
    let nextRow = lastSheetRow + 1;
    if (lastDate && lastDate !== date) {
      nextRow += 2; // two-row visual gap between days
    }
 
    // Write directly to a specific row — no append, no surprises
    // Column F stores nextRow as a hidden helper so checkout can always find this row
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Archive!A${nextRow}:M${nextRow}`,
      valueInputOption: 'RAW',
      resource: { values: [[date, '', name, `${site} (${time} - )`, '', '', '', '', '', '', '', '', nextRow]] },
    });
    console.log(`Archive check-in logged at row ${nextRow}: ${name} at ${site} ${time}`);
  } catch (err) {
    console.error('Failed to log archive check-in:', err.message);
  }
}
 
// Update the matching check-in row in Archive with check-out time and total duration
async function logArchiveCheckOut(name, site, timeOut, date) {
  if (!googleAuth || !SHEET_ID) return;
  try {
    const sheets = google.sheets({ version: 'v4', auth: googleAuth });
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Archive!A:M',
    });
    const rows = result.data.values || [];
    let matchRowIndex = -1;
    let timeIn = null;
 
    for (let i = rows.length - 1; i >= 1; i--) {
      const row = rows[i];
      const rowDate = row[0] ? String(row[0]).trim() : '';
      const rowName = row[2] ? String(row[2]).trim() : '';
      const rowD    = row[3] ? String(row[3]) : '';
 
      if (
        rowDate === date &&
        rowName === name &&
        rowD.startsWith(`${site} (`) && rowD.endsWith(' - )')
      ) {
        // Use the sheet row number stored in column F for a precise update
        matchRowIndex = (row[12] && !isNaN(parseInt(row[12]))) ? parseInt(row[12]) : i + 1;
        const match = rowD.match(/\((\d{2}:\d{2}) - \)$/);
        if (match) timeIn = match[1];
        break;
      }
    }
 
    if (matchRowIndex === -1) {
      console.log(`No matching Archive check-in found for ${name} at ${site} today`);
      return;
    }
 
    const duration = timeIn ? calcDuration(timeIn, timeOut) : '—';
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Archive!D${matchRowIndex}:E${matchRowIndex}`,
      valueInputOption: 'RAW',
      resource: { values: [[`${site} (${timeIn} - ${timeOut})`, duration]] },
    });
    console.log(`Archive check-out logged: ${name} at ${site}, duration ${duration}`);
  } catch (err) {
    console.error('Failed to log archive check-out:', err.message);
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
      const date = now.toLocaleDateString('en-GB', { timeZone: 'Europe/London' });
      const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
 
      // --- Handle pending site confirmation (scanner replied with a number) ---
      if (pendingConfirmations[creatorId]) {
        const pending = pendingConfirmations[creatorId];
        const choice = parseInt(cleanText);
 
        if (!isNaN(choice) && choice >= 1 && choice <= pending.assignments.length) {
          const selected = pending.assignments[choice - 1];
          delete pendingConfirmations[creatorId];
 
          if (pending.type === 'onsite') {
            await logOnSite(pending.name, selected.site, selected.batch, pending.time, pending.date);
            await logArchiveCheckIn(pending.name, selected.site, pending.time, pending.date);
            await tickCheckbox(selected.rowNumber, 'L');
            await sendMessage(`✅ Check-in recorded for ${pending.name} at ${selected.site}${selected.batch ? ` (${selected.batch})` : ''} at ${pending.time}`);
          } else {
            await logOffSite(pending.name, selected.site, pending.time, pending.date);
            await logArchiveCheckOut(pending.name, selected.site, pending.time, pending.date);
            await tickCheckbox(selected.rowNumber, 'M');
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
          const { site, batch, rowNumber } = assignments[0];
          await logOnSite(name, site, batch, time, date);
          await logArchiveCheckIn(name, site, time, date);
          await tickCheckbox(rowNumber, 'L');
          await sendMessage(`✅ Check-in recorded for ${name} at ${site}${batch ? ` (${batch})` : ''} at ${time}`);
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
          const { site, rowNumber } = assignments[0];
          await logOffSite(name, site, time, date);
          await logArchiveCheckOut(name, site, time, date);
          await tickCheckbox(rowNumber, 'M');
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
