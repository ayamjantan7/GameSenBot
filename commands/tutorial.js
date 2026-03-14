const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'tutorial',
    description: 'Panduan bermain',
    async execute(message, args) {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📚 ━━━━━ GameSen Tutorial ━━━━━ 📚')
            .setDescription(`
**!duel @lawan <jumlah>**  
Membuat duel 1v1 dengan taruhan. Lawan ketik !join untuk menerima.

**!join**  
Bergabung ke duel yang tersedia.

**!spin**  
Melakukan spin untuk duel (hanya peserta).

**!saldo**  
Melihat jumlah coin kamu.

**!tfcoin @user <jumlah>**  
Transfer coin ke pemain lain (min 5000, biaya admin 5%).

**!top**  
Melihat leaderboard coin.

**!stats**  
Melihat statistik pemain.

━━━━━━━━━━━━━━━━━━━━━━
Gunakan semua command di channel <#${process.env.PLAY_CHANNEL_ID}>
            `)
            .setTimestamp();
        message.channel.send({ embeds: [embed] });
    }
};
