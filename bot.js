require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const express = require('express'); // Webserver hinzufügen

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const LOG_CHANNEL_ID = '1373777502073389219';
const GUILD_ID = '1361770059575591143';
const OWNER_IDS = ['1079510826651758713', '1098314958900568094'];
let allowedUsers = new Set(OWNER_IDS);

const commands = [
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannt einen Roblox-Spieler permanent.')
    .addStringOption(option =>
      option.setName('user').setDescription('Roblox-Benutzername').setRequired(true)),
  new SlashCommandBuilder()
    .setName('tempban')
    .setDescription('Bannt einen Roblox-Spieler temporär.')
    .addStringOption(option =>
      option.setName('user').setDescription('Roblox-Benutzername').setRequired(true))
    .addStringOption(option =>
      option.setName('dauer').setDescription('Dauer des Banns (z.B. 1d, 2h)').setRequired(true)),
  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Entbannt einen Roblox-Spieler.')
    .addStringOption(option =>
      option.setName('user').setDescription('Roblox-Benutzername').setRequired(true)),
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kickt einen Roblox-Spieler aus dem Spiel.')
    .addStringOption(option =>
      option.setName('user').setDescription('Roblox-Benutzername').setRequired(true)),
  new SlashCommandBuilder()
    .setName('add')
    .setDescription('Fügt einen Benutzer zur Berechtigungsliste hinzu.')
    .addUserOption(option =>
      option.setName('user').setDescription('Discord-Nutzer').setRequired(true)),
  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Entfernt einen Benutzer aus der Berechtigungsliste.')
    .addUserOption(option =>
      option.setName('user').setDescription('Discord-Nutzer').setRequired(true))
].map(command => command.toJSON());

client.once('ready', async () => {
  console.log(`✅ Bot ist online als ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log('🔄 Registriere Slash-Commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash-Commands registriert.');
  } catch (error) {
    console.error('❌ Fehler beim Registrieren:', error);
  }
});

async function getRobloxUserInfo(username) {
  try {
    const res = await axios.post('https://users.roblox.com/v1/usernames/users', {
      usernames: [username],
      excludeBannedUsers: false
    });
    return res.data.data[0];
  } catch (error) {
    return null;
  }
}

async function sendAction(user, action, duration = null) {
  const payload = { user, action };
  if (duration) payload.duration = duration;
  await axios.post(process.env.API_URL, payload);
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.channel.type === 1)
    return interaction.reply({ content: '❌ Diese Commands können nicht in DMs verwendet werden.', ephemeral: true });

  const { commandName, user } = interaction;
  const username = interaction.options.getString('user');
  const duration = interaction.options.getString('dauer');
  const targetUser = interaction.options.getUser('user');
  const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);

  if (!OWNER_IDS.includes(user.id) && !allowedUsers.has(user.id)) {
    return interaction.reply({ content: '❌ Zugriff verweigert. Du bist nicht berechtigt, diesen Command zu nutzen.', ephemeral: true });
  }

  if (['add', 'remove'].includes(commandName) && !OWNER_IDS.includes(user.id)) {
    return interaction.reply({ content: '❌ Nur System-Administratoren dürfen diesen Command verwenden.', ephemeral: true });
  }

  try {
    await interaction.deferReply();

    if (commandName === 'add') {
      allowedUsers.add(targetUser.id);
      return interaction.editReply(`✅ ${targetUser.tag} wurde zur Whitelist hinzugefügt.`);
    }

    if (commandName === 'remove') {
      allowedUsers.delete(targetUser.id);
      return interaction.editReply(`✅ ${targetUser.tag} wurde von der Whitelist entfernt.`);
    }

    if (!username) return interaction.editReply('⚠️ Kein Benutzername angegeben.');

    const robloxUser = await getRobloxUserInfo(username);
    const robloxId = robloxUser?.id ?? 'unbekannt';
    const robloxProfile = robloxUser ? `https://www.roblox.com/users/${robloxId}/profile` : 'Nicht gefunden';
    const avatar = robloxUser ? `https://www.roblox.com/headshot-thumbnail/image?userId=${robloxId}&width=150&height=150&format=png` : null;

    await sendAction(username, commandName, duration);

    const successMsg = `✅ **${commandName.toUpperCase()}** für **${username}** wurde ausgeführt von ${user.tag}`;
    await interaction.editReply(successMsg);

    if (logChannel) {
      logChannel.send({
        embeds: [
          {
            title: `🛠️ Aktion: ${commandName.toUpperCase()}`,
            description: `👤 Roblox-Name: **${username}**\n🔗 [Zum Profil](${robloxProfile})\n🧑‍💻 Ausgeführt von: ${user.tag}`,
            thumbnail: avatar ? { url: avatar } : undefined,
            color: 0xff0000,
            footer: { text: 'Roblox-Moderation via Discord' },
            timestamp: new Date().toISOString()
          }
        ]
      });
    }
  } catch (err) {
    await interaction.editReply('❌ Fehler beim Ausführen der Aktion.');
    if (logChannel) {
      logChannel.send({
        embeds: [
          {
            title: '⚠️ FEHLER BEI COMMAND',
            description: `👤 Roblox-Name: **${username}**\n❌ Fehler: \`${err.response?.data?.error || err.message}\`\n🧑‍💻 Von: ${user.tag}`,
            color: 0xff3300,
            timestamp: new Date().toISOString()
          }
        ]
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

// =====================
// Webserver für Render
// =====================
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('✅ Der Discord-Bot läuft.');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Webserver läuft auf Port ${PORT}`);
});
