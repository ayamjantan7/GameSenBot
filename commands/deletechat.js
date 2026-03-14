const { EmbedBuilder } = require('discord.js');
const { isAdmin } = require('../utils/helpers');

module.exports = {
    name: 'deletechat',
    description: '[ADMIN] Menghapus pesan dalam jumlah besar di channel',
    async execute(message, args) {
        try {
            // Cek apakah user admin
            if (!isAdmin(message.member)) {
                return message.reply('❌ Hanya admin yang bisa menggunakan command ini.');
            }

            // Validasi jumlah
            if (args.length < 1) {
                return message.reply('❌ Penggunaan: `!deletechat <jumlah>`\nContoh: `!deletechat 100`');
            }

            const amount = parseInt(args[0]);
            if (isNaN(amount) || amount <= 0) {
                return message.reply('❌ Jumlah harus angka positif.');
            }

            if (amount > 100) {
                return message.reply('❌ Maksimal 100 pesan sekali hapus (batasan Discord).');
            }

            // Tampilkan pesan "sedang memproses"
            const processingMsg = await message.channel.send('🧹 **Menghapus pesan...**');

            // Delete command message + jumlah yang diminta
            // Kita tambah 2 karena: 1 (command message) + 1 (processing message) + jumlah yang diminta
            const totalToDelete = amount + 2;
            
            // Fetch pesan yang akan dihapus
            const messages = await message.channel.messages.fetch({ limit: totalToDelete });
            
            // Hapus pesan
            const deleted = await message.channel.bulkDelete(messages, true);
            
            // Hitung berapa yang berhasil dihapus (kurangi 2 untuk pesan bot)
            const deletedCount = deleted.size - 2;
            
            // Kirim konfirmasi (pesan ini akan otomatis terhapus setelah 5 detik)
            const confirmEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ ━━━━━ Chat Dihapus ━━━━━ ✅')
                .setDescription(`
**Channel :** ${message.channel}
**Jumlah Dihapus :** ${deletedCount} pesan
**Diminta :** ${amount} pesan

${deletedCount < amount ? '⚠️ Beberapa pesan mungkin berusia >14 hari dan tidak bisa dihapus.' : ''}
                `)
                .setTimestamp();

            const confirmMsg = await message.channel.send({ embeds: [confirmEmbed] });
            
            // Hapus pesan konfirmasi setelah 5 detik
            setTimeout(() => {
                confirmMsg.delete().catch(() => {});
            }, 5000);

        } catch (error) {
            console.error('ERROR DI DELETECHAT:', error);
            
            // Handle error spesifik
            if (error.code === 50013) {
                return message.reply('❌ Bot tidak punya permission **Manage Messages** di channel ini.');
            } else if (error.code === 50034) {
                return message.reply('❌ Tidak bisa menghapus pesan yang berusia lebih dari 14 hari.');
            } else {
                message.reply('❌ Terjadi kesalahan saat menghapus pesan.');
            }
        }
    }
};
