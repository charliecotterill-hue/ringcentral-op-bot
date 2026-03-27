const express = require('express');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const RC_CLIENT_ID = process.env.RC_CLIENT_ID;
const RC_CLIENT_SECRET = process.env.RC_CLIENT_SECRET;
const RC_SERVER = 'https://platform.ringcentral.com';
let botToken = process.env.RC_BOT_TOKEN;

app.get('/', (req, res) => res.send('Bot is running'));

app.get('/oauth', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('No code provided');
  try {
    const credentials = Buffer.from(`${RC_CLIENT_ID}:${RC_CLIENT_SECRET}`).toString('base64');
    const response = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=authorization_code&code=${code}&redirect_uri=https://ringcentral-op-bot.onrender.com/oauth`,
    });
    const data = await response.json();
    if (data.access_token) {
      botToken = data.access_token;
      console.log('Bot authenticated successfully!');
      res.send('Bot installed successfully! You can close this window.');
    } else {
      console.error('OAuth failed:', JSON.stringify(data));
      res.status(400).send('OAuth failed: ' + JSON.stringify(data));
    }
  } catch (err) {
    console.error('OAuth error:', err.message);
    res.status(500).send('OAuth error');
  }
});

app.post('/webhook', async (req, res) => {
  const validationToken = req.headers['validation-token'];
  if (validationToken) {
    console.log('Validation received');
    res.setHeader('Validation-Token', validationToken);
    return res.status(200).send();
  }
  const event = req.body;
  console.log('Event received:', JSON.stringify(event));
  if (event && event.body && event.body.text !== undefined) {
    const text = event.body.text;
    const chatId = event.body.groupId;
    if (chatId && text && text.trim()) {
      await sendMessage(chatId, `Echo: ${text.trim()}`);
    }
  }
  res.status(200).send();
});

async function sendMessage(chatId, text) {
  if (!botToken) { console.error('No bot token'); return; }
  const response = await fetch(
    `${RC_SERVER}/restapi/v1.0/glip/chats/${chatId}/posts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    }
  );
  if (!response.ok) console.error('Send failed:', await response.text());
  else console.log('Message sent!');
}

app.listen(PORT, () => console.log(`Bot running on port ${
