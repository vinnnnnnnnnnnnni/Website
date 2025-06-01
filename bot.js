require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  InteractionType,
  ChannelType,
} = require('discord.js');
const axios = require('axios');
const express = require('express');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: ['CHANNEL'],
});

const LOG_CHANNEL_ID = '1373777502073389219';
const GUILD_ID = '1361770059575591143';
const OWNER_IDS = ['1079510826651758713', '1098314958900568094'];
const UPDATE_CHANNEL_ID = '1375129976319508551';
const APPEAL_CHANNEL_ID = '1378716513233801276';
const INVITE_LINK = 'https://discord.gg/u9fmnzMFTs';

let allowedUsers = new Set(OWNER_IDS);
const bannedUsers = new Map(); // Roblox‐Bans
const appealCounts = new Map(); // Appeal‐Zähler

const commands = [
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannt einen Roblox-Spieler permanent.')
    .addStringOption(opt =>
      opt.setName('user').setDescription('Roblox-Benutzername').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('grund').setDescription('Grund für den Ban').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('tempban')
    .setDescription('Bannt einen Roblox-Spieler temporär.')
    .addStringOption(opt =>
      opt.setName('user').setDescription('Roblox-Benutzername').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('dauer').setDescription('Dauer (z.B. 1d, 2h)').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('grund').setDescription('Grund für den Tempban').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Entbannt einen Roblox-Spieler.')
    .addStringOption(opt =>
      opt.setName('user').setDescription('Roblox-Benutzername').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('grund').setDescription('Grund für den Unban').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kickt einen Roblox-Spieler aus dem Spiel.')
    .addStringOption(opt =>
      opt.setName('user').setDescription('Roblox-Benutzername').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('grund').setDescription('Grund für den Kick').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('add')
    .setDescription('Fügt einen Benutzer zur Whitelist hinzu.')
    .addUserOption(opt =>
      opt.setName('user').setDescription('Discord-Nutzer').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Entfernt einen Benutzer aus der Whitelist.')
    .addUserOption(opt =>
      opt.setName('user').setDescription('Discord-Nutzer').setRequired(true)
    ),

  new SlashCommandBuilder().setName('view').setDescription('Zeigt alle Benutzer in der Whitelist an.'),

  new SlashCommandBuilder()
    .setName('viewroblox')
    .setDescription('Zeigt Informationen zu einem Roblox-Benutzer an.')
    .addStringOption(opt =>
      opt.setName('robloxuser').setDescription('Roblox-Benutzername').setRequired(true)
    ),

  new SlashCommandBuilder().setName('donate').setDescription('Zeigt Infos, wie man spenden kann.'),

  new SlashCommandBuilder().setName('botmanual').setDescription('Zeigt alle verfügbaren Commands an.'),

  new SlashCommandBuilder()
    .setName('dc-ban')
    .setDescription('Bannt einen Discord-Nutzer vom Server (mit DM & Appeal).')
    .addUserOption(opt =>
      opt.setName('user').setDescription('Discord-Nutzer').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('grund').setDescription('Grund für den Bann').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('dc-kick')
    .setDescription('Kickt einen Discord-Nutzer vom Server (mit DM).')
    .addUserOption(opt =>
      opt.setName('user').setDescription('Discord-Nutzer').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('grund').setDescription('Grund für den Kick').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('dc-unbann')
    .setDescription('Entbannt einen Discord-Nutzer vom Server (mit DM).')
    .addUserOption(opt =>
      opt.setName('user').setDescription('Discord-Nutzer').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('grund').setDescription('Grund für den Unban').setRequired(true)
    ),
].map(cmd => cmd.toJSON());

const COLOR_LIGHTBLUE = 0x87ceeb;
const COLOR_RED = 0xff0000;
const COLOR_GREEN = 0x00ff00;
const COLOR_PURPLE = 0x800080;

async function getRobloxUserId(username) {
  try {
    const res = await axios.post('https://users.roblox.com/v1/usernames/users', {
      usernames: [username],
      excludeBannedUsers: false,
    });
    return res.data.data.length ? res.data.data[0].id : null;
  } catch {
    return null;
  }
}

async function getRobloxAvatarUrl(userId) {
  try {
    const res = await axios.get('https://thumbnails.roblox.com/v1/users/avatar', {
      params: { userIds: userId, size: '150x150', format: 'Png', isCircular: true },
    });
    return res.data.data.length ? res.data.data[0].imageUrl : null;
  } catch {
    return null;
  }
}

async function sendLogMessage(title, description, color = COLOR_LIGHTBLUE) {
  const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
  if (!logChannel) return;
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
  await logChannel.send({ embeds: [embed] });
}

const originalSendAction = async (userId, action, duration = null, reason = null) => {
  try {
    await axios.post('https://website-bjz4.onrender.com', {
      userId,
      action,
      duration,
      reason,
    });
  } catch (error) {
    console.error('Fehler bei sendAction:', error);
  }
};

async function sendAction(userId, action, duration = null, reason = null) {
  await sendLogMessage(`Roblox-API`, `Aktion: ${action.toUpperCase()} für UserID: ${userId}`, COLOR_LIGHTBLUE);
  await originalSendAction(userId, action, duration, reason);
}

client.once('ready', async () => {
  console.log(`✅ Bot ist online als ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Slash-Commands registriert.');
  } catch (error) {
    console.error('❌ Fehler beim Registrieren:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (
    !interaction.isChatInputCommand() &&
    !interaction.isButton() &&
    interaction.type !== InteractionType.ModalSubmit
  ) {
    return;
  }

  // ---------------------------------------------------
  // 1) Modal‐Handler für Discord‐Unban Appeal
  // ---------------------------------------------------
  if (interaction.type === InteractionType.ModalSubmit) {
    if (interaction.customId.startsWith('modal_unban_')) {
      const userId = interaction.customId.slice('modal_unban_'.length);
      const appealReason = interaction.fields.getTextInputValue('unban_reason');
      const appealChannel = await client.channels.fetch(APPEAL_CHANNEL_ID).catch(() => null);
      if (!appealChannel) {
        return interaction.reply({
          content: '❌ Appel-Kanal nicht gefunden.',
          flags: 64, // ephemeral
        });
      }
      const embedAppeal = new EmbedBuilder()
        .setTitle('🛡️ Ban-Appel erhalten')
        .setDescription(
          `👤 Benutzer: <@${userId}>\n` +
            `📝 Ban-Grund: ${bannedUsers.get(userId)?.reason || 'Unbekannt'}\n` +
            `📃 Appel-Grund: ${appealReason}`
        )
        .setColor(COLOR_PURPLE)
        .setTimestamp();
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`appeal_unban_${userId}`)
          .setLabel('Entbannen')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`appeal_deny_${userId}`)
          .setLabel('Ablehnen')
          .setStyle(ButtonStyle.Danger)
      );
      await appealChannel.send({ embeds: [embedAppeal], components: [row] });
      return interaction.reply({
        content: 'Dein Appel wurde eingereicht.',
        flags: 64,
      });
    }
  }

  // ---------------------------------------------------
  // 2) Button‐Handler (Ban/Unban/Appeal etc.)
  // ---------------------------------------------------
  if (interaction.isButton()) {
    const id = interaction.user.id;
    if (!OWNER_IDS.includes(id) && !allowedUsers.has(id)) {
      return interaction.reply({
        content: '❌ Keine Berechtigung.',
        flags: 64,
      });
    }

    // “Abbrechen”-Button für Ban/Tempban/Unban/Kick
    if (interaction.customId === 'cancel') {
      const title = interaction.message.embeds[0]?.title || 'Aktion';
      let actionType = 'Vorgang';
      if (title.includes('permanent bannen')) actionType = 'Ban';
      else if (title.includes('temporär bannen')) actionType = 'Tempban';
      else if (title.includes('entbannen')) actionType = 'Unban';
      else if (title.includes('kicken')) actionType = 'Kick';
      else if (title.includes('Discord-Bann')) actionType = 'Discord-Ban';
      const embed = new EmbedBuilder()
        .setTitle(`❌ ${actionType} abgebrochen`)
        .setDescription(
          `Der Nutzer wurde nicht ${
            actionType === 'Unban'
              ? 'entbannt'
              : actionType === 'Kick'
              ? 'gekickt'
              : 'gebannt'
          }.`
        )
        .setColor(COLOR_LIGHTBLUE)
        .setTimestamp();
      return interaction.update({ embeds: [embed], components: [] });
    }

    // Appeal “Entbannen”
    if (interaction.customId.startsWith('appeal_unban_')) {
      const targetId = interaction.customId.split('_')[2];
      const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
      if (guild) {
        // Tatsächliches Entbannen
        await guild.members.unban(targetId).catch(() => null);
        bannedUsers.delete(targetId);
        appealCounts.delete(targetId);
        const target = await client.users.fetch(targetId).catch(() => null);
        if (target) {
          target
            .send({
              embeds: [
                new EmbedBuilder()
                  .setTitle('✅ Du wurdest entbannt')
                  .setDescription(`Hier ist dein Einladungslink: ${INVITE_LINK}`)
                  .setColor(COLOR_GREEN)
                  .setTimestamp(),
              ],
            })
            .catch(() => null);
        }
        const embedResolved = new EmbedBuilder()
          .setTitle('✅ Appel genehmigt')
          .setDescription(`Benutzer <@${targetId}> wurde entbannt.`)
          .setColor(COLOR_GREEN)
          .setTimestamp();
        return interaction.update({ embeds: [embedResolved], components: [] });
      }
    }

    // Appeal “Ablehnen”
    if (interaction.customId.startsWith('appeal_deny_')) {
      const targetId = interaction.customId.split('_')[2];
      const count = appealCounts.get(targetId) || 0;
      const newCount = count + 1;
      appealCounts.set(targetId, newCount);
      const target = await client.users.fetch(targetId).catch(() => null);
      if (target) {
        if (newCount === 1) {
          target.send({ content: '❌ Dein Ban-Appel wurde abgelehnt.' }).catch(() => null);
        } else {
          target
            .send({
              content: '🚫 Du wirst nicht mehr entbannt und kannst nicht mehr appelen.',
            })
            .catch(() => null);
        }
      }
      const embedDenied = new EmbedBuilder()
        .setTitle(newCount === 1 ? '❌ Appel abgelehnt' : '🚫 Appel endgültig abgelehnt')
        .setDescription(`Benutzer <@${targetId}> wurde nicht entbannt.\nAnzahl Appel: ${newCount}`)
        .setColor(COLOR_RED)
        .setTimestamp();
      return interaction.update({ embeds: [embedDenied], components: [] });
    }

    // “Unban”-Button in /viewroblox
    if (interaction.customId.startsWith('view_unban_')) {
      const username = interaction.customId.slice('view_unban_'.length);
      const modal = new ModalBuilder()
        .setCustomId(`modal_unban_${username}`)
        .setTitle(`Unban ${username}`);
      const reasonInput = new TextInputBuilder()
        .setCustomId('unban_reason')
        .setLabel('Grund für den Unban')
        .setStyle(TextInputStyle.Paragraph)
        .setMinLength(1)
        .setRequired(true);
      const row = new ActionRowBuilder().addComponents(reasonInput);
      modal.addComponents(row);
      return interaction.showModal(modal);
    }

    // Bestätigung “Ban” (Roblox)
    if (interaction.customId.startsWith('confirmBan_')) {
      const username = interaction.customId.slice(11);
      const entryData = JSON.parse(interaction.message.embeds[0].footer.text);
      const reason = entryData.reason;
      if (bannedUsers.has(username.toLowerCase())) {
        return interaction.reply({
          content: `⚠️ ${username} ist bereits gebannt.`,
          flags: 64,
        });
      }
      const robloxUserId = await getRobloxUserId(username);
      if (!robloxUserId) {
        return interaction.reply({
          content: '❌ Nutzer nicht gefunden.',
          flags: 64,
        });
      }

      bannedUsers.set(username.toLowerCase(), { type: 'ban', reason, duration: null, date: Date.now() });
      await sendAction(robloxUserId, 'ban', null, reason);

      const avatarUrl = await getRobloxAvatarUrl(robloxUserId);
      const embed = new EmbedBuilder()
        .setTitle('⛔️ Nutzer permanent gebannt')
        .setThumbnail(avatarUrl || null)
        .setDescription(`👤 ${username}\n🧑‍💻 Von: ${interaction.user.tag}\n📝 Grund: ${reason}`)
        .setColor(COLOR_RED)
        .setTimestamp();
      await interaction.update({ embeds: [embed], components: [] });
      await sendLogMessage('⛔️ Nutzer gebannt', `👤 ${username} gebannt von ${interaction.user.tag}\n📝 Grund: ${reason}`, COLOR_RED);
      return;
    }

    // Bestätigung “Tempban” (Roblox)
    if (interaction.customId.startsWith('confirmTempBan_')) {
      const [username, duration] = interaction.customId.slice(15).split('|');
      const entryData = JSON.parse(interaction.message.embeds[0].footer.text);
      const reason = entryData.reason;
      if (bannedUsers.has(username.toLowerCase())) {
        return interaction.reply({
          content: `⚠️ ${username} ist bereits gebannt.`,
          flags: 64,
        });
      }
      const robloxUserId = await getRobloxUserId(username);
      if (!robloxUserId) {
        return interaction.reply({
          content: '❌ Nutzer nicht gefunden.',
          flags: 64,
        });
      }

      bannedUsers.set(username.toLowerCase(), { type: 'tempban', reason, duration, date: Date.now() });
      await sendAction(robloxUserId, 'tempban', duration, reason);

      const avatarUrl = await getRobloxAvatarUrl(robloxUserId);
      const embed = new EmbedBuilder()
        .setTitle('⏳ Nutzer temporär gebannt')
        .setThumbnail(avatarUrl || null)
        .setDescription(`👤 ${username}\n🧑‍💻 Von: ${interaction.user.tag}\n📝 Grund: ${reason}\n⏰ Dauer: ${duration}`)
        .setColor(COLOR_RED)
        .setTimestamp();
      await interaction.update({ embeds: [embed], components: [] });
      await sendLogMessage(
        '⏳ Nutzer temporär gebannt',
        `👤 ${username} temporär gebannt von ${interaction.user.tag}\n📝 Grund: ${reason}\n⏰ Dauer: ${duration}`,
        COLOR_RED
      );
      return;
    }
  }

  // ---------------------------------------------------
  // 3) Slash‐Command‐Handler
  // ---------------------------------------------------
  const { commandName, user } = interaction;
  if (!OWNER_IDS.includes(user.id) && !allowedUsers.has(user.id)) {
    return interaction.reply({
      content: '❌ Zugriff verweigert.',
      flags: 64,
    });
  }
  if (['add', 'remove'].includes(commandName) && !OWNER_IDS.includes(user.id)) {
    return interaction.reply({
      content: '❌ Nur Owner dürfen diesen Command verwenden.',
      flags: 64,
    });
  }

  await interaction.deferReply();

  try {
    switch (commandName) {
      // ─────────────────────────────────────────────────────────────────────
      // 3.1) Whitelist‐Befehle
      // ─────────────────────────────────────────────────────────────────────
      case 'add': {
        const addUser = interaction.options.getUser('user');
        if (allowedUsers.has(addUser.id)) {
          await sendLogMessage('Whitelist', `⚠️ ${addUser.tag} war bereits auf der Whitelist.`, COLOR_LIGHTBLUE);
          return interaction.editReply('⚠️ Bereits auf der Whitelist.');
        }
        allowedUsers.add(addUser.id);
        await sendLogMessage('Whitelist', `➕ ${addUser.tag} hinzugefügt von ${interaction.user.tag}`, COLOR_GREEN);
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('➕ Hinzugefügt')
              .setDescription(`👤 ${addUser.tag}`)
              .setColor(COLOR_GREEN)
              .setTimestamp(),
          ],
        });
      }

      case 'remove': {
        const remUser = interaction.options.getUser('user');
        if (OWNER_IDS.includes(remUser.id)) {
          await sendLogMessage('Whitelist', `❌ Versuch, Owner ${remUser.tag} zu entfernen.`, COLOR_LIGHTBLUE);
          return interaction.editReply('❌ Owner können nicht entfernt werden.');
        }
        if (!allowedUsers.has(remUser.id)) {
          await sendLogMessage('Whitelist', `⚠️ ${remUser.tag} nicht auf der Whitelist.`, COLOR_LIGHTBLUE);
          return interaction.editReply('⚠️ Nicht auf der Whitelist.');
        }
        allowedUsers.delete(remUser.id);
        await sendLogMessage('Whitelist', `➖ ${remUser.tag} entfernt von ${interaction.user.tag}`, COLOR_RED);
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('➖ Entfernt')
              .setDescription(`👤 ${remUser.tag}`)
              .setColor(COLOR_RED)
              .setTimestamp(),
          ],
        });
      }

      case 'view': {
        const embed = new EmbedBuilder().setTitle('🔐 Whitelist').setColor(COLOR_LIGHTBLUE).setTimestamp();
        const owners = [],
          mods = [];
        for (const id of allowedUsers) {
          const u = await client.users.fetch(id).catch(() => null);
          const name = u ? `[${u.tag}](https://discord.com/users/${u.id})` : `<@${id}>`;
          (OWNER_IDS.includes(id) ? owners : mods).push(
            `${name} — **${OWNER_IDS.includes(id) ? 'Owner' : 'Moderator'}**`
          );
        }
        embed.setDescription(
          `${owners.length ? `__**Owner:**__\n${owners.join('\n')}\n\n` : ''}${
            mods.length ? `__**Moderatoren:**__\n${mods.join('\n')}` : ''
          }`
        );
        await sendLogMessage('Whitelist', `Whitelist abgefragt von ${interaction.user.tag}`, COLOR_LIGHTBLUE);
        return interaction.editReply({ embeds: [embed] });
      }

      // ─────────────────────────────────────────────────────────────────────
      // 3.2) /viewroblox
      // ─────────────────────────────────────────────────────────────────────
      case 'viewroblox': {
        const robloxUser = interaction.options.getString('robloxuser');
        const entry = bannedUsers.get(robloxUser.toLowerCase());
        const userId = await getRobloxUserId(robloxUser);
        if (!userId) {
          await sendLogMessage('ViewRoblox', `❌ ${robloxUser} nicht gefunden von ${interaction.user.tag}`, COLOR_LIGHTBLUE);
          return interaction.editReply('❌ Nutzer nicht gefunden.');
        }
        const avatar = await getRobloxAvatarUrl(userId);
        let status = '✅ Nicht gebannt';
        let fields = [{ name: 'ID', value: userId.toString(), inline: true }];
        if (entry) {
          status = entry.type === 'kick' ? '👢 Gekickt' : `⛔ ${entry.type === 'ban' ? 'Permanent gebannt' : `Temporär gebannt (${entry.duration})`}`;
          fields.push({ name: 'Status', value: status, inline: false });
          if (entry.reason) fields.push({ name: 'Grund', value: entry.reason, inline: false });
        } else {
          fields.push({ name: 'Status', value: status, inline: false });
        }

        const embed = new EmbedBuilder()
          .setTitle(robloxUser)
          .setURL(`https://www.roblox.com/users/${userId}/profile`)
          .setThumbnail(avatar)
          .addFields(fields)
          .setColor(entry ? (entry.type === 'ban' || entry.type === 'tempban' ? COLOR_RED : COLOR_LIGHTBLUE) : COLOR_GREEN)
          .setTimestamp();

        if (entry && (entry.type === 'ban' || entry.type === 'tempban')) {
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`view_unban_${robloxUser}`).setLabel('Unban').setStyle(ButtonStyle.Success)
          );
          await sendLogMessage('ViewRoblox', `🔍 Info ${robloxUser} von ${interaction.user.tag}`, COLOR_LIGHTBLUE);
          return interaction.editReply({ embeds: [embed], components: [row] });
        }

        await sendLogMessage('ViewRoblox', `🔍 Info ${robloxUser} von ${interaction.user.tag}`, COLOR_LIGHTBLUE);
        return interaction.editReply({ embeds: [embed] });
      }

      // ─────────────────────────────────────────────────────────────────────
      // 3.3) Roblox‐Moderationsbefehle
      // ─────────────────────────────────────────────────────────────────────
      case 'ban': {
        const banUser = interaction.options.getString('user').toLowerCase();
        const reason = interaction.options.getString('grund');
        if (bannedUsers.has(banUser)) {
          await sendLogMessage('Ban', `⚠️ ${banUser} schon gebannt von ${interaction.user.tag}`, COLOR_LIGHTBLUE);
          return interaction.editReply('⚠️ Bereits gebannt.');
        }
        const robloxUserId = await getRobloxUserId(banUser);
        if (!robloxUserId) {
          await sendLogMessage('Ban', `❌ ${banUser} nicht gefunden von ${interaction.user.tag}`, COLOR_LIGHTBLUE);
          return interaction.editReply('❌ Nutzer nicht gefunden.');
        }
        const avatar = await getRobloxAvatarUrl(robloxUserId);
        const embed = new EmbedBuilder()
          .setTitle('❗️ Bestätigung erforderlich')
          .setThumbnail(avatar || null)
          .setDescription(`Bist du sicher, dass du **${banUser}** bannen möchtest?\n📝 Grund: ${reason}`)
          .setColor(COLOR_RED)
          .setFooter({ text: JSON.stringify({ reason }) })
          .setTimestamp();
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`confirmBan_${banUser}`)
            .setLabel('Bestätigen')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('cancel')
            .setLabel('Abbrechen')
            .setStyle(ButtonStyle.Secondary)
        );
        await sendLogMessage('Ban Anfrage', `⚠️ ${banUser} soll gebannt werden von ${interaction.user.tag}\n📝 Grund: ${reason}`, COLOR_RED);
        return interaction.editReply({ embeds: [embed], components: [row] });
      }

      case 'tempban': {
        const tmpUser = interaction.options.getString('user').toLowerCase();
        const duration = interaction.options.getString('dauer');
        const reason = interaction.options.getString('grund');
        if (bannedUsers.has(tmpUser)) {
          await sendLogMessage('TempBan', `⚠️ ${tmpUser} schon gebannt von ${interaction.user.tag}`, COLOR_LIGHTBLUE);
          return interaction.editReply('⚠️ Bereits gebannt.');
        }
        const robloxUserId = await getRobloxUserId(tmpUser);
        if (!robloxUserId) {
          await sendLogMessage('TempBan', `❌ ${tmpUser} nicht gefunden von ${interaction.user.tag}`, COLOR_LIGHTBLUE);
          return interaction.editReply('❌ Nutzer nicht gefunden.');
        }
        const avatar = await getRobloxAvatarUrl(robloxUserId);
        const embed = new EmbedBuilder()
          .setTitle('❗️ Bestätigung erforderlich')
          .setThumbnail(avatar || null)
          .setDescription(`Bist du sicher, dass du **${tmpUser}** temporär bannen möchtest?\n📝 Grund: ${reason}\n⏰ Dauer: ${duration}`)
          .setColor(COLOR_RED)
          .setFooter({ text: JSON.stringify({ reason, duration }) })
          .setTimestamp();
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`confirmTempBan_${tmpUser}|${duration}`)
            .setLabel('Bestätigen')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('cancel')
            .setLabel('Abbrechen')
            .setStyle(ButtonStyle.Secondary)
        );
        await sendLogMessage('TempBan Anfrage', `⚠️ ${tmpUser} soll temporär gebannt werden von ${interaction.user.tag}\n📝 Grund: ${reason}\n⏰ Dauer: ${duration}`, COLOR_RED);
        return interaction.editReply({ embeds: [embed], components: [row] });
      }

    case 'unban': {
  const userId = interaction.options.getString('user'); // Discord-ID des Nutzers
  const reason = interaction.options.getString('grund');

  // Prüfen, ob der Nutzer gebannt ist
  const banList = await interaction.guild.bans.fetch();
  if (!banList.has(userId)) {
    await sendLogMessage('Unban', `⚠️ Nutzer mit ID ${userId} ist nicht gebannt von ${interaction.user.tag}`, COLOR_LIGHTBLUE);
    return interaction.editReply('⚠️ Nutzer ist nicht gebannt.');
  }

  // Roblox-User ID abrufen, falls du das brauchst (hier Beispiel)
  const robloxUserId = await getRobloxUserIdByDiscordId(userId);
  if (!robloxUserId) {
    await sendLogMessage('Unban', `❌ Roblox-Nutzer zu Discord-ID ${userId} nicht gefunden von ${interaction.user.tag}`, COLOR_LIGHTBLUE);
    return interaction.editReply('❌ Nutzer nicht gefunden.');
  }

  const avatar = await getRobloxAvatarUrl(robloxUserId);

  const embed = new EmbedBuilder()
    .setTitle('❗️ Bestätigung erforderlich')
    .setThumbnail(avatar || null)
    .setDescription(`Willst du den Nutzer mit der ID **${userId}** entbannen?\n📝 Grund: ${reason}`)
    .setColor(COLOR_GREEN)
    .setFooter({ text: JSON.stringify({ reason }) })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`unban_${userId}`)
      .setLabel('Entbannen')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('cancel')
      .setLabel('Abbrechen')
      .setStyle(ButtonStyle.Secondary)
  );

  await sendLogMessage('Unban Anfrage', `⚠️ Nutzer mit ID ${userId} soll entbannt werden von ${interaction.user.tag}\n📝 Grund: ${reason}`, COLOR_GREEN);

  return interaction.editReply({ embeds: [embed], components: [row] });
}

      case 'kick': {
        const kickUser = interaction.options.getString('user').toLowerCase();
        const reason = interaction.options.getString('grund');
        const robloxUserId = await getRobloxUserId(kickUser);
        if (!robloxUserId) {
          await sendLogMessage('Kick', `❌ ${kickUser} nicht gefunden von ${interaction.user.tag}`, COLOR_LIGHTBLUE);
          return interaction.editReply('❌ Nutzer nicht gefunden.');
        }
        bannedUsers.set(kickUser, { type: 'kick', reason, duration: null, date: Date.now() });
        await sendAction(robloxUserId, 'kick', null, reason);
        const avatar = await getRobloxAvatarUrl(robloxUserId);
        const embed = new EmbedBuilder()
          .setTitle('👢 Nutzer gekickt')
          .setThumbnail(avatar || null)
          .setDescription(`👤 ${kickUser}\n🧑‍💻 Von: ${interaction.user.tag}\n📝 Grund: ${reason}`)
          .setColor(COLOR_LIGHTBLUE)
          .setTimestamp();
        await sendLogMessage('👢 Nutzer gekickt', `👤 ${kickUser} gekickt von ${interaction.user.tag}\n📝 Grund: ${reason}`, COLOR_LIGHTBLUE);
        return interaction.editReply({ embeds: [embed] });
      }

      // ─────────────────────────────────────────────────────────────────────
      // 3.4) /donate
      // ─────────────────────────────────────────────────────────────────────
      case 'donate': {
        const embed = new EmbedBuilder()
          .setTitle('💜 Spenden')
          .setColor(COLOR_PURPLE)
          .setDescription(
            [
              '# If you want to help us then you can donate',
              '',
              '0-10 € (Paypal, Amazon, PSC) = <@&1375837268656525312>',
              '10-20 € (Paypal, Amazon, PSC) = <@&1375837492896464956>',
              '20+ € (Paypal, Amazon, PSC) = <@&1375837561309630514>',
              '',
              'If you want to donate, open a ticket in <#1375842573846843532> and collect your role!',
            ].join('\n')
          )
          .setTimestamp();
        await sendLogMessage('Donate', `Donate-Info abgefragt von ${interaction.user.tag}.`, COLOR_PURPLE);
        return interaction.editReply({ embeds: [embed] });
      }

      // ─────────────────────────────────────────────────────────────────────
      // 3.5) /botmanual
      // ─────────────────────────────────────────────────────────────────────
      case 'botmanual': {
        const embed = new EmbedBuilder()
          .setTitle('📚 Bot Commands:')
          .setColor(COLOR_GREEN)
          .setDescription(
            [
              '**All commands (for now):**',
              '',
              '/ban user: <roblox-user> grund: <grund> – Permanent-Bann',
              '/tempban user: <roblox-user> dauer: <dauer> grund: <grund> – Zeitlich begrenzter Bann',
              '/unban user: <roblox-user> grund: <grund> – Entfernt Bann',
              '/kick user: <roblox-user> grund: <grund> – Sofortiger Kick (ohne Bann)',
              '/add user: <discord-user> – Fügt einen Benutzer zur Whitelist hinzu (nur für Owner)',
              '/remove user: <discord-user> – Entfernt einen Benutzer aus der Whitelist (nur für Owner)',
              '/view whitelist – Zeigt alle Benutzer in der Whitelist an (nur für Owner)',
              '/viewroblox user: <roblox-user> – Zeigt Informationen zu einem Roblox-Benutzer an',
              '/donate – Zeigt Infos, wie man uns unterstützen kann',
              '/botmanual – Zeigt diese Übersicht aller Commands',
              '/dc-ban user: <discord-user> grund: <grund> – Discord-Bann (mit DM & Appeal)',
              '/dc-kick user: <discord-user> grund: <grund> – Discord-Kick (mit DM)',
              '/dc-unbann user: <discord-user> grund: <grund> – Discord-Unban (mit DM)',
            ].join('\n')
          )
          .setTimestamp();
        await sendLogMessage('Bot Manual', `Übersicht angefragt von ${interaction.user.tag}.`, COLOR_GREEN);
        return interaction.editReply({ embeds: [embed] });
      }

      // ─────────────────────────────────────────────────────────────────────
      // 3.6) /dc-ban
      // ─────────────────────────────────────────────────────────────────────
      case 'dc-ban': {
        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('grund');
        // Stelle sicher, dass der Befehl im Guild‐Kontext ausgeführt wird
        if (!interaction.guild) {
          return interaction.editReply('❌ Dieser Befehl kann nur auf dem Server verwendet werden.');
        }
        const guild = interaction.guild;
        // Tatsächliches Discord‐Bannen
        await guild.members.ban(target.id, { reason }).catch(() => null);

        bannedUsers.set(target.id, { type: 'dc-ban', reason, duration: null, date: Date.now() });
        await sendLogMessage(
          '🔒 Discord-Bann',
          `👤 ${target.tag} gebannt von ${interaction.user.tag}\n📝 Grund: ${reason}`,
          COLOR_RED
        );

        // DM an den gebannten User mit Ban‐Hinweis + Appeal‐Button
        const dmEmbed = new EmbedBuilder()
          .setTitle('⛔ Du wurdest gebannt')
          .setDescription(`📝 Grund: ${reason}`)
          .setColor(COLOR_RED)
          .setTimestamp()
          .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
          .setFooter({ text: 'Wenn du entbannt werden willst, klicke unten auf "Ban-Appel einreichen"' });
        const dmButtonRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`appeal_unban_${target.id}`)
            .setLabel('Ban-Appel einreichen')
            .setStyle(ButtonStyle.Primary)
        );
        await target.send({ embeds: [dmEmbed], components: [dmButtonRow] }).catch(() => null);

        const embedResp = new EmbedBuilder()
          .setTitle('🔒 Discord-Bann durchgeführt')
          .setThumbnail(target.displayAvatarURL())
          .setDescription(`👤 ${target.tag} wurde gebannt.\n📝 Grund: ${reason}`)
          .setColor(COLOR_RED)
          .setTimestamp();
        return interaction.editReply({ embeds: [embedResp] });
      }

      // ─────────────────────────────────────────────────────────────────────
      // 3.7) /dc-kick
      // ─────────────────────────────────────────────────────────────────────
      case 'dc-kick': {
        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('grund');
        if (!interaction.guild) {
          return interaction.editReply('❌ Dieser Befehl kann nur auf dem Server verwendet werden.');
        }
        const guild = interaction.guild;
        const member = await guild.members.fetch(target.id).catch(() => null);
        if (member) {
          await member.kick(reason).catch(() => null);
        }
        await sendLogMessage(
          '👢 Discord-Kick',
          `👤 ${target.tag} gekickt von ${interaction.user.tag}\n📝 Grund: ${reason}`,
          COLOR_LIGHTBLUE
        );

        const dmEmbed = new EmbedBuilder()
          .setTitle('👢 Du wurdest gekickt')
          .setDescription(`📝 Grund: ${reason}`)
          .setColor(COLOR_LIGHTBLUE)
          .setTimestamp()
          .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() });
        await target.send({ embeds: [dmEmbed] }).catch(() => null);

        const embedResp = new EmbedBuilder()
          .setTitle('👢 Discord-Kick durchgeführt')
          .setThumbnail(target.displayAvatarURL())
          .setDescription(`👤 ${target.tag} wurde gekickt.\n📝 Grund: ${reason}`)
          .setColor(COLOR_LIGHTBLUE)
          .setTimestamp();
        return interaction.editReply({ embeds: [embedResp] });
      }

      // ─────────────────────────────────────────────────────────────────────
      // 3.8) /dc-unbann
      // ─────────────────────────────────────────────────────────────────────
      case 'dc-unbann': {
        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('grund');
        if (!interaction.guild) {
          return interaction.editReply('❌ Dieser Befehl kann nur auf dem Server verwendet werden.');
        }
        const guild = interaction.guild;
        await guild.bans.remove(target.id, reason).catch(() => null);
        bannedUsers.delete(target.id);

        await sendLogMessage(
          '🔓 Discord-Unban',
          `👤 ${target.tag} entbannt von ${interaction.user.tag}\n📝 Grund: ${reason}`,
          COLOR_GREEN
        );

        const dmEmbed = new EmbedBuilder()
          .setTitle('✅ Du wurdest entbannt')
          .setDescription(`📝 Grund: ${reason}\nHier ist dein Einladungslink: ${INVITE_LINK}`)
          .setColor(COLOR_GREEN)
          .setTimestamp()
          .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() });
        await target.send({ embeds: [dmEmbed] }).catch(() => null);

        const embedResp = new EmbedBuilder()
          .setTitle('🔓 Discord-Unban durchgeführt')
          .setThumbnail(target.displayAvatarURL())
          .setDescription(`👤 ${target.tag} wurde entbannt.\n📝 Grund: ${reason}`)
          .setColor(COLOR_GREEN)
          .setTimestamp();
        return interaction.editReply({ embeds: [embedResp] });
      }

      default:
        return interaction.editReply('❌ Unbekannter Command.');
    }
  } catch (error) {
    console.error(error);
    return interaction.editReply('❌ Ein Fehler ist aufgetreten.');
  }
});

// Express Server für Keep-Alive (optional)
const app = express();
app.get('/', (_, res) => res.send('Bot läuft!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Express Server läuft auf Port ${PORT}`));

// Bot‐Login
client.login(process.env.DISCORD_TOKEN);



// ID für den Update-Channel


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