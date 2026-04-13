const { SlashCommandBuilder, ApplicationCommandOptionType, PermissionFlagsBits } = require('discord.js');
const CONFIG = require('../config.js');

module.exports = {
    data: {
        name: 'rankup',
        description: 'Démarrer un vote de promotion',
        default_member_permissions: PermissionFlagsBits.Administrator.toString(),
        options: [
            {
                type: ApplicationCommandOptionType.User,
                name: 'utilisateur',
                description: 'Utilisateur à promouvoir',
                required: true,
            },
            {
                type: ApplicationCommandOptionType.String,
                name: 'type',
                description: 'Le type de promotion',
                required: true,
                choices: CONFIG.PROMOTION_PATHS.map(path => ({
                    name: path.name,
                    value: path.value
                })),
            },
        ],
    },

    async execute(interaction, { voteManager }) {
        const user = interaction.options.getUser('utilisateur');
        const promotionType = interaction.options.getString('type');

        try {
            await voteManager.startRankupVote(user, promotionType, interaction);
        } catch (error) {
            console.error('Erreur lors du démarrage du vote de promotion:', error);
            await interaction.reply({
                content: '❌ Une erreur est survenue lors du lancement du vote de promotion.',
                ephemeral: true
            });
        }
    }
};
