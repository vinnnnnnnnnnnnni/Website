require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const express = require('express');
const fs = require('fs');
const path = require('path');

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

const whitelistPath = path.join(__dirname, 'whitelist.json');

// Whitelist aus Datei laden oder neue erstellen
let allowedUsers = new Set();
try {
  const data = fs.readFileSync(whitelistPath, 'utf8');
  const parsed = JSON.parse(data);
  allowedUsers = new Set(parsed);
} catch {
  allowedUsers = new Set(OWNER_IDS);
  saveWhitelist();
}

function saveWhitelist() {
  fs.writeFileSync(whitelistPath, JSON.stringify([...allowedUsers], null, 2));
}

// Beispielhafte Datenstruktur für gebannte Roblox-User
const bannedUsers = new Map([
  ['banneduser123', 'Permanent gebannt'],
  ['tempbanneduser', 'Temporär gebannt bis 2025-06-01'],
]);

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
    .setDescription('Fügt einen Benutzer zur Whitelist hinzu.')
    .addUserOption(option =>
      option.setName('user').setDescription('Discord-Nutzer').setRequired(true)),
  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Entfernt einen Benutzer aus der Whitelist.')
    .addUserOption(option =>
      option.setName('user').setDescription('Discord-Nutzer').setRequired(true)),
  new SlashCommandBuilder()
    .setName('view')
    .setDescription('Zeigt alle Benutzer in der Whitelist an.'),
  new SlashCommandBuilder()
    .setName('viewroblox')
    .setDescription('Zeigt Informationen zu einem Roblox-Benutzer an.')
    .addStringOption(option =>
      option.setName('robloxuser').setDescription('Roblox-Benutzername').setRequired(true)),
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

// Roblox API - User ID holen
async function getRobloxUserId(username) {
  try {
    const res = await axios.post('https://users.roblox.com/v1/usernames/users', {
      usernames: [username],
      excludeBannedUsers: false
    });
    return res.data.data.length ? res.data.data[0].id : null;
  } catch {
    return null;
  }
}

// Roblox Thumbnail API für Avatarbild
async function getRobloxAvatarUrl(userId) {
  try {
    const res = await axios.get('https://thumbnails.roblox.com/v1/users/avatar', {
      params: {
        userIds: userId,
        size: '150x150',
        format: 'Png',
        isCircular: true
      }
    });
    return res.data.data.length ? res.data.data[0].imageUrl : null;
  } catch {
    return null;
  }
}

// Dummy-Funktion für externe API-Aktion
async function sendAction(user, action, duration = null) {
  // Beispiel: await axios.post(process.env.API_URL, { user, action, duration });
  return; // Dummy
}

