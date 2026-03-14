const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const { getUser, formatNumber } = require('../utils/helpers');

module.exports = {
    name: 'joinreme',
    description: 'Menerima tantangan reme',
    async execute(message, args) {
        try {
            if (!global.remes) {
                global.remes = new Map();
            }

            const game = global.remes.get(message.channel.id);
            if (!game) {
                return message.reply('❌ Tidak ada permainan reme yang menunggu di channel ini.');
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

            user.saldo -= game.bet;
            await user.save();

            if (game.timeoutId) {
                clearTimeout(game.timeoutId);
            }

            game.status = 'spinning';
            
            const channel = message.channel;
            const host = await channel.client.users.fetch(game.hostId);
            const opponent = message.author;

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🎯 ━━━━━ GameSen Reme ━━━━━ 🎯')
                .setDescription(`
**Host :** ${host}
**Lawan :** ${opponent}
**Taruhan :** ${formatNumber(game.bet)} Coin

Kedua pemain, silakan ketik \`!spinner\` untuk spin!
Anda memiliki waktu **3 menit** untuk spin.
                `)
                .setTimestamp();

            const msg = await channel.messages.fetch(game.messageId);
            await msg.edit({ embeds: [embed] });

            // ========== TIMEOUT SPINNER DENGAN ATURAN BARU ==========
            const spinTimeoutId = setTimeout(async () => {
                const currentGame = global.remes.get(channel.id);
                if (currentGame && currentGame.status === 'spinning') {
                    
                    const hostSudahSpin = currentGame.hostSpin !== null;
                    const opponentSudahSpin = currentGame.opponentSpin !== null;
                    
                    // Kasus 1: Keduanya belum spin
                    if (!hostSudahSpin && !opponentSudahSpin) {
                        const hostUser = await getUser(host.id, host.username);
                        const oppUser = await getUser(opponent.id, opponent.username);
                        hostUser.saldo += currentGame.bet;
                        oppUser.saldo += currentGame.bet;
                        await hostUser.save();
                        await oppUser.save();

                        global.remes.delete(channel.id);

                        const cancelEmbed = new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setTitle('❌ Reme Dibatalkan')
                            .setDescription(`Kedua pemain tidak melakukan spin dalam 3 menit. Coin dikembalikan.`)
                            .setTimestamp();
                        channel.send({ embeds: [cancelEmbed] });
                    }
                    
                    // Kasus 2: Hanya host yang sudah spin
                    else if (hostSudahSpin && !opponentSudahSpin) {
                        const totalPot = currentGame.bet * 2;
                        const fee = Math.floor(totalPot * 0.05);
                        const hadiah = totalPot - fee;
                        
                        const hostUser = await getUser(host.id, host.username);
                        hostUser.saldo += hadiah;
                        hostUser.totalMenang += 1;
                        hostUser.winstreak += 1;
                        if (hostUser.winstreak > hostUser.bestWinstreak) {
                            hostUser.bestWinstreak = hostUser.winstreak;
                        }
                        await hostUser.save();
                        
                        const oppUser = await getUser(opponent.id, opponent.username);
                        oppUser.totalKalah += 1;
                        oppUser.winstreak = 0;
                        await oppUser.save();
                        
                        global.remes.delete(channel.id);
                        
                        const menangEmbed = new EmbedBuilder()
                            .setColor(0x00FF00)
                            .setTitle('🏆 ━━━━━ GameSen Reme ━━━━━ 🏆')
                            .setDescription(`
👤 **Pemenang :** ${host} (MENANG OTOMATIS)
👤 **Lawan :** ${opponent} (TIDAK SPIN)

💰 **Hadiah :** ${formatNumber(hadiah)} Coin
📊 **Fee (5%) :** ${formatNumber(fee)} Coin

━━━━━━━━━━━━━━━━━━━━━━
Lawan tidak melakukan spin dalam 3 menit.
                            `)
                            .setTimestamp();
                        channel.send({ embeds: [menangEmbed] });
                    }
                    
                    // Kasus 3: Hanya lawan yang sudah spin
                    else if (!hostSudahSpin && opponentSudahSpin) {
                        const totalPot = currentGame.bet * 2;
                        const fee = Math.floor(totalPot * 0.05);
                        const hadiah = totalPot - fee;
                        
                        const oppUser = await getUser(opponent.id, opponent.username);
                        oppUser.saldo += hadiah;
                        oppUser.totalMenang += 1;
                        oppUser.winstreak += 1;
                        if (oppUser.winstreak > oppUser.bestWinstreak) {
                            oppUser.bestWinstreak = oppUser.winstreak;
                        }
                        await oppUser.save();
                        
                        const hostUser = await getUser(host.id, host.username);
                        hostUser.totalKalah += 1;
                        hostUser.winstreak = 0;
                        await hostUser.save();
                        
                        global.remes.delete(channel.id);
                        
                        const menangEmbed = new EmbedBuilder()
                            .setColor(0x00FF00)
                            .setTitle('🏆 ━━━━━ GameSen Reme ━━━━━ 🏆')
                            .setDescription(`
👤 **Pemenang :** ${opponent} (MENANG OTOMATIS)
👤 **Lawan :** ${host} (TIDAK SPIN)

💰 **Hadiah :** ${formatNumber(hadiah)} Coin
📊 **Fee (5%) :** ${formatNumber(fee)} Coin

━━━━━━━━━━━━━━━━━━━━━━
Host tidak melakukan spin dalam 3 menit.
                            `)
                            .setTimestamp();
                        channel.send({ embeds: [menangEmbed] });
                    }
                }
            }, 3 * 60 * 1000);
            // ========== AKHIR TIMEOUT SPINNER ==========

            game.spinTimeoutId = spinTimeoutId;
            global.remes.set(message.channel.id, game);

        } catch (error) {
            console.error('ERROR DI JOINREME:', error);
            message.reply('❌ Terjadi kesalahan. Mohon laporkan ke admin.');
        }
    }
};
