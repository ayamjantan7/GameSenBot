const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    userName: { type: String, required: true },
    saldo: { type: Number, default: 0 },
    totalMenang: { type: Number, default: 0 },
    totalKalah: { type: Number, default: 0 },
    winstreak: { type: Number, default: 0 },
    bestWinstreak: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
