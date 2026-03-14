const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const { getUser, formatNumber, isAdmin } = require('../utils/helpers');
const logger = require('../utils/logger');

module.exports = {
    name: 'addcoin',
    description: '[ADMIN] Menambah coin ke user',
    async execute(message, args) {
        if (!isAdmin(message.member)) {
            return message.reply('❌ Hanya admin yang bisa menggunakan command ini.');
        }

        if (args.length < 2) {
            return message.reply('❌ Penggunaan: `!addcoin @user <jumlah>`');
        }

        const target = message.mentions.users.first();
        if (!target) {
            return message.reply('❌ Tag user yang ingin ditambahkan coin.');
        }

        const amount = parseInt(args[1].replace(/\./g, ''));
        if (isNaN(amount) || amount <= 0) {
            return message.reply('❌ Jumlah harus angka positif.');
        }

        const user = await getUser(target.id, target.username);
        user.saldo += amount;
        await user.save();

        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🔒 ━━━━━ GameSen Admin ━━━━━ 🔒')
            .setDescription(`
**Admin :** ${message.author}
**Target :** ${target}
**Jumlah :** ${formatNumber(amount)} Coin

━━━━━━━━━━━━━━━━━━━━━━
Coin berhasil ditambahkan
            `)
            .setTimestamp();
        message.channel.send({ embeds: [embed] });

        await logger.logAdminAdd(message.author, target, amount);
    }
};
