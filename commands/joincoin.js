const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const { getUser, formatNumber } = require('../utils/helpers');

module.exports = {
    name: 'joincoin',
    description: 'Menerima tantangan coinflip',
    async execute(message, args) {
        // Inisialisasi Map untuk coinflip jika belum ada
        if (!global.coinflips) {
            global.coinflips = new Map();
        }

        const game = global.coinflips.get(message.channel.id);
        if (!game) {
            return message.reply('❌ Tidak ada permainan coinflip yang menunggu di channel ini.');
        }
        if (game.status !== 'waiting_join') {
            return message.reply('❌ Permainan sudah dimulai atau selesai.');
        }
        if (game.opponentId !== message.author.id) {
            return message.reply('❌ Kamu bukan lawan yang ditantang dalam permainan ini.');
        }

        const user = await getUser(message.author.id, message.author.username);
        if (user.saldo < game.bet) {
            return message.reply('❌ Saldo kamu tidak cukup untuk bertaruh.');
        }

        // Kurangi saldo lawan
        user.saldo -= game.bet;
        await user.save();

        // Batalkan timeout sebelumnya (waiting_join)
        if (game.timeoutId) {
            clearTimeout(game.timeoutId);
        }

        // Update status
        game.status = 'choosing';
        
        const channel = message.channel;
        const host = await channel.client.users.fetch(game.hostId);
        const opponent = message.author;

        // Update embed room
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🪙 ━━━━━ GameSen Coinflip ━━━━━ 🪙')
            .setDescription(`
**Host :** ${host}
**Lawan :** ${opponent}
**Taruhan :** ${formatNumber(game.bet)} Coin

**Pilih sisi koin:**
🔴 \`!head\` - Head
🔵 \`!tails\` - Tails

Kedua pemain memiliki waktu **3 menit** untuk memilih.
            `)
            .setTimestamp();

        const msg = await channel.messages.fetch(game.messageId);
        await msg.edit({ embeds: [embed] });

        // Set timeout untuk memilih
        const choiceTimeoutId = setTimeout(async () => {
            const currentGame = global.coinflips.get(channel.id);
            if (currentGame && currentGame.status === 'choosing' && 
                (currentGame.hostChoice === null || currentGame.opponentChoice === null)) {
                
                // Batalkan permainan karena tidak memilih
                const hostUser = await getUser(host.id, host.username);
                const oppUser = await getUser(opponent.id, opponent.username);
                hostUser.saldo += currentGame.bet;
                oppUser.saldo += currentGame.bet;
                await hostUser.save();
                await oppUser.save();

                global.coinflips.delete(channel.id);

                const cancelEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Coinflip Dibatalkan')
                    .setDescription(`Salah satu pemain tidak memilih dalam 3 menit. Coin dikembalikan.`)
                    .setTimestamp();
                channel.send({ embeds: [cancelEmbed] });
            }
        }, 3 * 60 * 1000);

        game.choiceTimeoutId = choiceTimeoutId;
        global.coinflips.set(message.channel.id, game);
    }
};
