const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const { getUser, formatNumber } = require('../utils/helpers');
const logger = require('../utils/logger');

// Fungsi untuk menghitung nilai angka sesuai aturan reme
function calculateRemeValue(angka) {
    // Angka kuat
    if (angka === 0 || angka === 19 || angka === 28) {
        return { isKuat: true, value: angka };
    }
    
    // Angka 29 khusus = 1
    if (angka === 29) {
        return { isKuat: false, value: 1 };
    }
    
    // Hitung jumlah digit sampai 1 digit
    let num = angka;
    while (num >= 10) {
        let sum = 0;
        while (num > 0) {
            sum += num % 10;
            num = Math.floor(num / 10);
        }
        num = sum;
    }
    
    return { isKuat: false, value: num };
}

module.exports = {
    name: 'spinner',
    description: 'Spin untuk permainan reme',
    async execute(message, args) {
        try {
            if (!global.remes) {
                global.remes = new Map();
            }

            const game = global.remes.get(message.channel.id);
            if (!game) {
                return message.reply('❌ Tidak ada permainan reme yang sedang berlangsung.');
            }
            if (game.status !== 'spinning') {
                return message.reply('❌ Permainan tidak dalam tahap spin.');
            }

            let isHost = (message.author.id === game.hostId);
            let isOpponent = (message.author.id === game.opponentId);
            if (!isHost && !isOpponent) {
                return message.reply('❌ Kamu tidak terlibat dalam permainan ini.');
            }

            if (isHost && game.hostSpin !== null) {
                return message.reply('❌ Kamu sudah melakukan spin.');
            }
            if (isOpponent && game.opponentSpin !== null) {
                return message.reply('❌ Kamu sudah melakukan spin.');
            }

            const spin = Math.floor(Math.random() * 37);

            if (isHost) {
                game.hostSpin = spin;
            } else {
                game.opponentSpin = spin;
            }

            await message.reply(`🎲 Kamu mendapatkan angka **${spin}**!`);

            const channel = message.channel;
            const host = await channel.client.users.fetch(game.hostId);
            const opponent = await channel.client.users.fetch(game.opponentId);
            
            const statusEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🎯 ━━━━━ GameSen Reme ━━━━━ 🎯')
                .setDescription(`
**Host :** ${host} ${game.hostSpin !== null ? '✅ (sudah spin)' : '⏳ (belum spin)'}
**Lawan :** ${opponent} ${game.opponentSpin !== null ? '✅ (sudah spin)' : '⏳ (belum spin)'}
**Taruhan :** ${formatNumber(game.bet)} Coin

Ketik \`!spinner\` untuk spin!
                `)
                .setTimestamp();

            try {
                const msg = await channel.messages.fetch(game.messageId);
                await msg.edit({ embeds: [statusEmbed] });
            } catch (e) {
                console.log('Gagal update embed:', e);
            }

            // Cek apakah kedua sudah spin
            if (game.hostSpin !== null && game.opponentSpin !== null) {
                const hostSpin = game.hostSpin;
                const oppSpin = game.opponentSpin;
                
                const hostVal = calculateRemeValue(hostSpin);
                const oppVal = calculateRemeValue(oppSpin);

                // Kasus 1: Kedua angka kuat
                if (hostVal.isKuat && oppVal.isKuat) {
                    if (game.spinTimeoutId) {
                        clearTimeout(game.spinTimeoutId);
                    }
                    
                    game.hostSpin = null;
                    game.opponentSpin = null;
                    
                    const newSpinTimeoutId = setTimeout(async () => {
                        const currentGame = global.remes.get(channel.id);
                        if (currentGame && currentGame.status === 'spinning' && 
                            (currentGame.hostSpin === null || currentGame.opponentSpin === null)) {
                            
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
                                .setDescription(`Salah satu pemain tidak melakukan spin dalam 3 menit. Coin dikembalikan.`)
                                .setTimestamp();
                            channel.send({ embeds: [cancelEmbed] });
                        }
                    }, 3 * 60 * 1000);
                    
                    game.spinTimeoutId = newSpinTimeoutId;
                    global.remes.set(message.channel.id, game);

                    const seriEmbed = new EmbedBuilder()
                        .setColor(0xFFFF00)
                        .setTitle('🎯 ━━━━━ GameSen Reme ━━━━━ 🎯')
                        .setDescription(`
👤 **Host :** <@${game.hostId}> — 🎲 **${hostSpin}** (ANGKA KUAT)
👤 **Lawan :** <@${game.opponentId}> — 🎲 **${oppSpin}** (ANGKA KUAT)

⚖️ **Hasil SERI!** (Sesama angka kuat)
Silakan ketik \`!spinner\` lagi.
                        `)
                        .setFooter({ text: 'Gunakan coin dengan bijak 👑' })
                        .setTimestamp();
                    return message.channel.send({ embeds: [seriEmbed] });
                }

                // Kasus 2: Salah satu angka kuat
                let pemenang, kalah;
                if (hostVal.isKuat && !oppVal.isKuat) {
                    pemenang = game.hostId;
                    kalah = game.opponentId;
                } else if (!hostVal.isKuat && oppVal.isKuat) {
                    pemenang = game.opponentId;
                    kalah = game.hostId;
                } else {
                    // Kasus 3: Kedua angka biasa, bandingkan nilai
                    if (hostVal.value > oppVal.value) {
                        pemenang = game.hostId;
                        kalah = game.opponentId;
                    } else if (oppVal.value > hostVal.value) {
                        pemenang = game.opponentId;
                        kalah = game.hostId;
                    } else {
                        // Nilai sama, seri
                        if (game.spinTimeoutId) {
                            clearTimeout(game.spinTimeoutId);
                        }
                        
                        game.hostSpin = null;
                        game.opponentSpin = null;
                        
                        const newSpinTimeoutId = setTimeout(async () => {
                            const currentGame = global.remes.get(channel.id);
                            if (currentGame && currentGame.status === 'spinning' && 
                                (currentGame.hostSpin === null || currentGame.opponentSpin === null)) {
                                
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
                                    .setDescription(`Salah satu pemain tidak melakukan spin dalam 3 menit. Coin dikembalikan.`)
                                    .setTimestamp();
                                channel.send({ embeds: [cancelEmbed] });
                            }
                        }, 3 * 60 * 1000);
                        
                        game.spinTimeoutId = newSpinTimeoutId;
                        global.remes.set(message.channel.id, game);

                        const seriEmbed = new EmbedBuilder()
                            .setColor(0xFFFF00)
                            .setTitle('🎯 ━━━━━ GameSen Reme ━━━━━ 🎯')
                            .setDescription(`
👤 **Host :** <@${game.hostId}> — 🎲 **${hostSpin}** (nilai ${hostVal.value})
👤 **Lawan :** <@${game.opponentId}> — 🎲 **${oppSpin}** (nilai ${oppVal.value})

⚖️ **Hasil SERI!** (Nilai sama)
Silakan ketik \`!spinner\` lagi.
                            `)
                            .setFooter({ text: 'Gunakan coin dengan bijak 👑' })
                            .setTimestamp();
                        return message.channel.send({ embeds: [seriEmbed] });
                    }
                }

                const totalPot = game.bet * 2;
                const fee = Math.floor(totalPot * 0.05);
                const hadiah = totalPot - fee;

                const pemenangUser = await getUser(pemenang, pemenang === game.hostId ? host.username : opponent.username);
                const kalahUser = await getUser(kalah, kalah === game.hostId ? host.username : opponent.username);

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

                if (game.spinTimeoutId) {
                    clearTimeout(game.spinTimeoutId);
                }

                global.remes.delete(message.channel.id);

                let hasilDesc = '';
                if (hostVal.isKuat || oppVal.isKuat) {
                    hasilDesc = `
👤 **Host :** <@${game.hostId}> — 🎲 **${hostSpin}** ${hostVal.isKuat ? '(ANGKA KUAT)' : `(nilai ${hostVal.value})`}
👤 **Lawan :** <@${game.opponentId}> — 🎲 **${oppSpin}** ${oppVal.isKuat ? '(ANGKA KUAT)' : `(nilai ${oppVal.value})`}

🏆 **Pemenang :** <@${pemenang}>
💰 **Hadiah :** ${formatNumber(hadiah)} Coin
📊 **Fee (5%) :** ${formatNumber(fee)} Coin
                    `;
                } else {
                    hasilDesc = `
👤 **Host :** <@${game.hostId}> — 🎲 **${hostSpin}** (nilai ${hostVal.value})
👤 **Lawan :** <@${game.opponentId}> — 🎲 **${oppSpin}** (nilai ${oppVal.value})

🏆 **Pemenang :** <@${pemenang}>
💰 **Hadiah :** ${formatNumber(hadiah)} Coin
📊 **Fee (5%) :** ${formatNumber(fee)} Coin
                    `;
                }

                const hasilEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('🎯 ━━━━━ GameSen Reme ━━━━━ 🎯')
                    .setDescription(hasilDesc + '\n\n━━━━━━━━━━━━━━━━━━━━━━\nGunakan coin dengan bijak 👑')
                    .setTimestamp();
                await message.channel.send({ embeds: [hasilEmbed] });

                try {
                    await logger.logReme(game.hostId, game.opponentId, game.bet, hostSpin, oppSpin, pemenang, fee, hadiah, hostVal.isKuat, oppVal.isKuat);
                } catch (e) {
                    console.log('Gagal log reme:', e);
                }
            }
        } catch (error) {
            console.error('ERROR DI SPINNER:', error);
            message.reply('❌ Terjadi kesalahan. Mohon laporkan ke admin.');
        }
    }
};
