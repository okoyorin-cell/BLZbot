const { ApplicationCommandOptionType, PermissionFlagsBits } = require('discord.js');
const CONFIG = require('../config.js');

module.exports = {
    data: {
        name: 'bypass_recrutement',
        description: 'Autorise un utilisateur à postuler sans les conditions (valide 1h).',
        default_member_permissions: PermissionFlagsBits.Administrator.toString(),
        options: [
            {
                type: ApplicationCommandOptionType.User,
                name: 'utilisateur',
                description: 'L\'utilisateur qui pourra ignorer les conditions.',
                required: true
            }
        ],
    },

    async execute(interaction, { recruitmentManager }) {
        // Vérification des permissions basée sur les points (comme dans backup)
        let userRolesPoints = 0;
        interaction.member.roles.cache.forEach(role => {
            const roleData = CONFIG.STAFF_ROLES.find(r => r.id === role.id);
            if (roleData && roleData.points > userRolesPoints) {
                userRolesPoints = roleData.points;
            }
        });

        // Superviseur minimum (points >= 2) - ou Admin ? Le user a dit "commande admin".
        // Je vais mettre Admin (points >= 5) pour être sûr, ou au moins Superviseur.
        // recrutment.js utilise Superviseur (points >= 2). Je vais rester cohérent avec recrutement.js
        const superviseurRole = CONFIG.STAFF_ROLES.find(r => r.name === 'Superviseur');
        const requiredPoints = superviseurRole ? superviseurRole.points : 2;

        if (userRolesPoints < requiredPoints) {
            return interaction.reply({
                content: "Vous n'avez pas la permission d'utiliser cette commande.",
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('utilisateur');

        recruitmentManager.addBypass(targetUser.id);

        await interaction.reply({
            content: `✅ **${targetUser.tag}** peut maintenant postuler sans les conditions (ancienneté, chances) pendant **1 heure**.\n(Le bypass sera automatiquement ignoré après ce délai).`,
            ephemeral: true
        });
    }
};
