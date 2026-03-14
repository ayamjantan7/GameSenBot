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
            currentLevel: 0,
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
            // LANGSUNG DEFER UPDATE agar tidak timeout
            await i.deferUpdate();
            
            const gameKey = `${i.channelId}-${i.user.id}`;
            const currentGame = games.get(gameKey);

            if (!currentGame || currentGame.status !== 'playing') {
                await i.followUp({ content: '❌ Game sudah berakhir!', ephemeral: true });
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
                
                await i.editOriginalMessage({
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

                    // Tampilkan reveal level terakhir
                    const revealEmbed = createRevealEmbed(currentGame, i.user, boxIndex, false);
                    
                    await i.editOriginalMessage({
                        embeds: [revealEmbed],
                        components: []
                    });

                    // Kirim embed kemenangan (pakai followUp karena sudah deferUpdate)
                    const winEmbed = new EmbedBuilder()
                        .setColor(0xFFD700)
                        .setTitle('🏆 ━━━━━ GameSen BOM ━━━━━ 🏆')
                        .setDescription(`
╔══════════════════════════════╗
║         🎉 VICTORY! 🎉        ║
╚══════════════════════════════╝

👑 **Selamat!** Kamu berhasil menaklukkan semua level!

━━━━━━━━━━━━━━━━━━━━━━
💰 **Hadiah Utama :** 100 Coin
💳 **Saldo Sekarang :** ${formatNumber(user.saldo)} Coin
━━━━━━━━━━━━━━━━━━━━━━

Terima kasih sudah bermain! 🎮
                        `)
                        .setFooter({ text: 'Main lagi dengan !bom' })
                        .setTimestamp();

                    await i.followUp({ embeds: [winEmbed] });
                    
                    games.delete(gameKey);
                } else {
                    // Lanjut ke level berikutnya
                    currentGame.currentLevel++;
                    setupLevel(currentGame, currentGame.currentLevel);
                    
                    const nextEmbed = createGameEmbed(currentGame, i.user);
                    const nextRow = createButtons(currentGame);
                    
                    await i.editOriginalMessage({
                        embeds: [nextEmbed],
                        components: [nextRow]
                    });

                    // Kirim pesan selamat (pakai followUp)
                    await i.followUp({
                        content: `✨ **Level ${currentGame.currentLevel + 1}**! Kamu dapat ${fruitEmoji} Lanjutkan!`,
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
                        .setDescription(`
╔══════════════════════════════╗
║         ⏰ TIME OUT! ⏰        ║
╚══════════════════════════════╝

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

// Fungsi untuk membuat embed game dengan tampilan lebih keren
function createGameEmbed(game, user) {
    const level = levels[game.currentLevel];
    const currentLevelNum = game.currentLevel + 1;
    const totalLevels = levels.length;
    
    // Buat tampilan kotak yang lebih keren
    let boxesDisplay = '';
    
    if (level.boxes === 3) {
        boxesDisplay = `
╔═══════╦═══════╦═══════╗
║   1   ║   2   ║   3   ║
║   ❓   ║   ❓   ║   ❓   ║
╚═══════╩═══════╩═══════╝`;
    } else if (level.boxes === 6) {
        boxesDisplay = `
╔═══════╦═══════╦═══════╦═══════╦═══════╦═══════╗
║   1   ║   2   ║   3   ║   4   ║   5   ║   6   ║
║   ❓   ║   ❓   ║   ❓   ║   ❓   ║   ❓   ║   ❓   ║
╚═══════╩═══════╩═══════╩═══════╩═══════╩═══════╝`;
    } else if (level.boxes === 9) {
        boxesDisplay = `
╔═══════╦═══════╦═══════╦═══════╦═══════╦═══════╦═══════╦═══════╦═══════╗
║   1   ║   2   ║   3   ║   4   ║   5   ║   6   ║   7   ║   8   ║   9   ║
║   ❓   ║   ❓   ║   ❓   ║   ❓   ║   ❓   ║   ❓   ║   ❓   ║   ❓   ║   ❓   ║
╚═══════╩═══════╩═══════╩═══════╩═══════╩═══════╩═══════╩═══════╩═══════╝`;
    }
    
    const embed = new EmbedBuilder()
        .setColor(0xFF6B6B)
        .setTitle('💣 ━━━━━ GameSen BOM ━━━━━ 💣')
        .setDescription(`
╔══════════════════════════════╗
║         🎮 GAME BOM 🎮        ║
╚══════════════════════════════╝

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

// Fungsi untuk membuat tombol
function createButtons(game) {
    const level = levels[game.currentLevel];
    const rows = [];
    
    const emojiNumbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
    
    if (level.boxes <= 3) {
        // Satu row untuk 3 kotak
        const row = new ActionRowBuilder();
        for (let i = 0; i < level.boxes; i++) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${i+1}`)
                    .setLabel(`Kotak ${i+1}`)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(emojiNumbers[i])
            );
        }
        rows.push(row);
    } else if (level.boxes <= 6) {
        // Dua row untuk 6 kotak
        const row1 = new ActionRowBuilder();
        const row2 = new ActionRowBuilder();
        
        for (let i = 0; i < 3; i++) {
            row1.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${i+1}`)
                    .setLabel(`Kotak ${i+1}`)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(emojiNumbers[i])
            );
        }
        
        for (let i = 3; i < 6; i++) {
            row2.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${i+1}`)
                    .setLabel(`Kotak ${i+1}`)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(emojiNumbers[i])
            );
        }
        
        rows.push(row1, row2);
    } else {
        // Tiga row untuk 9 kotak
        const row1 = new ActionRowBuilder();
        const row2 = new ActionRowBuilder();
        const row3 = new ActionRowBuilder();
        
        for (let i = 0; i < 3; i++) {
            row1.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${i+1}`)
                    .setLabel(`Kotak ${i+1}`)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(emojiNumbers[i])
            );
        }
        
        for (let i = 3; i < 6; i++) {
            row2.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${i+1}`)
                    .setLabel(`Kotak ${i+1}`)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(emojiNumbers[i])
            );
        }
        
        for (let i = 6; i < 9; i++) {
            row3.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${i+1}`)
                    .setLabel(`Kotak ${i+1}`)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(emojiNumbers[i])
            );
        }
        
        rows.push(row1, row2, row3);
    }
    
    return rows;
}

