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
      if (owners.length > 0) {
        description += '**--- Owner ---**\n' + owners.join('\n') + '\n\n';
      }
      if (moderators.length > 0) {
        description += '**--- Moderatoren ---**\n' + moderators.join('\n');
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

      const isBanned = bannedUsers.has(robloxUserName.toLowerCase());
      const banReason = isBanned ? bannedUsers.get(robloxUserName.toLowerCase()) : null;

      const embed = new EmbedBuilder()
        .setTitle(`Roblox User: ${robloxUserName}`)
        .setURL(profileUrl)
        .setDescription(`[Profil auf Roblox](${profileUrl})`)
        .setColor(isBanned ? COLOR_RED : COLOR_GREEN)
        .setTimestamp();

      if (avatarUrl) embed.setThumbnail(avatarUrl);

      embed.addFields(
        {
          name: 'Status',
          value: isBanned ? `🚫 Gebannt: ${banReason}` : '✅ Nicht gebannt',
          inline: false,
        }
      );

      let components = [];

      if (isBanned) {
        // Button zum Entbannen mit Benutzername im customId
        const unbanBtn = new ButtonBuilder()
          .setCustomId(`unban_${robloxUserName}`)
          .setLabel('Entbannen')
          .setStyle(ButtonStyle.Success);
        components.push(new ActionRowBuilder().addComponents(unbanBtn));
      }

      return interaction.editReply({ embeds: [embed], components });
    }

    // Funktionen für Ban, TempBan, Unban, Kick: mit Bestätigung via Button und 30s Zeitfenster
    if (['ban', 'tempban', 'unban', 'kick'].includes(commandName)) {
      const robloxUserName = interaction.options.getString('user');
      if (!robloxUserName) return interaction.editReply('⚠️ Kein Roblox-Benutzername angegeben.');

      const robloxUserId = await getRobloxUserId(robloxUserName);
      if (!robloxUserId) {
        return interaction.editReply(`❌ Roblox-Benutzer **${robloxUserName}** wurde nicht gefunden.`);
      }

      // Action specific data
      let actionName = commandName;
      let duration = null;
      if (commandName === 'tempban') {
        duration = interaction.options.getString('dauer');
        if (!duration) return interaction.editReply('⚠️ Bitte gib eine Dauer für den temporären Bann an.');
      }

      // Embed-Farben und Button-Label
      let embedColor = COLOR_LIGHTBLUE;
      let buttonLabel = '';
      let buttonStyle = ButtonStyle.Primary;
      if (commandName === 'ban') {
        buttonLabel = 'Permanent bannen';
        embedColor = COLOR_LIGHTBLUE;
        buttonStyle = ButtonStyle.Danger;
      } else if (commandName === 'tempban') {
        buttonLabel = `Temporär bannen (${duration})`;
        embedColor = COLOR_LIGHTBLUE;
        buttonStyle = ButtonStyle.Danger;
      } else if (commandName === 'unban') {
        buttonLabel = 'Entbannen';
        embedColor = COLOR_LIGHTBLUE;
        buttonStyle = ButtonStyle.Success;
      } else if (commandName === 'kick') {
        buttonLabel = 'Kick durchführen';
        embedColor = COLOR_RED;
        buttonStyle = ButtonStyle.Danger;
      }

      const robloxProfileLink = createRobloxProfileLink(robloxUserName, robloxUserId);

      // Bestätigungs-Embed
      const confirmEmbed = new EmbedBuilder()
        .setTitle('⚠️ Bitte bestätigen')
        .setDescription(`Möchtest du den Roblox-Spieler **${robloxProfileLink}** wirklich ${buttonLabel}?`)
        .setColor(embedColor)
        .setTimestamp();

      const confirmButton = new ButtonBuilder()
        .setCustomId(`confirm_${commandName}_${robloxUserName}`)
        .setLabel(buttonLabel)
        .setStyle(buttonStyle);

      const cancelButton = new ButtonBuilder()
        .setCustomId(`cancel_${commandName}_${robloxUserName}`)
        .setLabel('Abbrechen')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

      const reply = await interaction.editReply({
        embeds: [confirmEmbed],
        components: [row],
      });

      // Button Collector - 30 Sekunden
      const filter = i => {
        return ['confirm_' + commandName + '_' + robloxUserName, 'cancel_' + commandName + '_' + robloxUserName].includes(i.customId)
          && i.user.id === interaction.user.id;
      };

      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30_000 });

      collector.on('collect', async i => {
        if (i.customId.startsWith('cancel_')) {
          await i.update({ content: '❌ Aktion abgebrochen.', embeds: [], components: [] });
          collector.stop('abgebrochen');
          return;
        }
        if (i.customId.startsWith('confirm_')) {
          // Aktion ausführen
          if (commandName === 'ban') {
            bannedUsers.set(robloxUserName.toLowerCase(), 'Permanent gebannt');
            await sendAction(robloxUserId, 'ban');
          } else if (commandName === 'tempban') {
            bannedUsers.set(robloxUserName.toLowerCase(), `Temporär gebannt (${duration})`);
            await sendAction(robloxUserId, 'tempban', duration);
          } else if (commandName === 'unban') {
            bannedUsers.delete(robloxUserName.toLowerCase());
            await sendAction(robloxUserId, 'unban');
          } else if (commandName === 'kick') {
            await sendAction(robloxUserId, 'kick');
          }

          // Erfolgsembed
          let successTitle = '';
          let successDesc = '';
          let successColor = COLOR_LIGHTBLUE;
          if (commandName === 'ban') {
            successTitle = '✅ Spieler permanent gebannt';
            successDesc = `Der Roblox-Spieler **${robloxProfileLink}** wurde permanent gebannt.`;
            successColor = COLOR_LIGHTBLUE;
          } else if (commandName === 'tempban') {
            successTitle = '✅ Spieler temporär gebannt';
            successDesc = `Der Roblox-Spieler **${robloxProfileLink}** wurde temporär für **${duration}** gebannt.`;
            successColor = COLOR_LIGHTBLUE;
          } else if (commandName === 'unban') {
            successTitle = '✅ Spieler entbannt';
            successDesc = `Der Roblox-Spieler **${robloxProfileLink}** wurde entbannt.`;
            successColor = COLOR_LIGHTBLUE;
          } else if (commandName === 'kick') {
            successTitle = '✅ Spieler gekickt';
            successDesc = `Der Roblox-Spieler **${robloxProfileLink}** wurde gekickt.`;
            successColor = COLOR_RED;
          }

          const successEmbed = new EmbedBuilder()
            .setTitle(successTitle)
            .setDescription(successDesc)
            .setColor(successColor)
            .setTimestamp();

          await i.update({ embeds: [successEmbed], components: [] });
          collector.stop('bestätigt');

          // Loggen
          if (logChannel) {
            let logEmbed = new EmbedBuilder()
              .setTitle(`📜 ${commandName.toUpperCase()} ausgeführt`)
              .setDescription(`👤 Roblox-Nutzer: **${robloxUserName}**\n🧑‍💻 Von: ${interaction.user.tag}`)
              .setTimestamp();

            // Farbe je nach Befehl
            if (commandName === 'kick') {
              logEmbed.setColor(COLOR_RED);
            } else if (commandName === 'unban') {
              logEmbed.setColor(COLOR_GREEN);
            } else {
              logEmbed.setColor(COLOR_LIGHTBLUE);
            }

            await logChannel.send({ embeds: [logEmbed] });
          }
        }
      });

      collector.on('end', (collected, reason) => {
        if (reason === 'time') {
          interaction.editReply({ content: '⏰ Zeit zum Bestätigen abgelaufen. Aktion wurde nicht ausgeführt.', embeds: [], components: [] });
        }
      });

      return;
    }
  } catch (error) {
    console.error(error);
    interaction.editReply('❌ Ein Fehler ist aufgetreten.');
  }
});

client.login(process.env.DISCORD_TOKEN);
 
// Express-Webserver zum Offenhalten des Bots (optional)
const app = express();
app.get('/', (req, res) => res.send('Bot läuft...'));
app.listen(process.env.PORT || 3000, () => console.log('🌐 Webserver läuft'));


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
