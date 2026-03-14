const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const { getUser, formatNumber } = require('../utils/helpers');

module.exports = {
    name: 'coinflip',
    description: 'Membuat duel tebak koin dengan lawan',
    async execute(message, args) {
        // Format: !coinflip @lawan <jumlah>
        if (args.length < 2) {
            return message.reply('❌ Penggunaan: `!coinflip @lawan <jumlah>`\nContoh: `!coinflip @User 10000`');
        }

        const lawan = message.mentions.users.first();
        if (!lawan) {
            return message.reply('❌ Tag lawan yang ingin diajak main.');
        }
        if (lawan.id === message.author.id) {
            return message.reply('❌ Tidak bisa main dengan diri sendiri.');
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

        // Cek apakah sudah ada game di channel ini
        if (global.coinflips && global.coinflips.has(message.channel.id)) {
            return message.reply('❌ Sedang ada permainan coinflip berlangsung di channel ini. Tunggu hingga selesai.');
        }

        // Inisialisasi Map untuk coinflip jika belum ada
        if (!global.coinflips) {
            global.coinflips = new Map();
        }

        // Kurangi saldo host sementara
        user.saldo -= bet;
        await user.save();

        // Buat room coinflip
        const game = {
            hostId: message.author.id,
            opponentId: lawan.id,
            hostChoice: null,
            opponentChoice: null,
            bet: bet,
            createdAt: Date.now(),
            status: 'waiting_join', // waiting_join, choosing, completed
            messageId: null,
            timeoutId: null,
            choiceTimeoutId: null
        };

        // Kirim embed undangan
        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('🪙 ━━━━━ GameSen Coinflip ━━━━━ 🪙')
            .setDescription(`
**Host :** ${message.author}
**Lawan :** ${lawan}
**Taruhan :** ${formatNumber(bet)} Coin
**Status :** Menunggu ${lawan} mengetik \`!join\`...

Permainan akan dibatalkan dalam **3 menit** jika tidak di-join.
            `)
            .setTimestamp();

        const msg = await message.channel.send({ embeds: [embed] });
        game.messageId = msg.id;

        // Set timeout untuk membatalkan jika lawan tidak join
        const timeoutId = setTimeout(async () => {
            const currentGame = global.coinflips.get(message.channel.id);
            if (currentGame && currentGame.status === 'waiting_join' && currentGame.hostId === message.author.id) {
                // Kembalikan coin ke host
                const host = await getUser(message.author.id, message.author.username);
                host.saldo += currentGame.bet;
                await host.save();

                global.coinflips.delete(message.channel.id);

                const cancelEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Coinflip Dibatalkan')
                    .setDescription(`${lawan} tidak merespon. Coin dikembalikan ke ${message.author}.`)
                    .setTimestamp();
                message.channel.send({ embeds: [cancelEmbed] });
            }
        }, 3 * 60 * 1000);

        game.timeoutId = timeoutId;
        global.coinflips.set(message.channel.id, game);
    }
};
