const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const { getUser, formatNumber } = require('../utils/helpers');

module.exports = {
    name: 'duel',
    description: 'Membuat duel dengan menantang lawan tertentu',
    async execute(message, args) {
        // Format: !duel @lawan <jumlah>
        if (args.length < 2) {
            return message.reply('❌ Penggunaan: `!duel @lawan <jumlah>`\nContoh: `!duel @User 10000`');
        }

        const lawan = message.mentions.users.first();
        if (!lawan) {
            return message.reply('❌ Tag lawan yang ingin ditantang.');
        }
        if (lawan.id === message.author.id) {
            return message.reply('❌ Tidak bisa duel dengan diri sendiri.');
        }

        const bet = parseInt(args[1].replace(/\./g, ''));
        if (isNaN(bet) || bet <= 0) {
            return message.reply('❌ Jumlah taruhan harus angka positif.');
        }
        if (bet < 5000) {
            return message.reply('❌ Minimal taruhan adalah 5.000 Coin.');
        }

        const user = await getUser(message.author.id, message.author.username);
        if (user.saldo < bet) {
            return message.reply('❌ Saldo kamu tidak cukup.');
        }

        // Cek apakah sudah ada duel di channel ini
        if (global.duels.has(message.channel.id)) {
            return message.reply('❌ Sedang ada duel berlangsung di channel ini. Tunggu hingga selesai.');
        }

        // Kurangi saldo host sementara
        user.saldo -= bet;
        await user.save();

        // Buat room duel
        const duel = {
            hostId: message.author.id,
            opponentId: lawan.id, // langsung set lawan karena ditag
            hostSpin: null,
            opponentSpin: null,
            bet: bet,
            createdAt: Date.now(),
            status: 'waiting_join', // menunggu lawan mengkonfirmasi dengan !join
            messageId: null
        };

        // Kirim embed undangan
        const embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle('🎮 ━━━━━ GameSen Duel ━━━━━ 🎮')
            .setDescription(`
**Host :** ${message.author}
**Lawan :** ${lawan}
**Taruhan :** ${formatNumber(bet)} Coin
**Status :** Menunggu ${lawan} mengetik \`!join\`...

Duel akan dibatalkan dalam **3 menit** jika tidak di-join.
            `)
            .setTimestamp();

        const msg = await message.channel.send({ embeds: [embed] });
        duel.messageId = msg.id;

        global.duels.set(message.channel.id, duel);

        // Set timeout untuk membatalkan jika lawan tidak join
const timeoutId = setTimeout(async () => {
    const currentDuel = global.duels.get(message.channel.id);
    if (currentDuel && currentDuel.status === 'waiting_join' && currentDuel.hostId === message.author.id) {
        // Kembalikan coin ke host
        const host = await getUser(message.author.id, message.author.username);
        host.saldo += currentDuel.bet;
        await host.save();

        global.duels.delete(message.channel.id);

        const cancelEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Duel Dibatalkan')
            .setDescription(`${lawan} tidak merespon. Coin dikembalikan ke ${message.author}.`)
            .setTimestamp();
        message.channel.send({ embeds: [cancelEmbed] });
    }
}, 3 * 60 * 1000);

// Simpan timeoutId di objek duel
duel.timeoutId = timeoutId;
