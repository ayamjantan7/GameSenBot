const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const { getUser, formatNumber, isAdmin } = require('../utils/helpers');
const logger = require('../utils/logger');

module.exports = {
    name: 'delcoin',
    description: '[ADMIN] Menghapus coin dari user',
    async execute(message, args) {
        // Cek admin
        if (!isAdmin(message.member)) {
            return message.reply('❌ Hanya admin yang bisa menggunakan command ini.');
        }

        // Validasi argumen
        if (args.length < 2) {
            return message.reply('❌ Penggunaan: `!delcoin @user <jumlah>`\nContoh: `!delcoin @Andi 5000`');
        }

        const target = message.mentions.users.first();
        if (!target) {
            return message.reply('❌ Tag user yang ingin dihapus coin-nya.');
        }

        const amount = parseInt(args[1].replace(/\./g, ''));
        if (isNaN(amount) || amount <= 0) {
            return message.reply('❌ Jumlah harus angka positif.');
        }

        // Ambil data user target
        const user = await getUser(target.id, target.username);

        // Cek saldo cukup
        if (user.saldo < amount) {
            return message.reply(`❌ Saldo ${target} tidak cukup. Saldo saat ini: ${formatNumber(user.saldo)} Coin.`);
        }

        // Kurangi saldo
        user.saldo -= amount;
        await user.save();

        // Embed response
        const embed = new EmbedBuilder()
            .setColor(0xFF5733) // oranye kemerahan
            .setTitle('🔴 ━━━━━ GameSen Delete Coin ━━━━━ 🔴')
            .setDescription(`
**Admin :** ${message.author}
**Target :** ${target}
**Jumlah Dihapus :** ${formatNumber(amount)} Coin
**Sisa Saldo :** ${formatNumber(user.saldo)} Coin

━━━━━━━━━━━━━━━━━━━━━━
Coin berhasil dihapus ✔
            `)
            .setTimestamp();
        message.channel.send({ embeds: [embed] });

        // Log ke admin-log
        await logger.logAdminDel(message.author, target, amount, user.saldo);
    }
};
