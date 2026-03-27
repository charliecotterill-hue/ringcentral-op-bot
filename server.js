const express = require('express');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const RC_CLIENT_ID = process.env.RC_CLIENT_ID;
const RC_CLIENT_SECRET = process.env.RC_CLIENT_SECRET;
const RC_SERVER = 'https://platform.ringcentral.com';
let botToken = null;

async function getBotToken() {
  try {
    const credentials = Buffer.from(`${RC_CLIENT_ID}:${RC_CLIENT_SECRET}`).toString('base64');
    const response = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const data = await response.json();
    if (data.access_token) {
      botToken = data.access_token;
      console.log('Bot token obtained successfully');
      setTimeout(getBotToken, (data.expires_in - 60) * 1000);
    } else {
      console.error('Token error:', JSON.stringify(data));
      setTimeout(getBotToken, 60000);
    }
  } catch (err) {
    console.error('Token fetch error:', err.message);
    setTimeout(getBotToken, 60000);
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
  if (!botToken) { console.error('No token yet'); return; }
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

app.listen(PORT, async () => {
  console.log(`Bot running on port ${PORT}`);
  await getBotToken();
});
