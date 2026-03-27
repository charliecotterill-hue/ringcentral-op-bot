const express = require('express');
const app = express();
app.use(express.json());
 
const PORT = process.env.PORT || 3000;
const INCOMING_WEBHOOK_URL = process.env.INCOMING_WEBHOOK_URL;
const BOT_OWNER_ID = process.env.BOT_OWNER_ID;
 
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
 
    // Ignore messages sent by the bot itself to prevent loops
    if (BOT_OWNER_ID && creatorId === BOT_OWNER_ID) {
      console.log('Ignoring bot own message');
      return res.status(200).send();
    }
 
    // Also ignore messages that start with Echo: as a safety net
    if (text && text.trim().startsWith('Echo:')) {
      console.log('Ignoring echo message');
      return res.status(200).send();
    }
 
    if (text && text.trim()) {
      console.log(`Message received: "${text.trim()}"`);
      await sendMessage(`Echo: ${text.trim()}`);
    }
  }
 
  res.status(200).send();
});
 
async function sendMessage(text) {
  if (!INCOMING_WEBHOOK_URL) {
    console.error('INCOMING_WEBHOOK_URL is not set');
    return;
  }
  try {
    const response = await fetch(INCOMING_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      console.error('Send failed:', await response.text());
    } else {
      console.log('Message sent successfully!');
    }
  } catch (err) {
    console.error('Error sending message:', err.message);
  }
}
 
app.listen(PORT, () => console.log(`Bot running on port ${PORT}`));
