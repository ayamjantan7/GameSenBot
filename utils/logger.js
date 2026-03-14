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

async function logAdminDel(admin, target, jumlah, sisaSaldo) {
    const channel = await global.client.channels.fetch(process.env.LOG_CHANNEL_ID);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor(0xFF5733)
        .setTitle('📑 GameSen Admin Log (Delete Coin)')
        .setDescription(`
**Admin menghapus coin**

**Admin :** ${admin}
**Target :** ${target}
**Jumlah Dihapus :** ${jumlah.toLocaleString('id-ID')} Coin
**Sisa Saldo :** ${sisaSaldo.toLocaleString('id-ID')} Coin
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

async function logCoinflip(hostId, opponentId, bet, hostChoice, oppChoice, coinResult, winnerId, fee, hadiah) {
    const channel = await global.client.channels.fetch(process.env.LOG_CHANNEL_ID);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🪙 Coinflip Log')
        .setDescription(`
**Host :** <@${hostId}> (${hostChoice === 'head' ? '🔴 Head' : '🔵 Tails'})
**Lawan :** <@${opponentId}> (${oppChoice === 'head' ? '🔴 Head' : '🔵 Tails'})
**Hasil Koin :** ${coinResult === 'head' ? '🔴 Head' : '🔵 Tails'}
**Taruhan :** ${bet.toLocaleString('id-ID')} Coin
**Pemenang :** <@${winnerId}>
**Hadiah :** ${hadiah.toLocaleString('id-ID')} Coin
**Fee (5%) :** ${fee.toLocaleString('id-ID')} Coin
**Waktu :** ${new Date().toLocaleTimeString('id-ID')}
        `)
        .setTimestamp();
    channel.send({ embeds: [embed] });
}

async function logReme(hostId, opponentId, bet, spinHost, spinOpp, winnerId, fee, hadiah, hostKuat, oppKuat) {
    const channel = await global.client.channels.fetch(process.env.LOG_CHANNEL_ID);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('🎯 Reme Log')
        .setDescription(`
**Host :** <@${hostId}> (🎲 ${spinHost}) ${hostKuat ? '🔷 KUAT' : ''}
**Lawan :** <@${opponentId}> (🎲 ${spinOpp}) ${oppKuat ? '🔷 KUAT' : ''}
**Taruhan :** ${bet.toLocaleString('id-ID')} Coin
**Pemenang :** <@${winnerId}>
**Hadiah :** ${hadiah.toLocaleString('id-ID')} Coin
**Fee (5%) :** ${fee.toLocaleString('id-ID')} Coin
**Waktu :** ${new Date().toLocaleTimeString('id-ID')}
        `)
        .setTimestamp();
    channel.send({ embeds: [embed] });
}

module.exports = { 
    logTransfer, 
    logAdminAdd, 
    logAdminDel, 
    logDuel,
    logCoinflip,
    logReme
};
