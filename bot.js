require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
          .setColor(0x00ff00)
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
        .setColor(isBanned ? 0xff0000 : 0x00ff00)
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

    // Ban, TempBan, Unban, Kick Kommandos verarbeiten:
    if (['ban', 'tempban', 'unban', 'kick'].includes(commandName)) {
      const robloxUserName = interaction.options.getString('user');
      if (!robloxUserName) return interaction.editReply('⚠️ Kein Roblox-Benutzername angegeben.');

      const userId = await getRobloxUserId(robloxUserName);
      if (!userId) return interaction.editReply(`❌ Roblox-Benutzer **${robloxUserName}** wurde nicht gefunden.`);

      if (commandName === 'ban') {
        bannedUsers.set(robloxUserName.toLowerCase(), 'Permanent gebannt');
        await sendAction(userId, 'ban');
        const embed = new EmbedBuilder()
          .setTitle('🚫 Permanent gebannt')
          .setDescription(`Der Roblox-Nutzer **${robloxUserName}** wurde permanent gebannt.`)
          .setColor(0xff0000)
          .setTimestamp();
        if (logChannel) await logChannel.send({ embeds: [embed] });
        return interaction.editReply({ embeds: [embed] });
      }

      if (commandName === 'tempban') {
        const duration = interaction.options.getString('dauer');
        bannedUsers.set(robloxUserName.toLowerCase(), `Temporär gebannt für ${duration}`);
        await sendAction(userId, 'tempban', duration);
        const embed = new EmbedBuilder()
          .setTitle('⏳ Temporär gebannt')
          .setDescription(`Der Roblox-Nutzer **${robloxUserName}** wurde temporär gebannt für: **${duration}**.`)
          .setColor(0xff9900)
          .setTimestamp();
        if (logChannel) await logChannel.send({ embeds: [embed] });
        return interaction.editReply({ embeds: [embed] });
      }

      if (commandName === 'unban') {
        if (!bannedUsers.has(robloxUserName.toLowerCase())) {
          return interaction.editReply(`ℹ️ Roblox-Nutzer **${robloxUserName}** ist nicht gebannt.`);
        }
        bannedUsers.delete(robloxUserName.toLowerCase());
        await sendAction(userId, 'unban');
        const embed = new EmbedBuilder()
          .setTitle('🔓 Entbannt')
          .setDescription(`Der Roblox-Nutzer **${robloxUserName}** wurde entbannt.`)
          .setColor(0x00ff00)
          .setTimestamp();
        if (logChannel) await logChannel.send({ embeds: [embed] });
        return interaction.editReply({ embeds: [embed] });
      }

      if (commandName === 'kick') {
        await sendAction(userId, 'kick');
        const embed = new EmbedBuilder()
          .setTitle('👢 Gekickt')
          .setDescription(`Der Roblox-Nutzer **${robloxUserName}** wurde aus dem Spiel gekickt.`)
          .setColor(0xffff00)
          .setTimestamp();
        if (logChannel) await logChannel.send({ embeds: [embed] });
        return interaction.editReply({ embeds: [embed] });
      }
    }
  } catch (error) {
    console.error('Fehler bei Command-Verarbeitung:', error);
    return interaction.editReply('❌ Ein Fehler ist aufgetreten. Bitte versuche es später erneut.');
  }
});

client.login(process.env.DISCORD_TOKEN);

// Express-Webserver zum Offenhalten des Bots (optional)
const app = express();
app.get('/', (req, res) => res.send('Bot läuft...'));
app.listen(process.env.PORT || 3000);
