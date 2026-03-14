const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const { getUser, formatNumber } = require('../utils/helpers');

// Store game sessions
const games = new Map();

// Fruit emojis
const fruitEmojis = ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒', '🍑', '🥭'];

// Level configurations
const levels = [
    { boxes: 3, bombs: 1 },
    { boxes: 6, bombs: 2 },
    { boxes: 9, bombs: 3 }
];

module.exports = {
    name: 'bom',
    description: 'Game tebak bom (have fun)',
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const channelId = message.channel.id;
            const gameKey = `${channelId}-${userId}`;

            // Cek apakah user sudah punya game berjalan
            if (games.has(gameKey)) {
                return message.reply('❌ Kamu masih punya game bom yang belum selesai! Selesaikan dulu ya.');
            }

            // Inisialisasi game baru
            const game = {
                userId: userId,
                channelId: channelId,
                currentLevel: 0,
                bombs: [],
                fruits: [],
                messageId: null,
                status: 'playing'
            };

            // Setup level 1
            setupLevel(game, 0);

            // Buat embed dan tombol
            const embed = createGameEmbed(game, message.author);
            const rows = createButtons(game);

            const sentMsg = await message.channel.send({
                embeds: [embed],
                components: rows
            });

            game.messageId = sentMsg.id;
            games.set(gameKey, game);

            // Collector untuk button clicks
            const collector = sentMsg.createMessageComponentCollector({
                filter: i => i.user.id === userId,
                time: 60000,
                idle: 30000
            });

            collector.on('collect', async i => {
                try {
                    // Cek apakah game masih ada
                    const currentGame = games.get(gameKey);
                    if (!currentGame || currentGame.status !== 'playing') {
                        await i.reply({ 
                            content: '❌ Game sudah berakhir!', 
                            ephemeral: true 
                        });
                        return;
                    }

                    const boxIndex = parseInt(i.customId) - 1;
                    
                    // Cek apakah kotak yang dipilih adalah bom
                    if (currentGame.bombs.includes(boxIndex)) {
                        // KENA BOM - Game Over
                        currentGame.status = 'gameover';
                        
                        // Buat reveal embed
                        const revealEmbed = createRevealEmbed(currentGame, i.user, boxIndex, true);
                        
                        // Update pesan
                        await i.update({
                            embeds: [revealEmbed],
                            components: []
                        });

                        // Hapus game dari memory
                        games.delete(gameKey);
                        
                    } else {
                        // Dapat BUAH
                        const fruitIndex = currentGame.fruits[boxIndex];
                        const fruitEmoji = fruitEmojis[fruitIndex % fruitEmojis.length];
                        
                        // Cek apakah ini level terakhir
                        if (currentGame.currentLevel === levels.length - 1) {
                            // MENANG SEMUA LEVEL
                            const user = await getUser(i.user.id, i.user.username);
                            user.saldo += 100;
                            await user.save();

                            // Buat reveal embed
                            const revealEmbed = createRevealEmbed(currentGame, i.user, boxIndex, false);
                            
                            // Update pesan
                            await i.update({
                                embeds: [revealEmbed],
                                components: []
                            });

                            // Kirim pesan kemenangan
                            const winEmbed = new EmbedBuilder()
                                .setColor(0xFFD700)
                                .setTitle('🏆 ━━━━━ GameSen BOM ━━━━━ 🏆')
                                .setDescription(`
🎉 **SELAMAT!** Kamu berhasil menaklukkan semua level!

💰 **Hadiah :** 100 Coin
💳 **Saldo sekarang :** ${formatNumber(user.saldo)} Coin

Terima kasih sudah bermain! 🎮
                                `)
                                .setFooter({ text: 'Main lagi dengan !bom' })
                                .setTimestamp();

                            await i.followUp({ embeds: [winEmbed] });
                            
                            // Hapus game dari memory
                            games.delete(gameKey);
                            
                        } else {
                            // Lanjut ke level berikutnya
                            currentGame.currentLevel++;
                            setupLevel(currentGame, currentGame.currentLevel);
                            
                            // Buat embed baru untuk level berikutnya
                            const nextEmbed = createGameEmbed(currentGame, i.user);
                            const nextRows = createButtons(currentGame);
                            
                            // Update pesan
                            await i.update({
                                embeds: [nextEmbed],
                                components: nextRows
                            });

                            // Kirim pesan selamat
                            await i.followUp({
                                content: `🎉 **Level ${currentGame.currentLevel + 1}!** Kamu dapat ${fruitEmoji} Lanjutkan!`,
                                ephemeral: true
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error di collector:', error);
                    
                    // Kalau error, coba reply aja
                    try {
                        await i.reply({ 
                            content: '❌ Terjadi kesalahan. Silakan coba lagi dengan `!bom`', 
                            ephemeral: true 
                        });
                    } catch (e) {}
                    
                    // Hapus game dari memory
                    games.delete(gameKey);
                }
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time' || reason === 'idle') {
                    if (games.has(gameKey)) {
                        const timeoutEmbed = new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setTitle('⏰ ━━━━━ GameSen BOM ━━━━━ ⏰')
                            .setDescription(`
Waktu habis! Game dibatalkan.

Ketik \`!bom\` untuk memulai game baru.
                            `)
                            .setTimestamp();

                        try {
                            const msg = await message.channel.messages.fetch(game.messageId);
                            await msg.edit({ embeds: [timeoutEmbed], components: [] });
                        } catch (e) {}
                        
                        games.delete(gameKey);
                    }
                }
            });

        } catch (error) {
            console.error('Error di bom.js:', error);
            message.reply('❌ Terjadi kesalahan saat menjalankan command.');
        }
    }
};

// Setup level
function setupLevel(game, levelIndex) {
    const level = levels[levelIndex];
    const totalBoxes = level.boxes;
    const bombCount = level.bombs;
    
    const indices = Array.from({ length: totalBoxes }, (_, i) => i);
    
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    game.bombs = indices.slice(0, bombCount);
    
    const fruitIndices = indices.slice(bombCount);
    game.fruits = {};
    
    fruitIndices.forEach((boxIndex, i) => {
        game.fruits[boxIndex] = i % fruitEmojis.length;
    });
}

// Create game embed
function createGameEmbed(game, user) {
    const level = levels[game.currentLevel];
    const currentLevelNum = game.currentLevel + 1;
    const totalLevels = levels.length;
    
    let boxesDisplay = '';
    for (let i = 0; i < level.boxes; i++) {
        boxesDisplay += `\`[${i+1}]\` `;
        if ((i + 1) % 3 === 0) boxesDisplay += '\n';
    }
    
    const embed = new EmbedBuilder()
        .setColor(0xFF6B6B)
        .setTitle('💣 ━━━━━ GameSen BOM ━━━━━ 💣')
        .setDescription(`
👤 **Player :** ${user}
📊 **Level :** ${currentLevelNum}/${totalLevels}
💣 **Bom :** ${level.bombs} kotak
━━━━━━━━━━━━━━━━━━━━━━
${boxesDisplay}
━━━━━━━━━━━━━━━━━━━━━━
✨ **Pilih kotak dengan klik tombol di bawah!**
        `)
        .setFooter({ text: 'Hati-hati dengan bom! 💥' })
        .setTimestamp();

    return embed;
}

// Create buttons
function createButtons(game) {
    const level = levels[game.currentLevel];
    const rows = [];
    
    if (level.boxes <= 3) {
        const row = new ActionRowBuilder();
        for (let i = 0; i < level.boxes; i++) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${i+1}`)
                    .setLabel(`Kotak ${i+1}`)
                    .setStyle(ButtonStyle.Primary)
            );
        }
        rows.push(row);
    } else if (level.boxes <= 6) {
        const row1 = new ActionRowBuilder();
        const row2 = new ActionRowBuilder();
        
        for (let i = 0; i < 3; i++) {
            row1.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${i+1}`)
                    .setLabel(`Kotak ${i+1}`)
                    .setStyle(ButtonStyle.Primary)
            );
        }
        
        for (let i = 3; i < 6; i++) {
            row2.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${i+1}`)
                    .setLabel(`Kotak ${i+1}`)
                    .setStyle(ButtonStyle.Primary)
            );
        }
        
        rows.push(row1, row2);
    } else {
        const row1 = new ActionRowBuilder();
        const row2 = new ActionRowBuilder();
        const row3 = new ActionRowBuilder();
        
        for (let i = 0; i < 3; i++) {
            row1.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${i+1}`)
                    .setLabel(`Kotak ${i+1}`)
                    .setStyle(ButtonStyle.Primary)
            );
        }
        
        for (let i = 3; i < 6; i++) {
            row2.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${i+1}`)
                    .setLabel(`Kotak ${i+1}`)
                    .setStyle(ButtonStyle.Primary)
            );
        }
        
        for (let i = 6; i < 9; i++) {
            row3.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${i+1}`)
                    .setLabel(`Kotak ${i+1}`)
                    .setStyle(ButtonStyle.Primary)
            );
        }
        
        rows.push(row1, row2, row3);
    }
    
    return rows;
}

