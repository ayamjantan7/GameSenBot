const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const { getUser, formatNumber } = require('../utils/helpers');

module.exports = {
    name: 'joincoin',
    description: 'Menerima tantangan coinflip',
    async execute(message, args) {
        try {
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

            user.saldo -= game.bet;
            await user.save();

            if (game.timeoutId) {
                clearTimeout(game.timeoutId);
            }

            game.status = 'choosing';
            
            const channel = message.channel;
            const host = await channel.client.users.fetch(game.hostId);
            const opponent = message.author;

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

            // ========== TIMEOUT PILIH DENGAN ATURAN BARU ==========
            const choiceTimeoutId = setTimeout(async () => {
                const currentGame = global.coinflips.get(channel.id);
                if (currentGame && currentGame.status === 'choosing') {
                    
                    const hostSudahPilih = currentGame.hostChoice !== null;
                    const opponentSudahPilih = currentGame.opponentChoice !== null;
                    
                    // Kasus 1: Keduanya belum pilih
                    if (!hostSudahPilih && !opponentSudahPilih) {
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
                            .setDescription(`Kedua pemain tidak memilih dalam 3 menit. Coin dikembalikan.`)
                            .setTimestamp();
                        channel.send({ embeds: [cancelEmbed] });
                    }
                    
                    // Kasus 2: Hanya host yang sudah pilih
                    else if (hostSudahPilih && !opponentSudahPilih) {
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
                        
                        global.coinflips.delete(channel.id);
                        
                        const menangEmbed = new EmbedBuilder()
                            .setColor(0x00FF00)
                            .setTitle('🏆 ━━━━━ GameSen Coinflip ━━━━━ 🏆')
                            .setDescription(`
👤 **Pemenang :** ${host} (MENANG OTOMATIS)
👤 **Lawan :** ${opponent} (TIDAK MEMILIH)

💰 **Hadiah :** ${formatNumber(hadiah)} Coin
📊 **Fee (5%) :** ${formatNumber(fee)} Coin

━━━━━━━━━━━━━━━━━━━━━━
Lawan tidak memilih dalam 3 menit.
                            `)
                            .setTimestamp();
                        channel.send({ embeds: [menangEmbed] });
                    }
                    
                    // Kasus 3: Hanya lawan yang sudah pilih
                    else if (!hostSudahPilih && opponentSudahPilih) {
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
                        
                        global.coinflips.delete(channel.id);
                        
                        const menangEmbed = new EmbedBuilder()
                            .setColor(0x00FF00)
                            .setTitle('🏆 ━━━━━ GameSen Coinflip ━━━━━ 🏆')
                            .setDescription(`
👤 **Pemenang :** ${opponent} (MENANG OTOMATIS)
👤 **Lawan :** ${host} (TIDAK MEMILIH)

💰 **Hadiah :** ${formatNumber(hadiah)} Coin
📊 **Fee (5%) :** ${formatNumber(fee)} Coin

━━━━━━━━━━━━━━━━━━━━━━
Host tidak memilih dalam 3 menit.
                            `)
                            .setTimestamp();
                        channel.send({ embeds: [menangEmbed] });
                    }
                }
            }, 3 * 60 * 1000);
            // ========== AKHIR TIMEOUT PILIH ==========

            game.choiceTimeoutId = choiceTimeoutId;
            global.coinflips.set(message.channel.id, game);

        } catch (error) {
            console.error('ERROR DI JOINCOIN:', error);
            message.reply('❌ Terjadi kesalahan. Mohon laporkan ke admin.');
        }
    }
};
