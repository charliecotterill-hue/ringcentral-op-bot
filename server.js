
const express = require('express');
const { google } = require('googleapis');
const app = express();
app.use(express.json());
 
const PORT = process.env.PORT || 3000;
const INCOMING_WEBHOOK_URL = process.env.INCOMING_WEBHOOK_URL; // fallback for unknown channels
const BOT_OWNER_ID = process.env.BOT_OWNER_ID;
const SHEET_ID = process.env.SHEET_ID;
const TRACKER_SHEET_ID = process.env.TRACKER_SHEET_ID;
const RC_BOT_TOKEN = process.env.RC_BOT_TOKEN;
const SLACK_EQUIPMENT_WEBHOOK_URL = process.env.SLACK_EQUIPMENT_WEBHOOK_URL; // Slack incoming webhook for equipment requests
 
// Map of channel ID → allowed scanner RC user ID (only this person triggers the bot)
const CHANNEL_SCANNERS = {
  '149401255942': '4840338044', // Soloman
  '148269629446': '4790927044', // Amelia
  '148269637638': '4790929044', // Isoken
  '148666138630': '4807447044', // Bijay
  '111765692422': '2806324044', // Erwin
  '84528357382':  '922888067', // Billy
  '138135478278': '4327964044', // Muzayam
  '137018212358': '1004395045', // Taheb
  '65752907782':  '245660040',  // Ibrahim
  '67913056262':  '4016232020', // Lewis
  '146155782150': '4694875044', // Emmadadeen
  '137018204166': '1004407045', // Asha
  '77664509958':  '823968067',  // Jack
  '152018313222': '4924869044', // Ahmed
  '158220779526': '7442969044', // Matt
  '71424065542':  '538152044',  // Elliot
  '153498329094': '4966017044', // Joseph
  '151443390470': '4906976044', // Alexandra
  '148071874566': '4781541044', // Sa'ad
  '145034674182': '1092080045', // Omar
  '152342814726': '4936055044', // Louie
  '158565171206': '7454948044', // George
  '156654592006': '5058918044', // Rahat
  '159333703686': '4064968020', // Muhammad Umar
};
 
// Map of RC user ID → first name (avoids needing RC_BOT_TOKEN for name lookups)
const SCANNER_NAMES = {
  '4840338044': 'Soloman',
  '4790927044': 'Amelia',
  '4790929044': 'Isoken',
  '4807447044': 'Bijay',
  '2806324044': 'Erwin',
  '922888067': 'Billy',
  '4327964044': 'Muzayam',
  '1004395045': 'Taheb',
  '245660040':  'Ibrahim',
  '4016232020': 'Lewis',
  '4694875044': 'Emmadadeen',
  '1004407045': 'Asha',
  '823968067':  'Jack',
  '4924869044': 'Ahmed',
  '7442969044': 'Matt',
  '538152044':  'Elliot',
  '4966017044': 'Joseph',
  '4906976044': 'Alexandra',
  '4781541044': "Sa'ad",
  '1092080045': 'Omar',
  '4936055044': 'Louie',
  '7454948044': 'George',
  '5058918044': 'Rahat',
  '4064968020': 'Muhammad Umar',
};
 
