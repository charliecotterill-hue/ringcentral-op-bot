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
    res.setHeader('Validation-Token', validationToken);
    return res.status(200).send();
  }
  const event = req.body;
  if (event && event.body && event.body.text !== undefined) {
    const text = event.body.text;
    const chatId = event.body.groupId;
    if (chatId && text) {
      await sendMessage(chatId, `Echo: ${text}`);
    }
  }
  res.status(200).send();
});

async function sendMessage(chatId, text) {
  if (!RC_BOT_TOKEN) return;
  await fetch(
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
}

app.listen(PORT, () => {
  console.log(`Bot running on port ${PORT}`);
});
