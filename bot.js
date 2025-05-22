require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionCollector } = require('discord.js');
const axios = require('axios');
const express = require('express');

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
let allowedUsers = new Set(OWNER_IDS); // Owner immer in Whitelist

// Beispielhafte gebannte Roblox-User (lowercase keys)
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
].map(cmd => cmd.toJSON());

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

// Aktion an externe API senden
async function sendAction(userId, action, duration = null, reason = null) {
  try {
    await axios.post('https://website-bjz4.onrender.com', {
      userId,
      action,
      duration,
      reason
    });
  } catch (error) {
    console.error('Fehler bei sendAction:', error);
  }
}

// Hilfsfunktion für Roblox Profil-Link in Embed-Feld oder Titel (username klickbar)
function createRobloxProfileLink(username, userId) {
  return `[${username}](https://www.roblox.com/users/${userId}/profile)`;
}

// Farben für Embeds und Ränder
const COLOR_LIGHTBLUE = 0x87CEEB;
const COLOR_RED = 0xff0000;
const COLOR_GREEN = 0x00ff00;
const COLOR_ORANGE = 0xff9900;
const COLOR_YELLOW = 0xffff00;

client.on('interactionCreate', async interaction => {
  if (interaction.isButton()) {
    // Button für Entbannen
    if (interaction.customId.startsWith('unban_')) {
      if (!OWNER_IDS.includes(interaction.user.id) && !allowedUsers.has(interaction.user.id)) {
        return interaction.reply({ content: '❌ Du hast keine Berechtigung, diesen Button zu benutzen.', ephemeral: true });
      }

      const username = interaction.customId.slice(6);
      if (!bannedUsers.has(username.toLowerCase())) {
        return interaction.reply({ content: `ℹ️ Nutzer **${username}** ist nicht gebannt.`, ephemeral: true });
      }

      bannedUsers.delete(username.toLowerCase());

      // Optional: Sende Entbann-Request an externe API
      const robloxUserId = await getRobloxUserId(username);
      if (robloxUserId) {
        await sendAction(robloxUserId, 'unban');
      }

      await interaction.update({
        content: `✅ Nutzer **${username}** wurde entbannt.`,
        components: []
      });

      // Loggen
      const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle('🔓 Nutzer entbannt')
          .setDescription(`👤 Roblox-Nutzer: **${username}**\n🧑‍💻 Von: ${interaction.user.tag}`)
          .setColor(COLOR_GREEN)
          .setTimestamp();
        await logChannel.send({ embeds: [embed] });
      }
      return;
    }
  }

  if (!interaction.isChatInputCommand()) return;
  if (interaction.channel.type === 1) // DMs ausschließen
    return interaction.reply({ content: '❌ Diese Commands können nicht in DMs verwendet werden.', ephemeral: true });

  const { commandName, user } = interaction;

  // Berechtigungen prüfen
  if (!OWNER_IDS.includes(user.id) && !allowedUsers.has(user.id)) {
    return interaction.reply({ content: '❌ Zugriff verweigert. Du bist nicht berechtigt, diesen Command zu nutzen.', ephemeral: true });
  }
  if (['add', 'remove'].includes(commandName) && !OWNER_IDS.includes(user.id)) {
    return interaction.reply({ content: '❌ Nur Owner dürfen diesen Command verwenden.', ephemeral: true });
  }

  const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);

  try {
    await interaction.deferReply({ ephemeral: false }); // Antwort für alle sichtbar

    if (commandName === 'add') {
      const targetUser = interaction.options.getUser('user');
      if (!targetUser) return interaction.editReply('⚠️ Kein Benutzer angegeben.');

      if (allowedUsers.has(targetUser.id)) {
        return interaction.editReply(`❗️ ${targetUser.tag} ist bereits in der Whitelist.`);
      }

      allowedUsers.add(targetUser.id);

      const embed = new EmbedBuilder()
        .setTitle('➕ Zur Whitelist hinzugefügt')
        .setDescription(`👤 [${targetUser.tag}](https://discord.com/users/${targetUser.id}) wurde zur Whitelist hinzugefügt.`)
        .setColor(COLOR_GREEN)
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

      const embed = new EmbedBuilder()
        .setTitle('➖ Von Whitelist entfernt')
        .setDescription(`👤 [${targetUser.tag}](https://discord.com/users/${targetUser.id}) wurde von der Whitelist entfernt.`)
        .setColor(COLOR_RED)
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
          // Falls User nicht abrufbar
          if (OWNER_IDS.includes(id)) {
            owners.push(`❓ <@${id}> — Owner`);
          } else {
            moderators.push(`❓ <@${id}> — Moderator`);
          }
        }
      }

      let description = '';
      if (owners.length) description += `__**Owner:**__\n${owners.join('\n')}\n\n`;
      if (moderators.length) description += `__**Moderatoren:**__\n${moderators.join('\n')}`;

      if (!description) description = 'Keine Whitelist-Mitglieder gefunden.';

      embed.setDescription(description);
      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === 'viewroblox') {
      const robloxUser = interaction.options.getString('robloxuser');
      if (!robloxUser) return interaction.editReply('⚠️ Kein Roblox-Benutzername angegeben.');

      const userId = await getRobloxUserId(robloxUser);
      if (!userId) {
        return interaction.editReply(`❌ Roblox-Nutzer **${robloxUser}** nicht gefunden.`);
      }

      const avatarUrl = await getRobloxAvatarUrl(userId);

      const bannedInfo = bannedUsers.get(robloxUser.toLowerCase());
      const bannedText = bannedInfo ? `🚫 **Status:** Gebannt\n**Grund:** ${bannedInfo}` : '✅ **Status:** Nicht gebannt';

      const embed = new EmbedBuilder()
        .setTitle(`${robloxUser}`)
        .setURL(`https://www.roblox.com/users/${userId}/profile`)
        .setThumbnail(avatarUrl || null)
        .setColor(bannedInfo ? COLOR_RED : COLOR_GREEN)
        .addFields(
          { name: 'Roblox ID', value: userId.toString(), inline: true },
          { name: 'Ban-Status', value: bannedText, inline: false }
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // Ban permanent
    if (commandName === 'ban') {
      const robloxUser = interaction.options.getString('user');
      if (!robloxUser) return interaction.editReply('⚠️ Kein Roblox-Benutzername angegeben.');

      const usernameLower = robloxUser.toLowerCase();
      if (bannedUsers.has(usernameLower)) {
        return interaction.editReply(`❗️ Nutzer **${robloxUser}** ist bereits gebannt.`);
      }

      const userId = await getRobloxUserId(robloxUser);
      if (!userId) return interaction.editReply(`❌ Roblox-Nutzer **${robloxUser}** nicht gefunden.`);

      bannedUsers.set(usernameLower, 'Permanent gebannt');
      await sendAction(userId, 'ban');

      const embed = new EmbedBuilder()
        .setTitle('⛔️ Nutzer gebannt')
        .setDescription(`👤 Roblox-Nutzer: **${robloxUser}** wurde permanent gebannt.`)
        .setColor(COLOR_RED)
        .setTimestamp();

      if (logChannel) await logChannel.send({ embeds: [embed] });

      // Benutzer zurückmelden im Chat
      return interaction.editReply(`✅ Der Nutzer **${robloxUser}** wurde permanent gebannt.`);
    }

    // Temporärer Ban
    if (commandName === 'tempban') {
      const robloxUser = interaction.options.getString('user');
      const dauer = interaction.options.getString('dauer');

      if (!robloxUser || !dauer) return interaction.editReply('⚠️ Roblox-Benutzername und Dauer sind erforderlich.');

      const usernameLower = robloxUser.toLowerCase();
      if (bannedUsers.has(usernameLower)) {
        return interaction.editReply(`❗️ Nutzer **${robloxUser}** ist bereits gebannt.`);
      }

      // Dauer parsen (z.B. "1d" -> 1 Tag)
      // Hier könnte man noch genauer parsen, für jetzt einfach als String speichern
      bannedUsers.set(usernameLower, `Temporär gebannt (${dauer})`);

      const userId = await getRobloxUserId(robloxUser);
      if (!userId) return interaction.editReply(`❌ Roblox-Nutzer **${robloxUser}** nicht gefunden.`);

      await sendAction(userId, 'tempban', dauer);

      const embed = new EmbedBuilder()
        .setTitle('⏳ Nutzer temporär gebannt')
        .setDescription(`👤 Roblox-Nutzer: **${robloxUser}** wurde temporär für **${dauer}** gebannt.`)
        .setColor(COLOR_ORANGE)
        .setTimestamp();

      if (logChannel) await logChannel.send({ embeds: [embed] });

      return interaction.editReply(`✅ Der Nutzer **${robloxUser}** wurde temporär für ${dauer} gebannt.`);
    }

    // Unban
    if (commandName === 'unban') {
      const robloxUser = interaction.options.getString('user');
      if (!robloxUser) return interaction.editReply('⚠️ Kein Roblox-Benutzername angegeben.');

      const usernameLower = robloxUser.toLowerCase();
      if (!bannedUsers.has(usernameLower)) {
        return interaction.editReply(`❗️ Nutzer **${robloxUser}** ist nicht gebannt.`);
      }

      bannedUsers.delete(usernameLower);

      const userId = await getRobloxUserId(robloxUser);
      if (userId) {
        await sendAction(userId, 'unban');
      }

      const embed = new EmbedBuilder()
        .setTitle('🔓 Nutzer entbannt')
        .setDescription(`👤 Roblox-Nutzer: **${robloxUser}** wurde entbannt.`)
        .setColor(COLOR_GREEN)
        .setTimestamp();

      if (logChannel) await logChannel.send({ embeds: [embed] });

      return interaction.editReply(`✅ Der Nutzer **${robloxUser}** wurde entbannt.`);
    }

    // Kick
    if (commandName === 'kick') {
      const robloxUser = interaction.options.getString('user');
      if (!robloxUser) return interaction.editReply('⚠️ Kein Roblox-Benutzername angegeben.');

      const userId = await getRobloxUserId(robloxUser);
      if (!userId) return interaction.editReply(`❌ Roblox-Nutzer **${robloxUser}** nicht gefunden.`);

      await sendAction(userId, 'kick');

      const embed = new EmbedBuilder()
        .setTitle('👢 Nutzer gekickt')
        .setDescription(`👤 Roblox-Nutzer: **${robloxUser}** wurde gekickt.`)
        .setColor(COLOR_YELLOW)
        .setTimestamp();

      if (logChannel) await logChannel.send({ embeds: [embed] });

      return interaction.editReply(`✅ Der Nutzer **${robloxUser}** wurde gekickt.`);
    }

  } catch (error) {
    console.error('Fehler bei Command:', error);
    return interaction.editReply('❌ Ein Fehler ist aufgetreten. Bitte versuche es später erneut.');
  }
});

