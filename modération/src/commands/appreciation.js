const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const CONFIG = require('../config.js');

const TWO_WEEKS_IN_MS = 14 * 24 * 60 * 60 * 1000;

function toMillisecondsTimestamp(timestamp) {
    if (!timestamp) return null;
    return timestamp < 1e12 ? timestamp * 1000 : timestamp;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('appreciation')
        .setDescription('Ajouter une appréciation sur un modo test (admins uniquement)')
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('Le membre du staff à évaluer')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('appreciation')
                .setDescription('Votre appréciation sur la période de modo test')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, { dbManager }) {
        const targetUser = interaction.options.getUser('utilisateur');
        const appreciation = interaction.options.getString('appreciation');
        const staffProfileDb = dbManager.getStaffProfileDb();

        // Vérifier que l'utilisateur a au moins le grade admin
        const member = interaction.member;
        const adminRoles = CONFIG.STAFF_ROLES.filter(r => r.points >= 4); // Admin et au-dessus
        const hasAdminRole = adminRoles.some(role => member.roles.cache.has(role.id));

        if (!hasAdminRole) {
            return interaction.reply({
                content: '❌ Cette commande est réservée aux administrateurs et supérieurs.',
                ephemeral: true
            });
        }

        // Vérifier qu'il y a une période de modo test active ou récente
        staffProfileDb.get(
            'SELECT * FROM modo_test_periods WHERE userId = ? ORDER BY start_date DESC LIMIT 1',
            [targetUser.id],
            (err, period) => {
                if (err) {
                    console.error('Erreur lors de la récupération de la période de modo test:', err);
                    return interaction.reply({
                        content: '❌ Une erreur est survenue lors de la récupération des données.',
                        ephemeral: true
                    });
                }

                if (!period) {
                    return interaction.reply({
                        content: `❌ Aucune période de modo test trouvée pour <@${targetUser.id}>.`,
                        ephemeral: true
                    });
                }

                // Deadline: l'appréciation est possible jusqu'à 2 semaines après la fin du modo test
                const now = Date.now();
                const endDate = toMillisecondsTimestamp(period.end_date);

                if (endDate && now > (endDate + TWO_WEEKS_IN_MS)) {
                    return interaction.reply({
                        content: `❌ La période d'appréciation est terminée. Vous ne pouvez plus ajouter d'appréciation après 2 semaines de la fin du modo test.`,
                        ephemeral: true
                    });
                }

                // Ajouter l'appréciation
                staffProfileDb.run(
                    'INSERT INTO modo_test_appreciations (userId, periodo_test_id, reviewer_id, appreciation, date) VALUES (?, ?, ?, ?, ?)',
                    [targetUser.id, period.id, interaction.user.id, appreciation, Date.now()],
                    (err) => {
                        if (err) {
                            console.error('Erreur lors de l\'ajout de l\'appréciation:', err);
                            return interaction.reply({
                                content: '❌ Une erreur est survenue lors de l\'ajout de l\'appréciation.',
                                ephemeral: true
                            });
                        }

                        interaction.reply({
                            content: `✅ Appréciation ajoutée pour <@${targetUser.id}> sur sa période de modo test.`,
                            ephemeral: true
                        });
                    }
                );
            }
        );
    }
};
