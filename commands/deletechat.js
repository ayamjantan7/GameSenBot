const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { isAdmin } = require('../utils/helpers');

module.exports = {
    name: 'deletechat',
    description: '[ADMIN] Menghapus pesan dalam jumlah besar di channel manapun',
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

            // Cek apakah bot punya permission Manage Messages di channel ini
            if (!message.channel.permissionsFor(message.guild.members.me).has(PermissionsBitField.Flags.ManageMessages)) {
                return message.reply('❌ Bot tidak punya izin **Manage Messages** di channel ini. Beri permission dulu ya.');
            }

            // Tampilkan pesan "sedang memproses"
            const processingMsg = await message.channel.send('🧹 **Menghapus pesan...**');

            // Hapus command message + jumlah yang diminta
            const totalToDelete = amount + 2;
            
            // Fetch pesan yang akan dihapus
            const messages = await message.channel.messages.fetch({ limit: totalToDelete });
            
            // Hapus pesan
            const deleted = await message.channel.bulkDelete(messages, true);
            
            // Hitung jumlah yang berhasil dihapus
            const deletedCount = deleted.size;
            
            // Kirim konfirmasi (pesan ini akan otomatis terhapus setelah 5 detik)
            const confirmEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ ━━━━━ Chat Dihapus ━━━━━ ✅')
                .setDescription(`
**Channel :** ${message.channel} (${message.channel.name})
**Admin :** ${message.author}
**Jumlah Dihapus :** ${deletedCount} pesan
**Diminta :** ${amount} pesan

${deletedCount < amount + 2 ? '⚠️ Beberapa pesan mungkin berusia >14 hari dan tidak bisa dihapus.' : ''}
                `)
                .setFooter({ text: 'Pesan ini akan otomatis terhapus dalam 5 detik' })
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
                return message.reply('❌ Bot tidak punya permission **Manage Messages** di channel ini. Cek permission bot.');
            } else if (error.code === 50034) {
                return message.reply('❌ Tidak bisa menghapus pesan yang berusia lebih dari 14 hari.');
            } else {
                message.reply(`❌ Terjadi kesalahan: ${error.message}`);
            }
        }
    }
};