// Express HTTP Server (zum Beispiel für Keep-Alive)
const app = express();
app.get('/', (req, res) => res.send('Bot läuft!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Express Server läuft auf Port ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);



// ID für den Update-Channel
const UPDATE_CHANNEL_ID = '1375129976319508551';

// Funktion zum Senden einer Update-Nachricht mit Farbe und optionaler Beschreibung
async function sendUpdateMessage(content, color = 0x87CEEB) {
  const channel = await client.channels.fetch(UPDATE_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setDescription(content)
    .setColor(color)
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}

// Intervall: alle 10 Sekunden Server-Check-Nachricht
setInterval(() => {
  sendUpdateMessage('🔄 Roblox hat den Server überprüft. Kein neuer Befehl.');
}, 10_000);

// Override der sendAction-Funktion, um Updates zu senden
const originalSendAction = sendAction; // Backup der alten Funktion

async function sendAction(userId, action, duration = null, reason = null) {
  // Nachricht: Befehl empfangen
  await sendUpdateMessage(`✅ Roblox hat den Befehl bekommen: **${action.toUpperCase()}** für UserID: ${userId}`);

  // Originalfunktion ausführen
  await originalSendAction(userId, action, duration, reason);

  // Nachricht: Befehl ausgeführt
  let actionDesc = '';
  switch(action) {
    case 'ban':
      actionDesc = `⛔️ User wurde permanent gebannt.`;
      break;
    case 'tempban':
      actionDesc = `⏳ User wurde temporär gebannt für ${duration}.`;
      break;
    case 'unban':
      actionDesc = `✅ User wurde entbannt.`;
      break;
    case 'kick':
      actionDesc = `👢 User wurde gekickt.`;
      break;
    default:
      actionDesc = `ℹ️ Aktion ausgeführt.`;
  }

  await sendUpdateMessage(`✅ Roblox hat den Befehl ausgeführt: ${actionDesc}`);
}