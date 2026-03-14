const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const { getUser, formatNumber } = require('../utils/helpers');

module.exports = {
    name: 'join',
    description: 'Menerima tantangan duel',
    async execute(message, args) {
        const duel = global.duels.get(message.channel.id);
        if (!duel) {
            return message.reply('❌ Tidak ada duel yang menunggu di channel ini.');
        }
        if (duel.status !== 'waiting_join') {
            return message.reply('❌ Duel sudah dimulai atau selesai.');
        }
        if (duel.opponentId !== message.author.id) {
            return message.reply('❌ Kamu bukan lawan yang ditantang dalam duel ini.');
        }

        const user = await getUser(message.author.id, message.author.username);
        if (user.saldo < duel.bet) {
            return message.reply('❌ Saldo kamu tidak cukup untuk bertaruh.');
        }

        user.saldo -= duel.bet;
        await user.save();

        if (duel.timeoutId) {
            clearTimeout(duel.timeoutId);
        }

        duel.status = 'spinning';
        
        const channel = message.channel;
        const host = await channel.client.users.fetch(duel.hostId);
        const opponent = message.author;

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🎮 ━━━━━ GameSen Duel ━━━━━ 🎮')
            .setDescription(`
**Host :** ${host}
**Lawan :** ${opponent}
**Taruhan :** ${formatNumber(duel.bet)} Coin

Kedua pemain, silakan ketik \`!spin\` untuk mengeluarkan angka!
Anda memiliki waktu **3 menit** untuk spin.
            `)
            .setTimestamp();

        const msg = await channel.messages.fetch(duel.messageId);
        await msg.edit({ embeds: [embed] });

        const spinTimeoutId = setTimeout(async () => {
            const currentDuel = global.duels.get(channel.id);
            if (currentDuel && currentDuel.status === 'spinning' && 
                (currentDuel.hostSpin === null || currentDuel.opponentSpin === null)) {
                
                const hostUser = await getUser(host.id, host.username);
                const oppUser = await getUser(opponent.id, opponent.username);
                hostUser.saldo += currentDuel.bet;
                oppUser.saldo += currentDuel.bet;
                await hostUser.save();
                await oppUser.save();

                global.duels.delete(channel.id);

                const cancelEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Duel Dibatalkan')
                    .setDescription(`Salah satu pemain tidak melakukan spin dalam 3 menit. Coin dikembalikan.`)
                    .setTimestamp();
                channel.send({ embeds: [cancelEmbed] });
            }
        }, 3 * 60 * 1000);

        duel.spinTimeoutId = spinTimeoutId;
        global.duels.set(message.channel.id, duel);
    }
};