// Create reveal embed
function createRevealEmbed(game, user, selectedIndex, isBomb) {
    const level = levels[game.currentLevel];
    const currentLevelNum = game.currentLevel + 1;
    const totalLevels = levels.length;
    
    const boxContents = [];
    for (let i = 0; i < level.boxes; i++) {
        if (game.bombs.includes(i)) {
            boxContents.push('💣');
        } else {
            const fruitIndex = game.fruits[i];
            boxContents.push(fruitEmojis[fruitIndex % fruitEmojis.length]);
        }
    }
    
    let boxesDisplay = '';
    for (let i = 0; i < level.boxes; i++) {
        if (i === selectedIndex) {
            boxesDisplay += `**\`[${boxContents[i]}]\`** `;
        } else {
            boxesDisplay += `\`[${boxContents[i]}]\` `;
        }
        if ((i + 1) % 3 === 0) boxesDisplay += '\n';
    }
    
    let title, color, resultText;
    
    if (isBomb) {
        title = '💥 ━━━━━ GameSen BOM ━━━━━ 💥';
        color = 0xFF0000;
        resultText = `💥 **BOOM!** Kamu kena bom di kotak **${selectedIndex+1}**!`;
    } else {
        title = '🎉 ━━━━━ GameSen BOM ━━━━━ 🎉';
        color = 0x00FF00;
        resultText = `🎉 **SELAMAT!** Kamu dapat ${boxContents[selectedIndex]} di kotak **${selectedIndex+1}**!`;
    }
    
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(`
👤 **Player :** ${user}
📊 **Level :** ${currentLevelNum}/${totalLevels}
━━━━━━━━━━━━━━━━━━━━━━
${resultText}
━━━━━━━━━━━━━━━━━━━━━━
${boxesDisplay}
━━━━━━━━━━━━━━━━━━━━━━
${isBomb ? '😵 Coba lagi dengan `!bom`' : '✅ Lanjut ke level berikutnya!'}
        `)
        .setFooter({ text: isBomb ? '💥 Bye bye nyawa...' : '🎯 Semoga beruntung!' })
        .setTimestamp();

    return embed;
}
