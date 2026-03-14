const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const { getUser, formatNumber } = require('../utils/helpers');

module.exports = {
    name: 'reme',
    description: 'Duel dengan aturan khusus (angka kuat 0,19,28)',
    async execute(message, args) {
        try {
            if (args.length < 2) {
                return message.reply('❌ Penggunaan: `!reme @lawan <jumlah>`\nContoh: `!reme @User 10000`');
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

            if (!global.remes) {
                global.remes = new Map();
            }

            if (global.remes.has(message.channel.id)) {
                return message.reply('❌ Sedang ada permainan reme berlangsung di channel ini. Tunggu hingga selesai.');
            }

            user.saldo -= bet;
            await user.save();

            const game = {
                hostId: message.author.id,
                opponentId: lawan.id,
                hostSpin: null,
                opponentSpin: null,
                bet: bet,
                createdAt: Date.now(),
                status: 'waiting_join',
                messageId: null,
                timeoutId: null,
                spinTimeoutId: null
            };

            const embed = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle('🎯 ━━━━━ GameSen Reme ━━━━━ 🎯')
                .setDescription(`
**Host :** ${message.author}
**Lawan :** ${lawan}
**Taruhan :** ${formatNumber(bet)} Coin
**Status :** Menunggu ${lawan} mengetik \`!joinreme\`...

Duel akan dibatalkan dalam **3 menit** jika tidak di-join.
                `)
                .setTimestamp();

            const msg = await message.channel.send({ embeds: [embed] });
            game.messageId = msg.id;

            const timeoutId = setTimeout(async () => {
                const currentGame = global.remes.get(message.channel.id);
                if (currentGame && currentGame.status === 'waiting_join' && currentGame.hostId === message.author.id) {
                    const host = await getUser(message.author.id, message.author.username);
                    host.saldo += currentGame.bet;
                    await host.save();

                    global.remes.delete(message.channel.id);

                    const cancelEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('❌ Reme Dibatalkan')
                        .setDescription(`${lawan} tidak merespon. Coin dikembalikan ke ${message.author}.`)
                        .setTimestamp();
                    message.channel.send({ embeds: [cancelEmbed] });
                }
            }, 3 * 60 * 1000);

            game.timeoutId = timeoutId;
            global.remes.set(message.channel.id, game);

        } catch (error) {
            console.error('ERROR DI REME:', error);
            message.reply('❌ Terjadi kesalahan. Mohon laporkan ke admin.');
        }
    }
};
