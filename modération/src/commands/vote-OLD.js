const { SlashCommandBuilder, ApplicationCommandOptionType } = require('discord.js');

const { PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: {
        name: 'vote',
        description: 'Démarrer un vote pour un utilisateur',
        default_member_permissions: PermissionFlagsBits.ModerateMembers.toString(),
        options: [
            {
                type: ApplicationCommandOptionType.User,
                name: 'utilisateur',
                description: 'Utilisateur pour le vote',
                required: true,
            },
        ],
    },

    async execute(interaction, { voteManager, config }) {
        const user = interaction.options.getUser('utilisateur');
        const channel = interaction.channel;

        try {
            await voteManager.startVote(user, 'Vote pour', channel);
            
            await interaction.reply({
                content: `✅ Le vote pour <@${user.id}> a été lancé !`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Erreur lors du démarrage du vote:', error);
            await interaction.reply({
                content: '❌ Une erreur est survenue lors du lancement du vote.',
                ephemeral: true
            });
        }
    }
};