// Fungsi untuk membuat embed reveal (setelah game over atau menang)
function createRevealEmbed(game, user, selectedIndex, isBomb) {
    const level = levels[game.currentLevel];
    const currentLevelNum = game.currentLevel + 1;
    const totalLevels = levels.length;
    
    // Buat array untuk menyimpan isi kotak
    const boxContents = [];
    for (let i = 0; i < level.boxes; i++) {
        if (game.bombs.includes(i)) {
            boxContents.push('💣');
        } else {
            const fruitIndex = game.fruits[i];
            boxContents.push(fruitEmojis[fruitIndex % fruitEmojis.length]);
        }
    }
    
    // Buat tampilan kotak dengan isi
    let boxesDisplay = '';
    
    if (level.boxes === 3) {
        boxesDisplay = `
╔═══════╦═══════╦═══════╗
║   1   ║   2   ║   3   ║
║  ${boxContents[0]}   ║  ${boxContents[1]}   ║  ${boxContents[2]}   ║
╚═══════╩═══════╩═══════╝`;
        
        // Tambahin panah ke kotak yang dipilih
        if (selectedIndex === 0) boxesDisplay += `\n     ⬆️ Pilihanmu`;
        else if (selectedIndex === 1) boxesDisplay += `\n           ⬆️ Pilihanmu`;
        else if (selectedIndex === 2) boxesDisplay += `\n                 ⬆️ Pilihanmu`;
        
    } else if (level.boxes === 6) {
        boxesDisplay = `
╔═══════╦═══════╦═══════╦═══════╦═══════╦═══════╗
║   1   ║   2   ║   3   ║   4   ║   5   ║   6   ║
║  ${boxContents[0]}   ║  ${boxContents[1]}   ║  ${boxContents[2]}   ║  ${boxContents[3]}   ║  ${boxContents[4]}   ║  ${boxContents[5]}   ║
╚═══════╩═══════╩═══════╩═══════╩═══════╩═══════╝`;
        
        // Tambahin panah
        if (selectedIndex === 0) boxesDisplay += `\n⬆️ Pilihanmu`;
        else if (selectedIndex === 1) boxesDisplay += `\n     ⬆️ Pilihanmu`;
        else if (selectedIndex === 2) boxesDisplay += `\n          ⬆️ Pilihanmu`;
        else if (selectedIndex === 3) boxesDisplay += `\n               ⬆️ Pilihanmu`;
        else if (selectedIndex === 4) boxesDisplay += `\n                    ⬆️ Pilihanmu`;
        else if (selectedIndex === 5) boxesDisplay += `\n                         ⬆️ Pilihanmu`;
        
    } else if (level.boxes === 9) {
        boxesDisplay = `
╔═══════╦═══════╦═══════╦═══════╦═══════╦═══════╦═══════╦═══════╦═══════╗
║   1   ║   2   ║   3   ║   4   ║   5   ║   6   ║   7   ║   8   ║   9   ║
║  ${boxContents[0]}   ║  ${boxContents[1]}   ║  ${boxContents[2]}   ║  ${boxContents[3]}   ║  ${boxContents[4]}   ║  ${boxContents[5]}   ║  ${boxContents[6]}   ║  ${boxContents[7]}   ║  ${boxContents[8]}   ║
╚═══════╩═══════╩═══════╩═══════╩═══════╩═══════╩═══════╩═══════╩═══════╝`;
        
        // Tambahin panah
        if (selectedIndex === 0) boxesDisplay += `\n⬆️ Pilihanmu`;
        else if (selectedIndex === 1) boxesDisplay += `\n    ⬆️ Pilihanmu`;
        else if (selectedIndex === 2) boxesDisplay += `\n         ⬆️ Pilihanmu`;
        else if (selectedIndex === 3) boxesDisplay += `\n              ⬆️ Pilihanmu`;
        else if (selectedIndex === 4) boxesDisplay += `\n                   ⬆️ Pilihanmu`;
        else if (selectedIndex === 5) boxesDisplay += `\n                        ⬆️ Pilihanmu`;
        else if (selectedIndex === 6) boxesDisplay += `\n                             ⬆️ Pilihanmu`;
        else if (selectedIndex === 7) boxesDisplay += `\n                                  ⬆️ Pilihanmu`;
        else if (selectedIndex === 8) boxesDisplay += `\n                                       ⬆️ Pilihanmu`;
    }
    
    let title, color, resultText, resultEmoji;
    
    if (isBomb) {
        title = '💥 ━━━━━ GameSen BOM ━━━━━ 💥';
        color = 0xFF0000;
        resultEmoji = '💣';
        resultText = `**BOOM!** Kamu kena bom di kotak **${selectedIndex+1}**!`;
    } else {
        title = '🎉 ━━━━━ GameSen BOM ━━━━━ 🎉';
        color = 0x00FF00;
        resultEmoji = fruitEmojis[game.fruits[selectedIndex] % fruitEmojis.length];
        resultText = `**SELAMAT!** Kamu dapat ${resultEmoji} di kotak **${selectedIndex+1}**!`;
    }
    
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(`
╔══════════════════════════════╗
║         ${isBomb ? '💥 GAME OVER 💥' : '✨ LEVEL CLEAR ✨'}        ║
╚══════════════════════════════╝

👤 **Player :** ${user}
📊 **Level :** ${currentLevelNum}/${totalLevels}
━━━━━━━━━━━━━━━━━━━━━━
${resultText}
━━━━━━━━━━━━━━━━━━━━━━
${boxesDisplay}
━━━━━━━━━━━━━━━━━━━━━━
${isBomb ? '😵 Coba lagi dengan `!bom`' : '✅ Lanjut ke level berikutnya!'}
        `)
        .setFooter({ text: isBomb ? '💥 Bye bye nyawa...' : '🎯 Semoga beruntung di level selanjutnya!' })
        .setTimestamp();

    return embed;
}
