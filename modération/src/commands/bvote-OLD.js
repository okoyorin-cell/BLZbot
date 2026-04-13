const { ApplicationCommandOptionType, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: {
        name: 'bvote',
        description: 'Démarrer un vote personnalisé',
        default_member_permissions: PermissionFlagsBits.ModerateMembers.toString(),
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: 'sujet',
                description: 'Sujet du vote',
                required: true,
            },
        ],
    },

    async execute(interaction, { voteManager }) {
        const sujet = interaction.options.getString('sujet');

        try {
            await voteManager.startCustomVote(interaction, sujet);
        } catch (error) {
            console.error('Erreur lors du démarrage du vote personnalisé:', error);
            await interaction.reply({
                content: '❌ Une erreur est survenue lors du lancement du vote.',
                ephemeral: true
            });
        }
    }
};
