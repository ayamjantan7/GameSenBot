const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const { getUser, formatNumber } = require('../utils/helpers');

// Store game sessions
const games = new Map();

// Fruit emojis for random display
const fruitEmojis = ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒', '🍑', '🥭'];

// Level configurations
const levels = [
    { boxes: 3, bombs: 1 }, // Level 1: 3 kotak, 1 bom
    { boxes: 6, bombs: 2 }, // Level 2: 6 kotak, 2 bom
    { boxes: 9, bombs: 3 }  // Level 3: 9 kotak, 3 bom
];

module.exports = {
    name: 'bom',
    description: 'Game tebak bom (have fun)',
    async execute(message, args) {
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
            currentLevel: 0, // 0 = level 1, 1 = level 2, 2 = level 3
            bombs: [],
            fruits: [],
            messageId: null,
            status: 'playing'
        };

        // Setup level 1
        setupLevel(game, 0);

        // Kirim embed level 1
        const embed = createGameEmbed(game, message.author);
        const row = createButtons(game);

        const sentMsg = await message.channel.send({
            embeds: [embed],
            components: [row]
        });

        game.messageId = sentMsg.id;
        games.set(gameKey, game);

        // Collector untuk button clicks
        const collector = sentMsg.createMessageComponentCollector({
            filter: i => i.user.id === userId,
            time: 60000 // 1 menit
        });

        collector.on('collect', async i => {
            const gameKey = `${i.channelId}-${i.user.id}`;
            const currentGame = games.get(gameKey);

            if (!currentGame || currentGame.status !== 'playing') {
                await i.reply({ content: '❌ Game sudah berakhir!', ephemeral: true });
                return;
            }

            const boxIndex = parseInt(i.customId) - 1;
            const level = levels[currentGame.currentLevel];
            
            // Cek apakah kotak yang dipilih adalah bom
            if (currentGame.bombs.includes(boxIndex)) {
                // KENA BOM - Game Over
                currentGame.status = 'gameover';
                
                // Tampilkan semua kotak (bom dan buah)
                const revealEmbed = createRevealEmbed(currentGame, i.user, boxIndex, true);
                
                await i.update({
                    embeds: [revealEmbed],
                    components: [] // Hapus semua button
                });

                games.delete(gameKey);
            } else {
                // Dapat BUAH - Lanjut level
                const fruitIndex = currentGame.fruits[boxIndex];
                const fruitEmoji = fruitEmojis[fruitIndex % fruitEmojis.length];
                
                // Cek apakah ini level terakhir
                if (currentGame.currentLevel === levels.length - 1) {
                    // MENANG SEMUA LEVEL - Dapat hadiah 100 coin
                    const user = await getUser(i.user.id, i.user.username);
                    user.saldo += 100;
                    await user.save();

                    const winEmbed = new EmbedBuilder()
                        .setColor(0xFFD700)
                        .setTitle('🏆 ━━━━━ GameSen BOM ━━━━━ 🏆')
                        .setDescription(`
🎉 **SELAMAT!** Kamu menang semua level!

💰 **Hadiah :** 100 Coin
💳 **Saldo sekarang :** ${formatNumber(user.saldo)} Coin

Terima kasih sudah bermain! 🎮
                        `)
                        .setTimestamp();

                    // Tampilkan reveal level terakhir
                    const revealEmbed = createRevealEmbed(currentGame, i.user, boxIndex, false);
                    
                    await i.update({
                        embeds: [revealEmbed],
                        components: []
                    });

                    // Kirim embed kemenangan
                    await i.followUp({ embeds: [winEmbed] });
                    
                    games.delete(gameKey);
                } else {
                    // Lanjut ke level berikutnya
                    currentGame.currentLevel++;
                    setupLevel(currentGame, currentGame.currentLevel);
                    
                    const nextEmbed = createGameEmbed(currentGame, i.user);
                    const nextRow = createButtons(currentGame);
                    
                    await i.update({
                        embeds: [nextEmbed],
                        components: [nextRow]
                    });

                    // Kirim pesan selamat
                    await i.followUp({
                        content: `🎉 **Level ${currentGame.currentLevel}**! Kamu dapat ${fruitEmoji} Lanjut ya!`,
                        ephemeral: true
                    });
                }
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                const gameKey = `${channelId}-${userId}`;
                if (games.has(gameKey)) {
                    const timeoutEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('⏰ ━━━━━ GameSen BOM ━━━━━ ⏰')
                        .setDescription('Waktu habis! Game dibatalkan. Ketik `!bom` untuk main lagi.')
                        .setTimestamp();

                    try {
                        const msg = await message.channel.messages.fetch(game.messageId);
                        await msg.edit({ embeds: [timeoutEmbed], components: [] });
                    } catch (e) {}
                    
                    games.delete(gameKey);
                }
            }
        });
    }
};

