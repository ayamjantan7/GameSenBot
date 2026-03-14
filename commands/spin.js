const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const { getUser, formatNumber } = require('../utils/helpers');
const logger = require('../utils/logger');

module.exports = {
    name: 'spin',
    description: 'Melakukan spin untuk duel',
    async execute(message, args) {
        const duel = global.duels.get(message.channel.id);
        if (!duel) {
            return message.reply('❌ Tidak ada duel yang sedang berlangsung.');
        }
        if (duel.status !== 'spinning') {
            return message.reply('❌ Duel tidak dalam tahap spin.');
        }

        let isHost = (message.author.id === duel.hostId);
        let isOpponent = (message.author.id === duel.opponentId);
        if (!isHost && !isOpponent) {
            return message.reply('❌ Kamu tidak terlibat dalam duel ini.');
        }

        if (isHost && duel.hostSpin !== null) {
            return message.reply('❌ Kamu sudah melakukan spin.');
        }
        if (isOpponent && duel.opponentSpin !== null) {
            return message.reply('❌ Kamu sudah melakukan spin.');
        }

        const spin = Math.floor(Math.random() * 37);

        if (isHost) {
            duel.hostSpin = spin;
        } else {
            duel.opponentSpin = spin;
        }

        await message.reply(`🎲 Kamu mendapatkan angka **${spin}**!`);

        // Cek apakah kedua sudah spin
        if (duel.hostSpin !== null && duel.opponentSpin !== null) {
            const hostSpin = duel.hostSpin;
            const oppSpin = duel.opponentSpin;

            if (hostSpin === oppSpin) {
    // Seri: reset spin, minta spin lagi
    
    // Batalkan timeout lama
    if (duel.spinTimeoutId) {
        clearTimeout(duel.spinTimeoutId);
    }
    
    // Reset spin
    duel.hostSpin = null;
    duel.opponentSpin = null;
    
    // Pasang timeout baru (salin dari join.js)
    const newSpinTimeoutId = setTimeout(async () => {
        const currentDuel = global.duels.get(message.channel.id);
        if (currentDuel && currentDuel.status === 'spinning' && 
            (currentDuel.hostSpin === null || currentDuel.opponentSpin === null)) {
            
            const hostUser = await getUser(currentDuel.hostId, '');
            const oppUser = await getUser(currentDuel.opponentId, '');
            hostUser.saldo += currentDuel.bet;
            oppUser.saldo += currentDuel.bet;
            await hostUser.save();
            await oppUser.save();

            global.duels.delete(message.channel.id);

            const cancelEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Duel Dibatalkan')
                .setDescription(`Salah satu pemain tidak melakukan spin dalam 3 menit. Coin dikembalikan.`)
                .setTimestamp();
            message.channel.send({ embeds: [cancelEmbed] });
        }
    }, 3 * 60 * 1000);
    
    duel.spinTimeoutId = newSpinTimeoutId;
    global.duels.set(message.channel.id, duel);

    const seriEmbed = new EmbedBuilder()
        .setColor(0xFFFF00)
        .setTitle('🎰 ━━━━━ GameSen Spin ━━━━━ 🎰')
        .setDescription(`
👤 **Host :** <@${duel.hostId}> — 🎲 **${hostSpin}**
👤 **Lawan :** <@${duel.opponentId}> — 🎲 **${oppSpin}**

⚖️ **Hasil SERI!**
Silakan ketik \`!spin\` lagi untuk menentukan pemenang.
        `)
        .setFooter({ text: 'Gunakan coin dengan bijak 👑' })
        .setTimestamp();
    return message.channel.send({ embeds: [seriEmbed] });
}

            // Tentukan pemenang
            let pemenang, kalah;
            if (hostSpin > oppSpin) {
                pemenang = duel.hostId;
                kalah = duel.opponentId;
            } else {
                pemenang = duel.opponentId;
                kalah = duel.hostId;
            }

            const totalPot = duel.bet * 2;
            const fee = Math.floor(totalPot * 0.05);
            const hadiah = totalPot - fee;

            // Update saldo dan statistik
            const pemenangUser = await getUser(pemenang, '');
            const kalahUser = await getUser(kalah, '');

            pemenangUser.saldo += hadiah;
            // ... statistik lainnya

            await pemenangUser.save();
            await kalahUser.save();

            // Batalkan timeout spin jika ada
            if (duel.spinTimeoutId) {
            clearTimeout(duel.spinTimeoutId);
            }

            // Hapus duel
            global.duels.delete(message.channel.id);

            const hasilEmbed = new EmbedBuilder()...
            await message.channel.send({ embeds: [hasilEmbed] });
                .setColor(0x00FF00)
                .setTitle('🎰 ━━━━━ GameSen Spin ━━━━━ 🎰')
                .setDescription(`
👤 **Host :** <@${duel.hostId}> — 🎲 **${hostSpin}**
👤 **Lawan :** <@${duel.opponentId}> — 🎲 **${oppSpin}**

🏆 **Pemenang :** <@${pemenang}>
💰 **Hadiah :** ${formatNumber(hadiah)} Coin
📊 **Fee (5%) :** ${formatNumber(fee)} Coin

━━━━━━━━━━━━━━━━━━━━━━
Gunakan coin dengan bijak 👑
                `)
                .setTimestamp();
            await message.channel.send({ embeds: [hasilEmbed] });

            await logger.logDuel(duel.hostId, duel.opponentId, duel.bet, hostSpin, oppSpin, pemenang, fee, hadiah);
        } else {
            // Update embed room untuk menunjukkan siapa yang sudah spin
            const channel = message.channel;
            const host = await channel.client.users.fetch(duel.hostId);
            const opponent = await channel.client.users.fetch(duel.opponentId);
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🎮 ━━━━━ GameSen Duel ━━━━━ 🎮')
                .setDescription(`
**Host :** ${host} ${duel.hostSpin !== null ? '✅ (sudah spin)' : '⏳ (belum spin)'}
**Lawan :** ${opponent} ${duel.opponentSpin !== null ? '✅ (sudah spin)' : '⏳ (belum spin)'}
**Taruhan :** ${formatNumber(duel.bet)} Coin

Ketik \`!spin\` untuk mengeluarkan angka!
            `)
                .setTimestamp();
            const msg = await channel.messages.fetch(duel.messageId);
            await msg.edit({ embeds: [embed] });
        }
    }
};
