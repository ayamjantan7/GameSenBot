const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const { formatNumber } = require('../utils/helpers');

module.exports = {
    name: 'top',
    description: 'Top 10 user dengan coin terbanyak',
    async execute(message, args) {
        const users = await User.find().sort({ saldo: -1 }).limit(10);

        if (users.length === 0) {
            return message.reply('Belum ada data user.');
        }

        const medals = ['🥇', '🥈', '🥉'];
        const list = users.map((user, index) => {
            const medal = index < 3 ? medals[index] : `${index + 1}️⃣`;
            return `${medal} **${user.userName}** — ${formatNumber(user.saldo)} Coin`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('👑 ━━━━━ GameSen Leaderboard ━━━━━ 👑')
            .setDescription(list + '\n\n━━━━━━━━━━━━━━━━━━━━━━\nTop 10 pemain dengan coin terbanyak')
            .setTimestamp();
        message.channel.send({ embeds: [embed] });
    }
};
