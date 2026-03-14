const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const { getUser, formatNumber } = require('../utils/helpers');
const logger = require('../utils/logger');

module.exports = {
    name: 'tfcoin',
    description: 'Transfer coin ke user lain',
    async execute(message, args) {
        if (args.length < 2) {
            return message.reply('❌ Penggunaan: `!tfcoin @user <jumlah>`');
        }

        const target = message.mentions.users.first();
        if (!target) {
            return message.reply('❌ Tag user yang ingin ditransfer.');
        }
        if (target.id === message.author.id) {
            return message.reply('❌ Tidak bisa transfer ke diri sendiri.');
        }

        const amount = parseInt(args[1].replace(/\./g, ''));
        if (isNaN(amount) || amount <= 0) {
            return message.reply('❌ Jumlah harus angka positif.');
        }
        if (amount < 5000) {
            return message.reply('❌ Minimal transfer adalah 5.000 Coin.');
        }

        const pengirim = await getUser(message.author.id, message.author.username);
        const penerima = await getUser(target.id, target.username);

        if (pengirim.saldo < amount) {
            return message.reply('❌ Saldo kamu tidak cukup.');
        }

        const adminFee = Math.floor(amount * 0.05);
        const diterima = amount - adminFee;

        pengirim.saldo -= amount;
        penerima.saldo += diterima;

        await pengirim.save();
        await penerima.save();

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('💸 ━━━━━ GameSen Transfer ━━━━━ 💸')
            .setDescription(`
**Pengirim :** ${message.author}
**Penerima :** ${target}

**Jumlah Transfer :** ${formatNumber(amount)} Coin
**Biaya Admin (5%) :** ${formatNumber(adminFee)} Coin
**Diterima :** ${formatNumber(diterima)} Coin

━━━━━━━━━━━━━━━━━━━━━━
Transfer berhasil ✔
            `)
            .setTimestamp();
        message.channel.send({ embeds: [embed] });

        await logger.logTransfer(message.author, target, amount, adminFee, diterima);
    }
};
