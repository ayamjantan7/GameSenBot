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

global.client = client;
global.duels = new Map();

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
mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000
})
.then(() => console.log('✅ Terhubung ke MongoDB'))
.catch(err => {
    console.error('❌ Gagal koneksi MongoDB:');
    console.error(err);
});

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
    const paymentChannelId = process.env.PAYMENT_CHANNEL_ID;

    // Command yang bisa dijalankan di SEMUA channel (khusus admin)
    const globalCommands = ['deletechat', 'addcoin', 'delcoin'];

    if (globalCommands.includes(commandName)) {
        // Command admin bisa dijalankan di channel mana saja
        console.log(`Command admin ${commandName} dijalankan di channel ${message.channel.name}`);
    } else if (commandName === 'tutorial') {
        if (![tutorialChannelId, playChannelId].includes(message.channel.id)) {
            return message.reply(`❌ Command !tutorial hanya bisa digunakan di <#${tutorialChannelId}> atau <#${playChannelId}>.`);
        }
    } else if (commandName === 'peraturan') {
        if (![peraturanChannelId, playChannelId].includes(message.channel.id)) {
            return message.reply(`❌ Command !peraturan hanya bisa digunakan di <#${peraturanChannelId}> atau <#${playChannelId}>.`);
        }
    } else if (commandName === 'payment') {
        if (![paymentChannelId, playChannelId].includes(message.channel.id)) {
            return message.reply(`❌ Command !payment hanya bisa digunakan di <#${paymentChannelId}> atau <#${playChannelId}>.`);
        }
    } else {
        if (message.channel.id !== playChannelId) {
            return message.reply(`❌ Command ini hanya bisa digunakan di <#${playChannelId}>.`);
        }
    }

    try {
        await command.execute(message, args);
    } catch (error) {
        console.error(`[ERROR] Command ${commandName} oleh ${message.author.tag}:`, error);
        message.reply('❌ Terjadi kesalahan saat menjalankan command.');
    }
});

client.login(process.env.TOKEN);
