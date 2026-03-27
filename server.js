const express = require('express');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const RC_BOT_TOKEN = process.env.RC_BOT_TOKEN;

app.get('/', (req, res) => {
  res.send('Bot is running');
});

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
    const chatId = event.body.groupId;
    console.log(`Message: "${text}" in chat ${chatId}`);
    if (chatId && text) {
      await sendMessage(chatId, `Echo: ${text}`);
    }
  }
  res.status(200).send();
});

async function sendMessage(chatId, text) {
  if (!RC_BOT_TOKEN) return;
  const response = await fetch(
    `https://platform.ringcentral.com/restapi/v1.0/glip/chats/${chatId}/posts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RC_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    }
  );
  if (!response.ok) {
    const err = await response.text();
    console.error('Failed to send message:', err);
  }
}

app.listen(PORT, () => {
  console.log(`Bot running on port ${PORT}`);
});