// Fungsi untuk setup level (generate bom dan buah)
function setupLevel(game, levelIndex) {
    const level = levels[levelIndex];
    const totalBoxes = level.boxes;
    const bombCount = level.bombs;
    
    // Buat array index 0 sampai totalBoxes-1
    const indices = Array.from({ length: totalBoxes }, (_, i) => i);
    
    // Acak array untuk menentukan posisi bom
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    // Ambil bombCount index pertama sebagai bom
    game.bombs = indices.slice(0, bombCount);
    
    // Sisa index sebagai buah
    const fruitIndices = indices.slice(bombCount);
    game.fruits = {};
    
    // Assign buah random ke setiap kotak non-bom
    fruitIndices.forEach((boxIndex, i) => {
        game.fruits[boxIndex] = i % fruitEmojis.length;
    });
}

// Fungsi untuk membuat embed game
function createGameEmbed(game, user) {
    const level = levels[game.currentLevel];
    const currentLevelNum = game.currentLevel + 1;
    const totalLevels = levels.length;
    
    // Buat tampilan kotak-kotak
    let boxesDisplay = '';
    for (let i = 0; i < level.boxes; i++) {
        boxesDisplay += `┃   ${i+1}   `;
        if ((i + 1) % 3 === 0 || i === level.boxes - 1) {
            boxesDisplay += '┃\n';
            for (let j = i - 2; j <= i; j++) {
                if (j >= 0 && j < level.boxes) {
                    boxesDisplay += `┃   ❓   `;
                }
            }
            boxesDisplay += '┃\n';
            if (i < level.boxes - 1) {
                boxesDisplay += '┣━━━━━━━╋━━━━━━━╋━━━━━━━┫\n';
            }
        }
    }
    
    // Header
    const header = '┏━━━━━━━┳━━━━━━━┳━━━━━━━┓\n';
    const footer = '┗━━━━━━━┻━━━━━━━┻━━━━━━━┛';
    
    const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('💣 ━━━━━ GameSen BOM ━━━━━ 💣')
        .setDescription(`
👤 **Player :** ${user}
📊 **Level :** ${currentLevelNum}/${totalLevels}
📦 **Kotak :** ${level.boxes} (${level.bombs} bom)

${header}${boxesDisplay}${footer}

Pilih kotak dengan klik tombol di bawah!
        `)
        .setTimestamp();

    return embed;
}

// Fungsi untuk membuat tombol
function createButtons(game) {
    const level = levels[game.currentLevel];
    const row = new ActionRowBuilder();
    
    const emojiNumbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
    
    for (let i = 0; i < level.boxes; i++) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`${i+1}`)
                .setLabel(`${i+1}`)
                .setStyle(ButtonStyle.Primary)
                .setEmoji(emojiNumbers[i])
        );
    }
    
    return row;
}

// Fungsi untuk membuat embed reveal (setelah game over atau menang)
function createRevealEmbed(game, user, selectedIndex, isBomb) {
    const level = levels[game.currentLevel];
    const currentLevelNum = game.currentLevel + 1;
    const totalLevels = levels.length;
    
    let boxesDisplay = '';
    for (let i = 0; i < level.boxes; i++) {
        let content;
        if (game.bombs.includes(i)) {
            content = '💣';
        } else {
            const fruitIndex = game.fruits[i];
            content = fruitEmojis[fruitIndex % fruitEmojis.length];
        }
        
        // Highlight kotak yang dipilih
        if (i === selectedIndex) {
            boxesDisplay += `┃   **▶${i+1}**   `;
        } else {
            boxesDisplay += `┃   ${i+1}   `;
        }
        
        if ((i + 1) % 3 === 0 || i === level.boxes - 1) {
            boxesDisplay += '┃\n';
            for (let j = i - 2; j <= i; j++) {
                if (j >= 0 && j < level.boxes) {
                    if (j === selectedIndex) {
                        boxesDisplay += `┃   **▶${content}**   `;
                    } else {
                        boxesDisplay += `┃   ${content}   `;
                    }
                }
            }
            boxesDisplay += '┃\n';
            if (i < level.boxes - 1) {
                boxesDisplay += '┣━━━━━━━╋━━━━━━━╋━━━━━━━┫\n';
            }
        }
    }
    
    const header = '┏━━━━━━━┳━━━━━━━┳━━━━━━━┓\n';
    const footer = '┗━━━━━━━┻━━━━━━━┻━━━━━━━┛';
    
    let title, color, resultText;
    
    if (isBomb) {
        title = '💥 ━━━━━ GameSen BOM ━━━━━ 💥';
        color = 0xFF0000;
        resultText = `💥 **BOOM!** Kamu kena bom di kotak **${selectedIndex+1}**!\nGame over. Coba lagi dengan \`!bom\``;
    } else {
        title = '🎉 ━━━━━ GameSen BOM ━━━━━ 🎉';
        color = 0x00FF00;
        resultText = `🎉 Kamu dapat ${fruitEmojis[game.fruits[selectedIndex] % fruitEmojis.length]} di kotak **${selectedIndex+1}**!`;
    }
    
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(`
👤 **Player :** ${user}
📊 **Level :** ${currentLevelNum}/${totalLevels}

${resultText}

${header}${boxesDisplay}${footer}
        `)
        .setTimestamp();

    return embed;
}
