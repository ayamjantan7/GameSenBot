const { handleCoinChoice } = require('../utils/coinHandler');

module.exports = {
    name: 'tails',
    description: 'Memilih Tails dalam permainan coinflip',
    async execute(message, args) {
        await handleCoinChoice(message, 'tails');
    }
};
