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
    const UNIVERSE_ID = 'DEINE_UNIVERSE_ID';
    const API_KEY = 'DEIN_API_KEY';

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
