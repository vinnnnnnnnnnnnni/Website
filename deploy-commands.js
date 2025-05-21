require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannt einen Roblox-Spieler permanent.')
    .addStringOption(option => option.setName('user').setDescription('Roblox-Benutzername').setRequired(true)),

  new SlashCommandBuilder()
    .setName('tempban')
    .setDescription('Bannt einen Roblox-Spieler temporär.')
    .addStringOption(option => option.setName('user').setDescription('Roblox-Benutzername').setRequired(true))
    .addStringOption(option => option.setName('dauer').setDescription('Dauer des Banns (z.B. 1d, 2h)').setRequired(true)),

  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Entbannt einen Roblox-Spieler.')
    .addStringOption(option => option.setName('user').setDescription('Roblox-Benutzername').setRequired(true)),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kickt einen Roblox-Spieler aus dem Spiel.')
    .addStringOption(option => option.setName('user').setDescription('Roblox-Benutzername').setRequired(true)),

  new SlashCommandBuilder()
    .setName('add')
    .setDescription('Fügt einen Benutzer zur Whitelist hinzu.')
    .addUserOption(option => option.setName('user').setDescription('Discord-Nutzer').setRequired(true)),

  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Entfernt einen Benutzer aus der Whitelist.')
    .addUserOption(option => option.setName('user').setDescription('Discord-Nutzer').setRequired(true)),

  new SlashCommandBuilder()
    .setName('view')
    .setDescription('Zeigt alle Benutzer in der Whitelist an.'),

  new SlashCommandBuilder()
    .setName('viewroblox')
    .setDescription('Zeigt Informationen zu einem Roblox-Benutzer an.')
    .addStringOption(option => option.setName('robloxuser').setDescription('Roblox-Benutzername').setRequired(true)),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Registriere Slash-Commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('Slash-Commands wurden erfolgreich registriert!');
  } catch (error) {
    console.error('Fehler bei der Registrierung:', error);
  }
})();
