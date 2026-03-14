require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

global.client = client; // untuk logger
global.duels = new Map(); // menyimpan state duel per channel

client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.name, command);
}

// Koneksi MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Terhubung ke MongoDB'))
    .catch(err => console.error('❌ Gagal koneksi MongoDB:', err));

client.once('ready', () => {
    console.log(`✅ Bot ${client.user.tag} sudah online!`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command) return;

    // Validasi channel
    const playChannelId = process.env.PLAY_CHANNEL_ID;
    const tutorialChannelId = process.env.TUTORIAL_CHANNEL_ID;
    const peraturanChannelId = process.env.PERATURAN_CHANNEL_ID;

    if (commandName === 'tutorial') {
        if (![tutorialChannelId, playChannelId].includes(message.channel.id)) {
            return message.reply(`❌ Command !tutorial hanya bisa digunakan di <#${tutorialChannelId}> atau <#${playChannelId}>.`);
        }
    } else if (commandName === 'peraturan') {
        if (![peraturanChannelId, playChannelId].includes(message.channel.id)) {
            return message.reply(`❌ Command !peraturan hanya bisa digunakan di <#${peraturanChannelId}> atau <#${playChannelId}>.`);
        }
    } else {
        if (message.channel.id !== playChannelId) {
            return message.reply(`❌ Command ini hanya bisa digunakan di <#${playChannelId}>.`);
        }
    }

    try {
        await command.execute(message, args);
    } catch (error) {
        console.error(error);
        message.reply('❌ Terjadi kesalahan saat menjalankan command.');
    }
});

client.login(process.env.TOKEN);
