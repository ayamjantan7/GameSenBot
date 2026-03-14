const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'peraturan',
    description: 'Peraturan grup',
    async execute(message, args) {
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('📋 ━━━━━ GameSen Peraturan ━━━━━ 📋')
            .setDescription(`
1. Gunakan bot hanya di channel <#${process.env.PLAY_CHANNEL_ID}>
2. Dilarang spam command
3. Hormati pemain lain

━━━━━━━━━━━━━━━━━━━━━━
Pelanggaran dapat dikenakan sanksi
            `)
            .setTimestamp();
        message.channel.send({ embeds: [embed] });
    }
};