// Map of channel ID → incoming webhook URL
const CHANNEL_WEBHOOKS = {
  '149401255942': 'https://hooks.ringcentral.com/webhook/v2/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6ImMiLCJvaSI6IjIxNDcwNzgxNDQxIiwiaWQiOiIzNjk5NjA1NTMxIn0.3HUHXk4IHBBzueouCUWmjf5VP89bocP8BVhw6mI1LWM',
  '148269629446': 'https://hooks.ringcentral.com/webhook/v2/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6ImMiLCJvaSI6IjIxNDcwNzgxNDQxIiwiaWQiOiIzNjk5NjEzNzIzIn0.fklh7xMGo4lnsHvWEMyABDBsDVdOi14S2KnBmn12tr0',
  '148269637638': 'https://hooks.ringcentral.com/webhook/v2/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6ImMiLCJvaSI6IjIxNDcwNzgxNDQxIiwiaWQiOiIzNjk5NjMwMTA3In0.3Yiut3rhI765MVykyn3NSn19BUNNhHKDmA-4tefgITc',
  '148666138630': 'https://hooks.ringcentral.com/webhook/v2/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6ImMiLCJvaSI6IjIxNDcwNzgxNDQxIiwiaWQiOiIzNjk5NjM4Mjk5In0.GwXxjQjVx4rZF02FP-cWlqVL7iQ3LtMvKodHXeqadow',
  '111765692422': 'https://hooks.ringcentral.com/webhook/v2/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6ImMiLCJvaSI6IjIxNDcwNzgxNDQxIiwiaWQiOiIzNzEyMDgxOTQ3In0.-Dl-3nmEc4wuTkJAeSyp7cMr55Tkav9a_-NMGViTW5U',
  '84528357382':  'https://hooks.ringcentral.com/webhook/v2/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6ImMiLCJvaSI6IjIxNDcwNzgxNDQxIiwiaWQiOiIzNzE0Njc4ODExIn0.UKkK718Nyk6gYiI8bZ2-r2HpTkFjPe7QlL5CpRV2XgI',
  '138135478278': 'https://hooks.ringcentral.com/webhook/v2/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6ImMiLCJvaSI6IjIxNDcwNzgxNDQxIiwiaWQiOiIzNzE0NzQ0MzQ3In0.z1X051gWcpaHxG2OQKxHr0VygVYwF-Lljm4F-Hpht7U',
  '137018212358': 'https://hooks.ringcentral.com/webhook/v2/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6ImMiLCJvaSI6IjIxNDcwNzgxNDQxIiwiaWQiOiIzNzE0NzUyNTM5In0.qo9CPBKPrlKhGaoN1ZxMDulUB_praXgQFJDWdXRKRSU',
  '65752907782':  'https://hooks.ringcentral.com/webhook/v2/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6ImMiLCJvaSI6IjIxNDcwNzgxNDQxIiwiaWQiOiIzNzE0NzM2MTU1In0.SOEJyBCqXqqvUmKjllN6KpD6c-CapH9IvW91s0PwRp4',
  '67913056262':  'https://hooks.ringcentral.com/webhook/v2/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6ImMiLCJvaSI6IjIxNDcwNzgxNDQxIiwiaWQiOiIzNzIxMDYwMzc5In0.tMsH-oC0ejOGxi-oRx481Qje9lGlqZURGQSnzdKqYmw',
  '146155782150': 'https://hooks.ringcentral.com/webhook/v2/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6ImMiLCJvaSI6IjIxNDcwNzgxNDQxIiwiaWQiOiIzNzIxMDY4NTcxIn0.qtSLBSfPT7Ua0pNVQ0A7bDp6ecbjE8fh9BE8Iw2IhSo',
  '137018204166': 'https://hooks.ringcentral.com/webhook/v2/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6ImMiLCJvaSI6IjIxNDcwNzgxNDQxIiwiaWQiOiIzNzIyODQ2MjM1In0.Ivm6qaiBTJsRxenYZqYcSAW262WR-gh4Fs_KLUTOVYs',
  '77664509958':  'https://hooks.ringcentral.com/webhook/v2/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6ImMiLCJvaSI6IjIxNDcwNzgxNDQxIiwiaWQiOiIzNzIyODU0NDI3In0.lxLDCPSrXZ9An9h1mqZPo98UHPEYdcuzhmDVnCmRfI0',
  '152018313222': 'https://hooks.ringcentral.com/webhook/v2/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6ImMiLCJvaSI6IjIxNDcwNzgxNDQxIiwiaWQiOiIzNzIyODYyNjE5In0.oVYriDlNBDl7QkLBMK2Zumwfn1ap4CZfWSzOhb57K9I',
  '158220779526': 'https://hooks.ringcentral.com/webhook/v2/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6ImMiLCJvaSI6IjIxNDcwNzgxNDQxIiwiaWQiOiIzNzIyODcwODExIn0.J9F_74j8GnwkrneTTcR6q79qtSI4LBk8F54eVvHwJes',
  '71424065542':  'https://hooks.ringcentral.com/webhook/v2/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6ImMiLCJvaSI6IjIxNDcwNzgxNDQxIiwiaWQiOiIzNzM5MDAwODU5In0.uRkOSP_SbecxI47D0d6xyBANYzjKjnvkcx4G8M3CkZs',
  '153498329094': 'https://hooks.ringcentral.com/webhook/v2/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6ImMiLCJvaSI6IjIxNDcwNzgxNDQxIiwiaWQiOiIzNzM5MDA5MDUxIn0.5K05jecX7ylLo_xKFQji45Fjut9YogROV0c8NNq71ag',
  '151443390470': 'https://hooks.ringcentral.com/webhook/v2/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6ImMiLCJvaSI6IjIxNDcwNzgxNDQxIiwiaWQiOiIzNzM5MDI1NDM1In0.hmpk7EyEa4DT_s9VyI5M5qhGMmx07n6MXsGAlTl4UIQ',
  '148071874566': 'https://hooks.ringcentral.com/webhook/v2/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6ImMiLCJvaSI6IjIxNDcwNzgxNDQxIiwiaWQiOiIzNzM5MDMzNjI3In0.vuSpdbHMIAufVtzFFDxJQY1mtPp1LrmSfy2sptFHAVY',
  '145034674182': 'https://hooks.ringcentral.com/webhook/v2/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6ImMiLCJvaSI6IjIxNDcwNzgxNDQxIiwiaWQiOiIzNzM5MDE3MjQzIn0.SlOMGvIk9vBLwC55tkR-Tvb4ABP4rfAuKszEEFKSO4E',
  '152342814726': 'https://hooks.ringcentral.com/webhook/v2/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6ImMiLCJvaSI6IjIxNDcwNzgxNDQxIiwiaWQiOiIzNzM5MDU4MjAzIn0.y2H2fqj-byvd-0pi3Je0tmMWeONIMwd_nDDqPj4J9Pw',
  '158565171206': 'https://hooks.ringcentral.com/webhook/v2/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6ImMiLCJvaSI6IjIxNDcwNzgxNDQxIiwiaWQiOiIzODA3NTE4NzQ3In0.ASPAbCuxEVyxgm-Hc3BmFlPb27aiFWDMgonvOVmmsXY',
  '156654592006': 'https://hooks.ringcentral.com/webhook/v2/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6ImMiLCJvaSI6IjIxNDcwNzgxNDQxIiwiaWQiOiIzODA5MzcwMTM5In0.G5624hu_TZRKxpUOUuhcWk1AqG2Vg43EK8scng9zItg',
  '159333703686': 'https://hooks.ringcentral.com/webhook/v2/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6ImMiLCJvaSI6IjIxNDcwNzgxNDQxIiwiaWQiOiIzODA5Mzc4MzMxIn0.tohzWoE2jhvgyMBrIVme1JgzlYvPzUWWLeiEALFS5hA',
};
 
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
 
