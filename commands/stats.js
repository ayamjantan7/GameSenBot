const { EmbedBuilder } = require('discord.js');
const { getUser, formatNumber } = require('../utils/helpers');

module.exports = {
    name: 'stats',
    description: 'Statistik pemain',
    async execute(message, args) {
        let target = message.author;
        if (args.length > 0) {
            const mention = message.mentions.users.first();
            if (mention) target = mention;
        }

        const user = await getUser(target.id, target.username);
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('📊 ━━━━━ GameSen Player Stats ━━━━━ 📊')
            .setDescription(`
👤 **Player :** ${target}
💰 **Coin :** ${formatNumber(user.saldo)}

🏆 **Total Menang :** ${user.totalMenang}
💀 **Total Kalah :** ${user.totalKalah}

🔥 **Winstreak :** ${user.winstreak}
👑 **Best Winstreak :** ${user.bestWinstreak}

📅 **Bergabung :** ${user.joinedAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}

━━━━━━━━━━━━━━━━━━━━━━
Tetap bermain dan kumpulkan coin 👑
            `)
            .setTimestamp();
        message.channel.send({ embeds: [embed] });
    }
};
