const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const { getUser, formatNumber } = require('../utils/helpers');

module.exports = {
    name: 'join',
    description: 'Menerima tantangan duel',
    async execute(message, args) {
        try {
            if (!global.duels) {
                global.duels = new Map();
            }

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

            // ========== TIMEOUT SPIN DENGAN ATURAN BARU ==========
            const spinTimeoutId = setTimeout(async () => {
                const currentDuel = global.duels.get(channel.id);
                if (currentDuel && currentDuel.status === 'spinning') {
                    
                    const hostSudahSpin = currentDuel.hostSpin !== null;
                    const opponentSudahSpin = currentDuel.opponentSpin !== null;
                    
                    // Kasus 1: Keduanya belum spin
                    if (!hostSudahSpin && !opponentSudahSpin) {
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
                            .setDescription(`Kedua pemain tidak melakukan spin dalam 3 menit. Coin dikembalikan.`)
                            .setTimestamp();
                        channel.send({ embeds: [cancelEmbed] });
                    }
                    
                    // Kasus 2: Hanya host yang sudah spin
                    else if (hostSudahSpin && !opponentSudahSpin) {
                        const totalPot = currentDuel.bet * 2;
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
                        
                        global.duels.delete(channel.id);
                        
                        const menangEmbed = new EmbedBuilder()
                            .setColor(0x00FF00)
                            .setTitle('🏆 ━━━━━ GameSen Duel ━━━━━ 🏆')
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
                        const totalPot = currentDuel.bet * 2;
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
                        
                        global.duels.delete(channel.id);
                        
                        const menangEmbed = new EmbedBuilder()
                            .setColor(0x00FF00)
                            .setTitle('🏆 ━━━━━ GameSen Duel ━━━━━ 🏆')
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
            // ========== AKHIR TIMEOUT SPIN ==========

            duel.spinTimeoutId = spinTimeoutId;
            global.duels.set(message.channel.id, duel);

        } catch (error) {
            console.error('ERROR DI JOIN:', error);
            message.reply('❌ Terjadi kesalahan. Mohon laporkan ke admin.');
        }
    }
};