// Detect equipment/kit requests from a scanner
function isEquipmentRequestMessage(text) {
  const t = text.toLowerCase().trim();
 
  // Direct keyword
  if (/\bequipment\s+request\b/.test(t)) return true;
 
  // "need/want/require" + "new/replacement" anywhere nearby
  if (/\b(need|want|require|requesting|request)\b.{0,25}\b(new|replacement|replace|another)\b/.test(t)) return true;
  if (/\b(need|want|require)\b.{0,15}\b(ppe|gear|equipment|uniform|kit)\b/.test(t)) return true;
 
  // "my [item] is broken/damaged/worn/torn/lost/ripped"
  if (/\bmy\b.{0,25}\b(broken|damaged|worn|torn|lost|ripped|worn.?out|falling.?apart)\b/.test(t)) return true;
 
  // "[item] needs replacing"
  if (/\bneeds?\s+(replacing|replacement|to\s+be\s+replaced)\b/.test(t)) return true;
 
  // "can I get [new] [item]"
  if (/\bcan\s+i\s+(get|have|order)\b.{0,25}\b(new|replacement|some)?\b/.test(t) &&
      /\b(boots?|helmet|hard.?hat|vest|hi.?vis|gloves?|jacket|trousers?|ppe|uniform|scanner|tablet|device)\b/.test(t)) return true;
 
  // Common equipment items mentioned with damage/need indicators
  const items = ['boots?', 'helmet', 'hard.?hat', 'vest', 'hi.?vis', 'gloves?', 'jacket', 'trousers?', 'ppe', 'uniform', 'scanner', 'tablet', 'device'];
  for (const item of items) {
    if (new RegExp(`\\b(new|replacement|need|broken|damaged|worn|torn)\\b.{0,30}${item}\\b`).test(t)) return true;
    if (new RegExp(`\\b${item}\\b.{0,25}\\b(broken|damaged|worn|torn|replacement|replace|needed)`).test(t)) return true;
  }
 
  return false;
}
 
// Send a message to the equipment request Slack channel
async function sendSlackEquipmentMessage(text) {
  if (!SLACK_EQUIPMENT_WEBHOOK_URL) {
    console.log('SLACK_EQUIPMENT_WEBHOOK_URL not set — equipment request not forwarded to Slack');
    return;
  }
  try {
    const response = await fetch(SLACK_EQUIPMENT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) console.error('Slack equipment send failed:', await response.text());
    else console.log('Equipment request sent to Slack');
  } catch (err) {
    console.error('Error sending equipment request to Slack:', err.message);
  }
}
 
// Extract a HH:MM time string from a message (e.g. "10", "10:30", "9am", "10:30am")
function extractMentionedTime(text) {
  const t = text.toLowerCase();
  // HH:MM or H:MM optionally with am/pm
  const colonMatch = t.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/);
  if (colonMatch) {
    let h = parseInt(colonMatch[1]);
    const m = parseInt(colonMatch[2]);
    const ampm = colonMatch[3];
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }
  // H am/pm or H am / H pm (e.g. "10am", "9 pm")
  const ampmMatch = t.match(/\b(\d{1,2})\s*(am|pm)\b/);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1]);
    const ampm = ampmMatch[2];
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    if (h >= 0 && h <= 23) return `${String(h).padStart(2, '0')}:00`;
  }
  // Standalone hour after "at" or "since" (e.g. "at 10", "since 9")
  const atMatch = t.match(/\b(?:at|since)\s+(\d{1,2})\b/);
  if (atMatch) {
    const h = parseInt(atMatch[1]);
    if (h >= 5 && h <= 23) return `${String(h).padStart(2, '0')}:00`;
  }
  return null;
}
 
