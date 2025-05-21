require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const express = require('express');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const LOG_CHANNEL_ID = '1373777502073389219'; // Ersetze hier mit deiner Log-Channel-ID
const GUILD_ID = '1361770059575591143';       // Ersetze hier mit deiner Guild-ID
const OWNER_IDS = ['1079510826651758713', '1098314958900568094']; // Ersetze hier mit deinen Admin-IDs
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
      option.setName('user').setDescription('Discord-Nutzer').setRequired(true)),
  new SlashCommandBuilder()
    .setName('view')
    .setDescription('Zeigt verschiedene Listen an.')
    .addSubcommand(sub =>
      sub
        .setName('whitelist')
        .setDescription('Zeigt alle Benutzer in der Whitelist an.')
    ),
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
  } catch {
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

  if (interaction.channel.type === 1) // DM check
    return interaction.reply({ content: '❌ Diese Commands können nicht in DMs verwendet werden.', ephemeral: true });

  const { commandName, user } = interaction;
  const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);

  if (!OWNER_IDS.includes(user.id) && !allowedUsers.has(user.id)) {
    return interaction.reply({ content: '❌ Zugriff verweigert. Du bist nicht berechtigt, diesen Command zu nutzen.', ephemeral: true });
  }

  if (['add', 'remove'].includes(commandName) && !OWNER_IDS.includes(user.id)) {
    return interaction.reply({ content: '❌ Nur System-Administratoren dürfen diesen Command verwenden.', ephemeral: true });
  }

  try {
    await interaction.deferReply();

    if (commandName === 'add' || commandName === 'remove') {
      const targetUser = interaction.options.getUser('user');
      if (!targetUser) return interaction.editReply('❌ Bitte gib einen gültigen Discord-Nutzer an.');

      if (commandName === 'add') {
        allowedUsers.add(targetUser.id);
        await interaction.editReply(`✅ ${targetUser.tag} wurde zur Whitelist hinzugefügt.`);

        if (logChannel) {
          logChannel.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('Whitelist Update')
                .setDescription(`✅ Benutzer **${targetUser.tag}** (<@${targetUser.id}>) wurde zur Whitelist hinzugefügt.`)
                .setColor(0x00FF00)
                .setTimestamp()
            ]
          });
        }
        return;
      } else if (commandName === 'remove') {
        allowedUsers.delete(targetUser.id);
        await interaction.editReply(`✅ ${targetUser.tag} wurde von der Whitelist entfernt.`);

        if (logChannel) {
          logChannel.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('Whitelist Update')
                .setDescription(`❌ Benutzer **${targetUser.tag}** (<@${targetUser.id}>) wurde von der Whitelist entfernt.`)
                .setColor(0xFF0000)
                .setTimestamp()
            ]
          });
        }
        return;
      }
    } else if (commandName === 'view') {
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === 'whitelist') {
        if (allowedUsers.size === 0) {
          await interaction.editReply('⚠️ Die Whitelist ist leer.');
          return;
        }

        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) {
          await interaction.editReply('❌ Konnte den Server nicht finden.');
          return;
        }

        let whitelistText = '';
        for (const userId of allowedUsers) {
          try {
            const member = await guild.members.fetch(userId);
            whitelistText += `• [${member.user.tag}](https://discord.com/users/${userId})\n`;
          } catch {
            whitelistText += `• <@${userId}> (User nicht gefunden)\n`;
          }
        }

        if (whitelistText.length > 4000) {
          whitelistText = whitelistText.slice(0, 3997) + '...';
        }

        const embed = new EmbedBuilder()
          .setTitle('Whitelist Übersicht')
          .setDescription(whitelistText)
          .setColor(0x00AAFF)
          .setFooter({ text: `Whitelist Größe: ${allowedUsers.size}` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }
    } else {
      const username = interaction.options.getString('user');
      const duration = interaction.options.getString('dauer');

      if (!username) return interaction.editReply('⚠️ Kein Roblox-Benutzername angegeben.');

      const robloxUser = await getRobloxUserInfo(username);

      if (!robloxUser) {
        return interaction.editReply(`❌ Roblox-Benutzer "${username}" wurde nicht gefunden.`);
      }

      const robloxId = robloxUser.id;
      const robloxProfile = `https://www.roblox.com/users/${robloxId}/profile`;
      const avatar = `https://www.roblox.com/headshot-thumbnail/image?userId=${robloxId}&width=150&height=150&format=png`;

      await sendAction(username, commandName, duration);

      const successMsg = `✅ **${commandName.toUpperCase()}** für **${username}** wurde ausgeführt von ${user.tag}`;
      await interaction.editReply(successMsg);

      if (logChannel) {
        logChannel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`🛠️ Aktion: ${commandName.toUpperCase()}`)
              .setDescription(`👤 Roblox-Name: **${username}**\n🔗 [Zum Profil](${robloxProfile})\n🧑‍💻 Ausgeführt von: ${user.tag}`)
              .setThumbnail(avatar)
              .setColor(0xff0000)
              .setFooter({ text: 'Roblox-Moderation via Discord' })
              .setTimestamp()
          ]
        });
      }
    }
  } catch (err) {
    await interaction.editReply('❌ Fehler beim Ausführen der Aktion.');
    if (logChannel) {
      logChannel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('⚠️ FEHLER BEI COMMAND')
            .setDescription(`👤 Roblox-Name: **${interaction.options.getString('user') || 'unbekannt'}**\n❌ Fehler: \`${err.response?.data?.error || err.message}\`\n🧑‍💻 Von: ${user.tag}`)
            .setColor(0xff3300)
            .setTimestamp()
        ]
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

// Webserver
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('✅ Der Discord-Bot läuft.');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Webserver läuft auf Port ${PORT}`);
});
