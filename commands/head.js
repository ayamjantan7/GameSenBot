const { handleCoinChoice } = require('../utils/coinHandler');

module.exports = {
    name: 'head',
    description: 'Memilih Head dalam permainan coinflip',
    async execute(message, args) {
        await handleCoinChoice(message, 'head');
    }
};
