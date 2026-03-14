const User = require('../models/User');

async function getUser(userId, userName) {
    let user = await User.findOne({ userId });
    if (!user) {
        user = new User({ userId, userName, saldo: 0 });
        await user.save();
    } else if (user.userName !== userName) {
        user.userName = userName;
        await user.save();
    }
    return user;
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function isAdmin(member) {
    if (!member) return false;
    const adminRoleName = process.env.ADMIN_ROLE_NAME || 'Admin';
    return member.roles.cache.some(role => role.name === adminRoleName);
}

module.exports = { getUser, formatNumber, isAdmin };
