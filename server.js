const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000; // Für Render wichtig!

app.use(bodyParser.json());

app.post('/action', async (req, res) => {
  const { user, action, duration } = req.body;

  if (!user || !action) {
    return res.status(400).json({ error: 'Fehlender Benutzername oder Aktion.' });
  }

  try {
    // Ersetze diese Daten mit deinen echten Roblox-Werten!
    const UNIVERSE_ID = '7703238522';
    const API_KEY = '45AWjeCPKkOHXkMDNpapFTPBQs/eYWPBBm2mdVX8i97AFVtOZXlKaGJHY2lPaUpTVXpJMU5pSXNJbXRwWkNJNkluTnBaeTB5TURJeExUQTNMVEV6VkRFNE9qVXhPalE1V2lJc0luUjVjQ0k2SWtwWFZDSjkuZXlKaVlYTmxRWEJwUzJWNUlqb2lORFZCVjJwbFExQkxhMDlJV0d0TlJFNXdZWEJHVkZCQ1VYTXZaVmxYVUVKQ2JUSnRaRlpZT0drNU4wRkdWblJQSWl3aWIzZHVaWEpKWkNJNklqYzNNRFExTVRZNU5UZ2lMQ0poZFdRaU9pSlNiMkpzYjNoSmJuUmxjbTVoYkNJc0ltbHpjeUk2SWtOc2IzVmtRWFYwYUdWdWRHbGpZWFJwYjI1VFpYSjJhV05sSWl3aVpYaHdJam94TnpRM09Ea3pOalkxTENKcFlYUWlPakUzTkRjNE9UQXdOalVzSW01aVppSTZNVGMwTnpnNU1EQTJOWDAuTTVSQWRWU2d5dDRSOEVLcFB4SVQtNFdyUDJBSk5taFZTTFk5dDdzaFpUR0kzZF9kWkxPNzlGd1M1cWYyRzktRmtGd3NhRnpBWG5qaUl6c2QyeENFZjZzQ20zYlcwcHg3NkZDRnliNHpDVncxcURmNnNSMVhETW9WRDQwcnYwSnhzaGdfN0I2Q2R2ci1FQ1JJbWdNTmFGdC02NEZBZzFOdlc5TExuNzB3blItOUlFUUpTWEJVVkhHUmhXZW9sQ2RCVElUV1RXcTJzbkhkWkxRaUhIN2I5ekJkYmszRjV3VDdCeWZtUVRBU1NEeVVpYnZVRWxxZzVPekVzQUVSWnU0UGpiVk9CLTZoakVFS2FQeGYxcGxWNFF6X1l2ZnpvbDdPUlk4SVljMlFxMDNjY0pQSWYweTFXenZ0T2ZCVERXVnJOMEhzekRoeUpmSGt0Ui1idU9YTjRR';

    const robloxResponse = await axios.post(
      `https://apis.roblox.com/messaging-service/v1/universes/${UNIVERSE_ID}/topics/DiscordAction`,
      { user, action, duration },
      {
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Erfolgreich an Roblox gesendet:', robloxResponse.status);
    res.status(200).json({ message: 'Aktion ausgeführt.' });

  } catch (error) {
    console.error('❌ Fehler beim Senden an Roblox:', error.message);
    res.status(500).json({ error: 'Fehler beim Senden an Roblox.' });
  }
});

// Für Render: auf 0.0.0.0 binden
app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server läuft auf Port ${port}`);
});
