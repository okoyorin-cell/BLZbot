const { ApplicationCommandOptionType, PermissionFlagsBits } = require('discord.js');
const CONFIG = require('../config.js');

module.exports = {
    data: {
        name: 'recrutement',
        description: 'Gère le recrutement du staff.',
        default_member_permissions: PermissionFlagsBits.Administrator.toString(),
        options: [
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: 'ouvrir',
                description: 'Ouvrir le recrutement pour une spécialité.',
                options: [
                    {
                        type: ApplicationCommandOptionType.String,
                        name: 'specialite',
                        description: 'La spécialité à ouvrir.',
                        required: true,
                        choices: [
                            { name: 'Modérateur', value: 'moderateur' },
                            { name: 'Communiquant', value: 'communiquant' },
                            { name: 'Développeur', value: 'developpeur' }
                        ]
                    },
                    {
                        type: ApplicationCommandOptionType.Integer,
                        name: 'places',
                        description: 'Nombre de places disponibles.',
                        required: true,
                        min_value: 1
                    }
                ]
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: 'fermer',
                description: 'Fermer le recrutement.',
                options: [
                    {
                        type: ApplicationCommandOptionType.String,
                        name: 'specialite',
                        description: 'La spécialité à fermer.',
                        required: true,
                        choices: [
                            { name: 'Modérateur', value: 'moderateur' },
                            { name: 'Communiquant', value: 'communiquant' },
                            { name: 'Développeur', value: 'developpeur' },
                            { name: 'Tout', value: 'tout' }
                        ]
                    }
                ]
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

        // Superviseur minimum (points >= 2)
        const superviseurRole = CONFIG.STAFF_ROLES.find(r => r.name === 'Superviseur');
        const requiredPoints = superviseurRole ? superviseurRole.points : 2;

        if (userRolesPoints < requiredPoints) {
            return interaction.reply({
                content: "Vous n'avez pas la permission de gérer le recrutement.",
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'ouvrir') {
            const specialite = interaction.options.getString('specialite');
            const places = interaction.options.getInteger('places');
            await recruitmentManager.openRecruitment(interaction, specialite, places);
        } else if (subcommand === 'fermer') {
            const specialite = interaction.options.getString('specialite');
            await recruitmentManager.closeRecruitment(interaction, specialite);
        }
    }
};