// Prüfen, ob ein Spieler im Spiel ist (basierend auf PlaceId)
async function isPlayerInGame(userId, placeId) {
  try {
    // Beispielhafte API, muss ggf. angepasst werden
    const res = await axios.get(`https://games.roblox.com/v1/games/${placeId}/servers/active`);
    if (!res.data.data) return false;

    for (const server of res.data.data) {
      if (server.playing.includes(userId)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.channel.type === 1) // DMs
    return interaction.reply({ content: '❌ Diese Commands können nicht in DMs verwendet werden.', ephemeral: true });

  const { commandName, user } = interaction;

  // Berechtigungen prüfen
  if (!OWNER_IDS.includes(user.id) && !allowedUsers.has(user.id)) {
    return interaction.reply({ content: '❌ Zugriff verweigert. Du bist nicht berechtigt, diesen Command zu nutzen.', ephemeral: true });
  }
  if (['add', 'remove'].includes(commandName) && !OWNER_IDS.includes(user.id)) {
    return interaction.reply({ content: '❌ Nur System-Administratoren dürfen diesen Command verwenden.', ephemeral: true });
  }

  const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);

  try {
    await interaction.deferReply({ ephemeral: false }); // Jeder sieht die Antwort

    if (commandName === 'add') {
      const targetUser = interaction.options.getUser('user');
      if (!targetUser) return interaction.editReply('⚠️ Kein Benutzer angegeben.');

      if (allowedUsers.has(targetUser.id)) {
        return interaction.editReply(`❗️ ${targetUser.tag} ist bereits in der Whitelist.`);
      }

      allowedUsers.add(targetUser.id);
      saveWhitelist();

      const embed = new EmbedBuilder()
        .setTitle('➕ Zur Whitelist hinzugefügt')
        .setDescription(`👤 [${targetUser.tag}](https://discord.com/users/${targetUser.id}) wurde zur Whitelist hinzugefügt.`)
        .setColor(0x00ff00)
        .setTimestamp();

      if (logChannel) await logChannel.send({ embeds: [embed] });
      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === 'remove') {
      const targetUser = interaction.options.getUser('user');
      if (!targetUser) return interaction.editReply('⚠️ Kein Benutzer angegeben.');

      if (OWNER_IDS.includes(targetUser.id)) {
        return interaction.editReply('❌ Du kannst einen Owner nicht aus der Whitelist entfernen.');
      }

      if (!allowedUsers.has(targetUser.id)) {
        return interaction.editReply(`❗️ ${targetUser.tag} ist nicht in der Whitelist.`);
      }

      allowedUsers.delete(targetUser.id);
      saveWhitelist();

      const embed = new EmbedBuilder()
        .setTitle('➖ Von Whitelist entfernt')
        .setDescription(`👤 [${targetUser.tag}](https://discord.com/users/${targetUser.id}) wurde von der Whitelist entfernt.`)
        .setColor(0xff0000)
        .setTimestamp();

      if (logChannel) await logChannel.send({ embeds: [embed] });
      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === 'view') {
      const embed = new EmbedBuilder()
        .setTitle('🔐 Whitelist-Mitglieder')
        .setColor(0x0099ff)
        .setTimestamp();

      // Owner und Moderatoren trennen
      const owners = [];
      const moderators = [];

      for (const id of allowedUsers) {
        try {
          const member = await client.users.fetch(id);
          const profileLink = `[${member.tag}](https://discord.com/users/${member.id})`;

          const line = `${profileLink} — Rang: **${OWNER_IDS.includes(id) ? 'Owner' : 'Moderator'}**`;

          if (OWNER_IDS.includes(id)) {
            owners.push(line);
          } else {
            moderators.push(line);
          }
        } catch {
          if (OWNER_IDS.includes(id)) {
            owners.push(`❓ <@${id}> — Owner`);
          } else {
            moderators.push(`❓ <@${id}> — Moderator`);
          }
        }
      }

      let description = '';
      if (owners.length > 0) {
        description += '**------ Owner:**\n' + owners.join('\n') + '\n\n';
      }
      if (moderators.length > 0) {
        description += '**------ Moderatoren:**\n' + moderators.join('\n');
      }
      if (description === '') {
        description = 'Keine Whitelist-Mitglieder gefunden.';
      }

      embed.setDescription(description);
      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === 'viewroblox') {
      const robloxUserName = interaction.options.getString('robloxuser');
      if (!robloxUserName) return interaction.editReply('⚠️ Kein Roblox-Benutzername angegeben.');

      const userId = await getRobloxUserId(robloxUserName);
      if (!userId) {
        return interaction.editReply(`❌ Roblox-Benutzer **${robloxUserName}** wurde nicht gefunden.`);
      }

      const avatarUrl = await getRobloxAvatarUrl(userId);
      const profileUrl = `https://www.roblox.com/users/${userId}/profile`;

      const banStatus = bannedUsers.has(robloxUserName.toLowerCase())
        ? `🚫 Status: **${bannedUsers.get(robloxUserName.toLowerCase())}**`
        : '✅ Status: **Nicht gebannt**';

      const embed = new EmbedBuilder()
        .setTitle(`Roblox User: ${robloxUserName}`)
        .setURL(profileUrl)
        .setDescription(`[Profil ansehen](${profileUrl})\n\n${banStatus}`)
        .setColor(0x00ff00)
        .setTimestamp();

      if (avatarUrl) {
        embed.setThumbnail(avatarUrl);
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // Ban, Tempban, Unban, Kick Commands
    if (['ban', 'tempban', 'unban', 'kick'].includes(commandName)) {
      const username = interaction.options.getString('user');
      if (!username) return interaction.editReply('⚠️ Kein Benutzername angegeben.');

      const duration = interaction.options.getString('dauer');
      const robloxUserId = await getRobloxUserId(username);

      if (!robloxUserId) {
        return interaction.editReply(`❌ Roblox-Benutzer **${username}** wurde nicht gefunden.`);
      }

      if (commandName === 'kick') {
        const placeId = 118073884989892; // <- DEINE PLACE ID HIER EINGEFÜGT

        const ingame = await isPlayerInGame(robloxUserId, placeId);
        if (!ingame) {
          return interaction.editReply(`❌ ${username} ist derzeit nicht im Spiel und kann nicht gekickt werden.`);
        }
      }

      await sendAction(username, commandName, duration);

      const robloxProfile = `https://www.roblox.com/users/${robloxUserId}/profile`;
      const avatarUrl = await getRobloxAvatarUrl(robloxUserId);

      const successEmbed = new EmbedBuilder()
        .setTitle(`✅ ${commandName.toUpperCase()} ausgeführt`)
        .setDescription(`👤 Roblox: **${username}**\n🔗 [Profil](${robloxProfile})\n🧑‍💻 Von: ${user.tag}`)
        .setColor(0xff0000)
        .setTimestamp();

      if (avatarUrl) {
        successEmbed.setThumbnail(avatarUrl);
      }

      if (logChannel) await logChannel.send({ embeds: [successEmbed] });
      return interaction.editReply({ embeds: [successEmbed] });
    }

  } catch (err) {
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Fehler bei Ausführung')
      .setDescription(`❌ Fehler: \`${err.message || err}\`\n🧑‍💻 Von: ${user.tag}`)
      .setColor(0xff0000)
      .setTimestamp();

    if (logChannel) await logChannel.send({ embeds: [errorEmbed] });
    return interaction.editReply({ embeds: [errorEmbed] });
  }
});

client.login(process.env.DISCORD_TOKEN);

// Express Webserver für Statusseite
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('✅ Der Discord-Bot läuft.');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Webserver läuft auf Port ${PORT}`);
});
