const { SlashCommandBuilder } = require('discord.js');
const { handleCreateGiveaway } = require('../giveaway/steps');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Gère les giveaways du serveur.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('creer')
                .setDescription('Crée un nouveau giveaway.')
        ),

    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'creer') {
            await handleCreateGiveaway(interaction);
        }
    },
};