// Detect a late/forgotten check-in — scanner mentions a specific past arrival time with an apology/context hint
function isLateCheckInMessage(text) {
  const t = text.toLowerCase().trim();
  const retroPhrases = [
    'forgot', 'forget', 'apolog', 'sorry i', 'meant to',
    'should have messaged', 'should have checked',
    'been here since', 'been on site since',
    'was here at', 'was on site at', 'was at site at',
    'got here at', 'got on site at', 'got in at',
    'have been here', 'have been on site',
    'i was here', 'been here from',
  ];
  const hasRetroPhrase = retroPhrases.some(p => t.includes(p));
  if (!hasRetroPhrase) return false;
  return extractMentionedTime(t) !== null;
}
 
// Detect on site messages
function isOnSiteMessage(text) {
  const t = text.toLowerCase().trim();
 
  // on site / onsite / on-site / on sight / on sit (common typos)
  // but not in future/conditional or negative context
  if (/\bon.?si(te?|ght)\b/.test(t) &&
    !/\b(when|once|until|will be|going to be|about to be|should be|if)\b.{0,20}on.?si(te?|ght)\b/.test(t) &&
    !/\b(not|no|never|wasn't|isn't|aren't|haven't|don't|doesn't|wont|won't|cant|can't)\b.{0,10}on.?si(te?|ght)\b/.test(t) &&
    !/\bon.?si(te?|ght)\b.{0,10}\b(yet|today)\b/.test(t)) return true;
 
  // at site / at the site
  if (/\bat\s+(the\s+)?site\b/.test(t)) return true;
 
  // clock in / clocking in / clocked in / clockin
  if (/\bcloc?k(ed|ing)?\s*in\b/.test(t)) return true;
 
  // arrived / arriving — but not when referring to past/other people, items, or deliveries
  if (/\barri?v+(ed|ing|es)?\b/.test(t) &&
    !/\b(yesterday|last\s+\w+|they|he|she|we|all|everything|it|the\s+\w+)\b.{0,20}\barri?v+/.test(t) &&
    !/\barri?v+(ed|ing|es)?\b.{0,20}\b(apart|except|but\s+not|minus)\b/.test(t)) return true;
 
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
    'starting now', 'just starting', 'starting up',
    'just pulled up', 'pulling up',
  ];
  if (onPhrases.some(p => t.includes(p))) return true;
 
  // Fuzzy matches — catches any of the key trigger words/phrases with one character off
  // fuzzyPhrase for 'on site' removed — covered by regex above which includes future/conditional exclusion
  if (fuzzyPhrase(t, 'at site'))     return true;
  if (fuzzyPhrase(t, 'clock in'))    return true;
  if (fuzzyPhrase(t, 'clocking in')) return true;
  if (fuzzyWord(t, 'arrived') &&
    !/\b(yesterday|last\s+\w+|they|he|she|we|all|everything|it)\b.{0,20}\barri?v+/.test(t) &&
    !/\barri?v+(ed|ing|es)?\b.{0,20}\b(apart|except|but\s+not|minus)\b/.test(t)) return true;
  if (fuzzyWord(t, 'arriving') &&
    !/\b(yesterday|last\s+\w+|they|he|she|we|all|everything|it)\b.{0,20}\barriv/.test(t)) return true;
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
 
  // finished — but not when followed by words suggesting mid-task context
  if (/\bfinish(ed|ing)?\b/.test(t) && !/\bfinish(ed|ing)?\s+(with|the|my|his|her|their|all|a|an|last|this|each|every|that)\b/.test(t)) return true;
 
  // heading off / heading out / headin off / headng out
  if (/\bheadin+g?\s+(off|out)\b/.test(t)) return true;
 
  // catch-all phrase list — matches anywhere in the message
  const offPhrases = [
    'left site', 'left the site',
    'leaving now', 'just leaving',
    'job done', 'all done', 'all done here',
    'all finished', 'just finished', 'now finished',
    'wrapped up', 'just wrapped', 'all wrapped',
    'on my way back', 'on my way home',
    // 'on my way' handled separately below to exclude 'on my way to...'
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
  // fuzzyWord for 'finished' removed — too many false positives in normal conversation
  if (fuzzyWord(t,   'wrapped'))      return true;
 
  // 'on my way' triggers unless followed by 'to the/a/an/office/hospital' etc. but NOT 'to site'
  if (t.includes('on my way')) {
    if (/\bon my way\s+to\s+site\b/.test(t)) return true;
    if (!/\bon my way\s+to\b/.test(t)) return true;
  }
 
  return false;
}
 
