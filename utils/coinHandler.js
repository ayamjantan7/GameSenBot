const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const { getUser, formatNumber } = require('./helpers');
const logger = require('./logger');

async function handleCoinChoice(message, choice) {
    try {
        // Inisialisasi Map untuk coinflip jika belum ada
        if (!global.coinflips) {
            global.coinflips = new Map();
        }

        const game = global.coinflips.get(message.channel.id);
        if (!game) {
            return message.reply('❌ Tidak ada permainan coinflip yang sedang berlangsung.');
        }
        if (game.status !== 'choosing') {
            return message.reply('❌ Permainan tidak dalam tahap memilih.');
        }

        // Tentukan siapa user
        let isHost = (message.author.id === game.hostId);
        let isOpponent = (message.author.id === game.opponentId);
        if (!isHost && !isOpponent) {
            return message.reply('❌ Kamu tidak terlibat dalam permainan ini.');
        }

        // Cek apakah sudah memilih
        if (isHost && game.hostChoice !== null) {
            return message.reply('❌ Kamu sudah memilih.');
        }
        if (isOpponent && game.opponentChoice !== null) {
            return message.reply('❌ Kamu sudah memilih.');
        }

        // Simpan pilihan
        if (isHost) {
            game.hostChoice = choice;
        } else {
            game.opponentChoice = choice;
        }

        await message.reply(`✅ Kamu memilih **${choice === 'head' ? '🔴 Head' : '🔵 Tails'}**!`);

        // Update embed status
        const channel = message.channel;
        const host = await channel.client.users.fetch(game.hostId);
        const opponent = await channel.client.users.fetch(game.opponentId);
        
        const statusEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🪙 ━━━━━ GameSen Coinflip ━━━━━ 🪙')
            .setDescription(`
**Host :** ${host} ${game.hostChoice ? '✅ (sudah pilih)' : '⏳ (belum pilih)'}
**Lawan :** ${opponent} ${game.opponentChoice ? '✅ (sudah pilih)' : '⏳ (belum pilih)'}
**Taruhan :** ${formatNumber(game.bet)} Coin

Pilih sisi koin dengan \`!head\` atau \`!tails\`
            `)
            .setTimestamp();

        try {
            const msg = await channel.messages.fetch(game.messageId);
            await msg.edit({ embeds: [statusEmbed] });
        } catch (e) {
            console.log('Gagal update embed:', e);
        }

        // Cek apakah kedua sudah memilih
        if (game.hostChoice !== null && game.opponentChoice !== null) {
            const hostChoice = game.hostChoice;
            const oppChoice = game.opponentChoice;

            // Jika pilihan sama
            if (hostChoice === oppChoice) {
                // Reset pilihan
                game.hostChoice = null;
                game.opponentChoice = null;
                
                // Kirim pesan suruh pilih ulang
                const ulangEmbed = new EmbedBuilder()
                    .setColor(0xFFFF00)
                    .setTitle('🪙 ━━━━━ GameSen Coinflip ━━━━━ 🪙')
                    .setDescription(`
⚠️ **Keduanya memilih ${hostChoice === 'head' ? '🔴 Head' : '🔵 Tails'} yang sama!**

Silakan pilih ulang dengan \`!head\` atau \`!tails\`
                    `)
                    .setTimestamp();

                global.coinflips.set(message.channel.id, game);
                return message.channel.send({ embeds: [ulangEmbed] });
            }

            // Tentukan hasil koin (random)
            const coinResult = Math.random() < 0.5 ? 'head' : 'tails';
            
            // Tentukan pemenang
            let pemenangId, kalahId;
            if (hostChoice === coinResult) {
                pemenangId = game.hostId;
                kalahId = game.opponentId;
            } else {
                pemenangId = game.opponentId;
                kalahId = game.hostId;
            }

            const totalPot = game.bet * 2;
            const fee = Math.floor(totalPot * 0.05);
            const hadiah = totalPot - fee;

            // Update saldo dan statistik
            const pemenangUser = await getUser(pemenangId, pemenangId === game.hostId ? host.username : opponent.username);
            const kalahUser = await getUser(kalahId, kalahId === game.hostId ? host.username : opponent.username);

            pemenangUser.saldo += hadiah;
            pemenangUser.totalMenang += 1;
            kalahUser.totalKalah += 1;
            pemenangUser.winstreak += 1;
            kalahUser.winstreak = 0;
            
            if (pemenangUser.winstreak > pemenangUser.bestWinstreak) {
                pemenangUser.bestWinstreak = pemenangUser.winstreak;
            }

            await pemenangUser.save();
            await kalahUser.save();

            // Hapus timeout
            if (game.choiceTimeoutId) {
                clearTimeout(game.choiceTimeoutId);
            }

            // Hapus game
            global.coinflips.delete(message.channel.id);

            // Kirim hasil
            const hasilEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🪙 ━━━━━ GameSen Coinflip ━━━━━ 🪙')
                .setDescription(`
👤 **Host :** <@${game.hostId}> — memilih **${game.hostChoice === 'head' ? '🔴 Head' : '🔵 Tails'}**
👤 **Lawan :** <@${game.opponentId}> — memilih **${game.opponentChoice === 'head' ? '🔴 Head' : '🔵 Tails'}**

🎲 **Hasil Koin :** **${coinResult === 'head' ? '🔴 Head' : '🔵 Tails'}**

🏆 **Pemenang :** <@${pemenangId}>
💰 **Hadiah :** ${formatNumber(hadiah)} Coin
📊 **Fee (5%) :** ${formatNumber(fee)} Coin

━━━━━━━━━━━━━━━━━━━━━━
Gunakan coin dengan bijak 👑
                `)
                .setTimestamp();
            await message.channel.send({ embeds: [hasilEmbed] });

            // Log ke admin
            try {
                await logger.logCoinflip(game.hostId, game.opponentId, game.bet, game.hostChoice, game.opponentChoice, coinResult, pemenangId, fee, hadiah);
            } catch (e) {
                console.log('Gagal log coinflip:', e);
            }
        }
    } catch (error) {
        console.error('ERROR DI COIN HANDLER:', error);
        message.reply('❌ Terjadi kesalahan. Mohon laporkan ke admin.');
    }
}

module.exports = { handleCoinChoice };
