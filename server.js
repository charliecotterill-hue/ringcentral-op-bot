const express = require('express');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const RC_BOT_TOKEN = process.env.RC_BOT_TOKEN;
const WEBHOOK_URL = 'https://ringcentral-op-bot.onrender.com/webhook';

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

async function registerWebhook() {
  if (!RC_BOT_TOKEN) {
    console.error('RC_BOT_TOKEN not set');
    return;
  }
  try {
    const response = await fetch(
      'https://platform.ringcentral.com/restapi/v1.0/subscription',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RC_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventFilters: ['/restapi/v1.0/glip/posts'],
          deliveryMode: {
            transportType: 'WebHook',
            address: WEBHOOK_URL,
          },
          expiresIn: 604800,
        }),
      }
    );
    const data = await response.json();
    if (response.ok) {
      console.log('Webhook registered! ID:', data.id);
    } else {
      console.error('Webhook registration failed:', JSON.stringify(data));
    }
  } catch (err) {
    console.error('Error registering webhook:', err.message);
  }
}

app.listen(PORT, async () => {
  console.log(`Bot running on port ${PORT}`);
  await registerWebhook();
});