// Look up operative name — checks local map first, falls back to RC API
async function getUserName(personId) {
  if (SCANNER_NAMES[String(personId)]) return SCANNER_NAMES[String(personId)];
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
      valueRenderOption: 'FORMATTED_VALUE',
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
 
    // Collect ALL incomplete check-in rows for this scanner/site/date
    const matches = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowDate = row[0] ? String(row[0]).trim() : '';
      const rowName = row[2] ? String(row[2]).trim() : '';
      const rowD    = row[3] ? String(row[3]) : '';
 
      if (
        rowDate === date &&
        rowName === name &&
        rowD.startsWith(`${site} (`) && rowD.endsWith(' - )')
      ) {
        const sheetRow = (row[12] && !isNaN(parseInt(row[12]))) ? parseInt(row[12]) : i + 1;
        const match = rowD.match(/\((\d{2}:\d{2}) - \)$/);
        const timeIn = match ? match[1] : null;
        matches.push({ sheetRow, timeIn });
      }
    }
 
    if (matches.length === 0) {
      console.log(`No matching Archive check-in found for ${name} at ${site} today`);
      return;
    }
 
    // Update all matching rows with the check-out time and duration
    for (const { sheetRow, timeIn } of matches) {
      const duration = timeIn ? calcDuration(timeIn, timeOut) : '—';
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `Archive!D${sheetRow}:E${sheetRow}`,
        valueInputOption: 'RAW',
        resource: { values: [[`${site} (${timeIn} - ${timeOut})`, duration]] },
      });
      console.log(`Archive check-out logged: ${name} at ${site} row ${sheetRow}, duration ${duration}`);
    }
  } catch (err) {
    console.error('Failed to log archive check-out:', err.message);
  }
}
 
