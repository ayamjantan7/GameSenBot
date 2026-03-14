const { EmbedBuilder } = require('discord.js');

async function logTransfer(pengirim, penerima, jumlah, fee, diterima) {
    const channel = await global.client.channels.fetch(process.env.LOG_CHANNEL_ID);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor(0x00FFFF)
        .setTitle('📑 GameSen Admin Log')
        .setDescription(`
**${pengirim} mentransfer coin**

**Pengirim :** ${pengirim}
**Penerima :** ${penerima}
**Jumlah :** ${jumlah.toLocaleString('id-ID')}
**Admin Fee :** ${fee.toLocaleString('id-ID')}
**Diterima :** ${diterima.toLocaleString('id-ID')}
**Waktu :** ${new Date().toLocaleTimeString('id-ID')}
        `)
        .setTimestamp();
    channel.send({ embeds: [embed] });
}

async function logAdminAdd(admin, target, jumlah) {
    const channel = await global.client.channels.fetch(process.env.LOG_CHANNEL_ID);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('📑 GameSen Admin Log')
        .setDescription(`
**Admin menambah coin**

**Admin :** ${admin}
**Target :** ${target}
**Jumlah :** ${jumlah.toLocaleString('id-ID')}
**Waktu :** ${new Date().toLocaleTimeString('id-ID')}
        `)
        .setTimestamp();
    channel.send({ embeds: [embed] });
}

async function logDuel(hostId, opponentId, bet, spinHost, spinOpp, winnerId, fee, hadiah) {
    const channel = await global.client.channels.fetch(process.env.LOG_CHANNEL_ID);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🎮 Duel Log')
        .setDescription(`
**Host :** <@${hostId}> (🎲 ${spinHost})
**Lawan :** <@${opponentId}> (🎲 ${spinOpp})
**Taruhan :** ${bet.toLocaleString('id-ID')} Coin
**Pemenang :** <@${winnerId}>
**Hadiah :** ${hadiah.toLocaleString('id-ID')} Coin
**Fee (5%) :** ${fee.toLocaleString('id-ID')} Coin
**Waktu :** ${new Date().toLocaleTimeString('id-ID')}
        `)
        .setTimestamp();
    channel.send({ embeds: [embed] });
}

module.exports = { logTransfer, logAdminAdd, logDuel };
