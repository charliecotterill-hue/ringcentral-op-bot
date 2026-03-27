const express = require('express');
const app = express();
app.use(express.json());
 
const PORT = process.env.PORT || 3000;
const INCOMING_WEBHOOK_URL = process.env.INCOMING_WEBHOOK_URL;
 
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