// Check if scanner already has a completed visit (timeIn + timeOut) for this site today
async function checkCompletedEntry(name, site, date) {
  if (!googleAuth || !SHEET_ID) return null;
  try {
    const sheets = google.sheets({ version: 'v4', auth: googleAuth });
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A2:F1000',
    });
    const rows = result.data.values || [];
    for (const row of rows) {
      const [rowDate, rowTimeIn, rowName, rowSite, , rowTimeOut] = row;
      if (rowDate === date && rowName === name && rowSite === site && rowTimeIn && rowTimeOut) {
        return { timeIn: rowTimeIn, timeOut: rowTimeOut };
      }
    }
    return null;
  } catch (err) {
    console.error('Failed to check completed entry:', err.message);
    return null;
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
 
// Slack webhook endpoint — handles URL verification and upload complete events
app.post('/slack-webhook', async (req, res) => {
  const body = req.body;
 
  // Slack URL verification challenge
  if (body.type === 'url_verification') {
    return res.json({ challenge: body.challenge });
  }
 
  // Handle message events — only process upload complete notifications
  if (body.event && body.event.type === 'message' && body.event.text) {
    const text = body.event.text;
 
    // Only trigger on "complete" messages, not "commenced"
    if (!text.toLowerCase().includes('complete')) {
      return res.status(200).send();
    }
 
    // Extract site code (e.g. turner_nycfcstadium)
    const siteMatch = text.match(/complete for ([a-z0-9_]+)\./i);
    // Extract dashboard row identifier number
    const rowMatch = text.match(/\[Dashboard row identifier (\d+)\]/i);
 
    if (siteMatch && rowMatch) {
      const fullCode = siteMatch[1].toLowerCase();
      // Use only the part after the underscore (e.g. cw_onenorthquay → onenorthquay)
      const slackSiteCode = fullCode.includes('_') ? fullCode.split('_').slice(1).join('_') : fullCode;
      const batchNumber = rowMatch[1];
      console.log(`Upload complete — site code: ${slackSiteCode}, batch: ${batchNumber}`);
      await updatePSTUploadComplete(slackSiteCode, batchNumber);
    }
  }
 
  res.status(200).send();
});
 
// Look up site name from Site Setup tab and update column J on Scanning Dashboard
async function updatePSTUploadComplete(slackSiteCode, batchNumber) {
  if (!googleAuth || !TRACKER_SHEET_ID) return;
  try {
    const sheets = google.sheets({ version: 'v4', auth: googleAuth });
 
    // Step 1: Look up the site code in Site Setup tab (Column A = code, Column B = PST name)
    const siteSetup = await sheets.spreadsheets.values.get({
      spreadsheetId: TRACKER_SHEET_ID,
      range: 'Site Setup!A:B',
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const siteRows = siteSetup.data.values || [];
    let pstSiteName = null;
    for (const row of siteRows) {
      if (row[0] && row[0].toLowerCase().trim() === slackSiteCode) {
        pstSiteName = row[1];
        break;
      }
    }
    if (!pstSiteName) {
      console.log(`No PST match found for Slack site code: ${slackSiteCode}`);
      return;
    }
    console.log(`Matched site code ${slackSiteCode} → ${pstSiteName}`);
 
    // Step 2: Find matching row in Scanning Dashboard (column D = day, column F = site, column H = batch number)
    const dayOfWeek = new Date().toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'Europe/London' });
    const dashboard = await sheets.spreadsheets.values.get({
      spreadsheetId: TRACKER_SHEET_ID,
      range: 'Scanning Dashboard!C5:H1000',
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const dashRows = dashboard.data.values || [];
    let matchRow = -1;
 
    // First pass: match on day + site + batch (most precise)
    for (let i = 0; i < dashRows.length; i++) {
      const day   = dashRows[i][1]; // Column D
      const site  = dashRows[i][3]; // Column F
      const batch = dashRows[i][5]; // Column H
      if (
        day && day.toLowerCase().trim() === dayOfWeek.toLowerCase() &&
        site && site.toLowerCase().trim() === pstSiteName.toLowerCase().trim() &&
        batch && batch.toString().trim().includes(batchNumber)
      ) {
        matchRow = i + 5;
        break;
      }
    }
 
    // Second pass: if no day match (e.g. upload arrived overnight), match on site + batch only
    if (matchRow === -1) {
      console.log(`No day match found for ${pstSiteName} batch ${batchNumber} on ${dayOfWeek} — trying without day filter`);
      for (let i = 0; i < dashRows.length; i++) {
        const site  = dashRows[i][3]; // Column F
        const batch = dashRows[i][5]; // Column H
        if (
          site && site.toLowerCase().trim() === pstSiteName.toLowerCase().trim() &&
          batch && batch.toString().trim().includes(batchNumber)
        ) {
          matchRow = i + 5;
          console.log(`Fallback match found at row ${matchRow} without day filter`);
          break;
        }
      }
    }
 
    if (matchRow === -1) {
      console.log(`No Scanning Dashboard row found for ${pstSiteName} batch ${batchNumber}`);
      return;
    }
 
    // Step 3: Update column J to 1 (upload complete)
    await sheets.spreadsheets.values.update({
      spreadsheetId: TRACKER_SHEET_ID,
      range: `Scanning Dashboard!J${matchRow}`,
      valueInputOption: 'RAW',
      resource: { values: [[1]] },
    });
    console.log(`Column J updated to 1 for ${pstSiteName} batch ${batchNumber} at row ${matchRow}`);
  } catch (err) {
    console.error('Failed to update PST upload complete:', err.message);
  }
}
 
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
    const webhookUrl = CHANNEL_WEBHOOKS[groupId] || INCOMING_WEBHOOK_URL;
    console.log(`Message received — groupId: ${groupId}, creatorId: ${creatorId}`);
 
    // Ignore messages with no sender (e.g. incoming webhook posts from the bot itself)
    if (!creatorId) {
      return res.status(200).send();
    }
 
    // Ignore bot's own messages
    if (BOT_OWNER_ID && creatorId === BOT_OWNER_ID) {
      return res.status(200).send();
    }
 
    // Ignore bot confirmation/question messages
    if (text && (
      text.trim().startsWith('✅') ||
      text.trim().startsWith('⚠️') ||
      text.trim().startsWith('Hi ') ||
      text.trim().startsWith('Please reply') ||
      text.trim().startsWith('What size') ||
      text.trim().startsWith('What address') ||
      text.trim().startsWith('Any additional notes')
    )) {
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
 
        // Expire pending confirmations older than 30 minutes
        if (Date.now() - pending.timestamp > 30 * 60 * 1000) {
          delete pendingConfirmations[creatorId];
        } else {
 
        // --- Equipment request multi-step flow ---
        if (pending.type === 'equipment_item') {
          // Scanner has replied with the item they need
          const item = cleanText;
          delete pendingConfirmations[creatorId];
          pendingConfirmations[creatorId] = { type: 'equipment_size', name: pending.name, item, webhookUrl: pending.webhookUrl, timestamp: Date.now() };
          await sendMessage(`What size do you need? (Reply N/A if not applicable)`, pending.webhookUrl);
 
        } else if (pending.type === 'equipment_size') {
          const size = cleanText;
          delete pendingConfirmations[creatorId];
          pendingConfirmations[creatorId] = { type: 'equipment_address', name: pending.name, item: pending.item, size, webhookUrl: pending.webhookUrl, timestamp: Date.now() };
          await sendMessage(`What address should we send it to?`, pending.webhookUrl);
 
        } else if (pending.type === 'equipment_address') {
          const address = cleanText;
          delete pendingConfirmations[creatorId];
          pendingConfirmations[creatorId] = { type: 'equipment_notes', name: pending.name, item: pending.item, size: pending.size, address, webhookUrl: pending.webhookUrl, timestamp: Date.now() };
          await sendMessage(`Any additional notes? (Reply NONE if nothing to add)`, pending.webhookUrl);
 
        } else if (pending.type === 'equipment_notes') {
          const notes = cleanText.toLowerCase() === 'none' ? '—' : cleanText;
          delete pendingConfirmations[creatorId];
          // Build and send Slack message
          const slackText = [
            `🔧 *Equipment Request*`,
            `*Scanner:* ${pending.name}`,
            `*Item:* ${pending.item}`,
            `*Size:* ${pending.size}`,
            `*Delivery Address:* ${pending.address}`,
            `*Notes:* ${notes}`,
          ].join('\n');
          await sendSlackEquipmentMessage(slackText);
          await sendMessage(`✅ Equipment request submitted! We'll get that sorted for you, ${pending.name}.`, pending.webhookUrl);
 
        // --- YES/NO responses (duplicate_checkin, duplicate_checkout, or late_checkin) ---
        } else if (pending.type === 'duplicate_checkin' || pending.type === 'duplicate_checkout' || pending.type === 'late_checkin') {
          const reply = cleanText.toLowerCase().trim();
          delete pendingConfirmations[creatorId];
          if (reply === 'yes' || reply === 'y') {
            if (pending.type === 'duplicate_checkout') {
              await logOffSite(pending.name, pending.site, pending.time, pending.date);
              await logArchiveCheckOut(pending.name, pending.site, pending.time, pending.date);
              await tickCheckbox(pending.rowNumber, 'M');
              await sendMessage(`✅ Check-out recorded for ${pending.name} at ${pending.site} at ${pending.time}`, pending.webhookUrl);
            } else {
              const checkInTime = pending.type === 'late_checkin' ? pending.lateTime : pending.time;
              await logOnSite(pending.name, pending.site, pending.batch, checkInTime, pending.date);
              await logArchiveCheckIn(pending.name, pending.site, checkInTime, pending.date);
              await tickCheckbox(pending.rowNumber, 'L');
              await sendMessage(`✅ Check-in recorded for ${pending.name} at ${pending.site}${pending.batch ? ` (${pending.batch})` : ''} at ${checkInTime}`, pending.webhookUrl);
            }
          } else {
            await sendMessage(`No problem, not recorded.`, pending.webhookUrl);
          }
 
        // --- Numeric choice for multi-site late check-in ---
        } else if (pending.type === 'late_checkin_multisite') {
          const choice = parseInt(cleanText);
          if (!isNaN(choice) && choice >= 1 && choice <= pending.assignments.length) {
            const selected = pending.assignments[choice - 1];
            delete pendingConfirmations[creatorId];
            await logOnSite(pending.name, selected.site, selected.batch, pending.lateTime, pending.date);
            await logArchiveCheckIn(pending.name, selected.site, pending.lateTime, pending.date);
            await tickCheckbox(selected.rowNumber, 'L');
            await sendMessage(`✅ Check-in recorded for ${pending.name} at ${selected.site}${selected.batch ? ` (${selected.batch})` : ''} at ${pending.lateTime}`, pending.webhookUrl);
          } else {
            await sendMessage(`Please reply with a number between 1 and ${pending.assignments.length}.`, pending.webhookUrl);
          }
 
        // --- Numeric choice for regular multi-site on/off-site ---
        } else {
          const choice = parseInt(cleanText);
          if (!isNaN(choice) && choice >= 1 && choice <= pending.assignments.length) {
            const selected = pending.assignments[choice - 1];
            delete pendingConfirmations[creatorId];
            if (pending.type === 'onsite') {
              await logOnSite(pending.name, selected.site, selected.batch, pending.time, pending.date);
              await logArchiveCheckIn(pending.name, selected.site, pending.time, pending.date);
              await tickCheckbox(selected.rowNumber, 'L');
              await sendMessage(`✅ Check-in recorded for ${pending.name} at ${selected.site}${selected.batch ? ` (${selected.batch})` : ''} at ${pending.time}`, pending.webhookUrl);
            } else {
              await logOffSite(pending.name, selected.site, pending.time, pending.date);
              await logArchiveCheckOut(pending.name, selected.site, pending.time, pending.date);
              await tickCheckbox(selected.rowNumber, 'M');
              await sendMessage(`✅ Check-out recorded for ${pending.name} at ${selected.site} at ${pending.time}`, pending.webhookUrl);
            }
          } else {
            await sendMessage(`Please reply with a number between 1 and ${pending.assignments.length}.`, pending.webhookUrl);
          }
        } // end confirmation type handling
 
          return res.status(200).send(); // handled — stop processing
        } // end of non-expired confirmation block
        // If confirmation was expired it was just deleted above — fall through to normal handlers
      }
 
      // --- Whitelist check: only respond to the assigned scanner for this channel ---
      const allowedScannerId = CHANNEL_SCANNERS[groupId];
      if (allowedScannerId && String(creatorId) !== String(allowedScannerId)) {
        return res.status(200).send();
      }
      const name = await getUserName(creatorId);
 
      // --- Handle late/forgotten check-in (scanner mentions they arrived at a past time) ---
      if (isLateCheckInMessage(cleanText)) {
        const lateTime = extractMentionedTime(cleanText.toLowerCase());
        const assignments = await getScannersAssignments(name);
 
        if (assignments.length === 0) {
          await sendMessage(`⚠️ Hi ${name}, I couldn't find your schedule for today. Please contact your ops team.`, webhookUrl);
        } else if (assignments.length === 1) {
          const { site, batch, rowNumber } = assignments[0];
          pendingConfirmations[creatorId] = { type: 'late_checkin', name, site, batch, rowNumber, lateTime, date, webhookUrl, timestamp: Date.now() };
          await sendMessage(`Hi ${name}, would you like us to record your arrival time as ${lateTime}? Reply YES to confirm or NO to cancel.`, webhookUrl);
        } else {
          // Multiple sites — ask which site first, then log with the past time
          pendingConfirmations[creatorId] = { type: 'late_checkin_multisite', assignments, name, lateTime, date, webhookUrl, timestamp: Date.now() };
          const list = assignments.map((a, i) => `${i + 1}. ${a.site} — ${a.batch}`).join('\n');
          await sendMessage(`Hi ${name}, you're scheduled at multiple sites today:\n${list}\nWhich site were you arriving at? Reply with the number.`, webhookUrl);
        }
 
      // --- Handle on site messages ---
      } else if (isOnSiteMessage(cleanText)) {
        const assignments = await getScannersAssignments(name);
 
        if (assignments.length === 0) {
          await sendMessage(`⚠️ Hi ${name}, I couldn't find your schedule for today. Please contact your ops team.`, webhookUrl);
        } else if (assignments.length === 1) {
          const { site, batch, rowNumber } = assignments[0];
 
          // Check if scanner already has a completed visit for this site today
          const completed = await checkCompletedEntry(name, site, date);
          if (completed) {
            pendingConfirmations[creatorId] = { type: 'duplicate_checkin', name, site, batch, rowNumber, time, date, webhookUrl, timestamp: Date.now() };
            await sendMessage(`Hi ${name}, it looks like you already completed a visit at ${site} today (checked in at ${completed.timeIn}, checked out at ${completed.timeOut}). Would you like to log another check-in? Reply YES to confirm or NO to cancel.`, webhookUrl);
          } else {
            await logOnSite(name, site, batch, time, date);
            await logArchiveCheckIn(name, site, time, date);
            await tickCheckbox(rowNumber, 'L');
            await sendMessage(`✅ Check-in recorded for ${name} at ${site}${batch ? ` (${batch})` : ''} at ${time}`, webhookUrl);
          }
        } else {
          // Multiple sites — ask which one
          pendingConfirmations[creatorId] = { type: 'onsite', assignments, name, time, date, webhookUrl, timestamp: Date.now() };
          const list = assignments.map((a, i) => `${i + 1}. ${a.site} — ${a.batch}`).join('\n');
          await sendMessage(`Hi ${name}, you're scheduled at multiple sites today:\n${list}\nPlease reply with the number of the site you're arriving at.`, webhookUrl);
        }
 
 
      // --- Handle off site messages ---
      } else if (isOffSiteMessage(cleanText)) {
        const assignments = await getScannersAssignments(name);
 
        if (assignments.length === 0) {
          await sendMessage(`⚠️ Hi ${name}, I couldn't find your schedule for today. Please contact your ops team.`, webhookUrl);
        } else if (assignments.length === 1) {
          const { site, rowNumber } = assignments[0];
 
          // Check if scanner has already checked out of this site today
          const completed = await checkCompletedEntry(name, site, date);
          if (completed) {
            pendingConfirmations[creatorId] = { type: 'duplicate_checkout', name, site, rowNumber, time, date, webhookUrl, timestamp: Date.now() };
            await sendMessage(`Hi ${name}, it looks like you already checked out of ${site} today (checked out at ${completed.timeOut}). Would you like to log another check-out? Reply YES to confirm or NO to cancel.`, webhookUrl);
          } else {
            await logOffSite(name, site, time, date);
            await logArchiveCheckOut(name, site, time, date);
            await tickCheckbox(rowNumber, 'M');
            await sendMessage(`✅ Check-out recorded for ${name} at ${site} at ${time}`, webhookUrl);
          }
        } else {
          // Multiple sites — ask which one they're leaving
          pendingConfirmations[creatorId] = { type: 'offsite', assignments, name, time, date, webhookUrl, timestamp: Date.now() };
          const list = assignments.map((a, i) => `${i + 1}. ${a.site} — ${a.batch}`).join('\n');
          await sendMessage(`Hi ${name}, you're scheduled at multiple sites today:\n${list}\nPlease reply with the number of the site you're leaving.`, webhookUrl);
        }
 
      // --- Handle equipment requests ---
      } else if (isEquipmentRequestMessage(cleanText)) {
        pendingConfirmations[creatorId] = { type: 'equipment_item', name, webhookUrl, timestamp: Date.now() };
        await sendMessage(`Hi ${name}, I've picked up your equipment request. What equipment do you need? Please describe the item (e.g. 'steel toe cap boots', 'hi-vis vest').`, webhookUrl);
 
      }
    }
  }
 
  res.status(200).send();
});
 
async function sendMessage(text, webhookUrl) {
  const url = webhookUrl || INCOMING_WEBHOOK_URL;
  if (!url) return;
  try {
    const response = await fetch(url, {
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
 
