const { EmbedBuilder } = require('discord.js');
const { getUser, formatNumber } = require('../utils/helpers');

module.exports = {
    name: 'saldo',
    description: 'Cek saldo coin kamu',
    async execute(message, args) {
        const user = await getUser(message.author.id, message.author.username);
        const embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle('💰 ━━━━━ GameSen Wallet ━━━━━ 💰')
            .setDescription(`
👤 **User :** ${message.author}
💳 **Saldo :** ${formatNumber(user.saldo)} Coin

━━━━━━━━━━━━━━━━━━━━━━
Gunakan coin untuk bermain di <#${process.env.PLAY_CHANNEL_ID}>
            `)
            .setTimestamp();
        message.channel.send({ embeds: [embed] });
    }
};
