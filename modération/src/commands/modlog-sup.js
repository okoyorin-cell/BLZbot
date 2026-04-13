const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('modlog-sup')
        .setDescription('Programmer la suppression d\'une sanction (Admin uniquement).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('Le membre concerné')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('ID de la sanction à supprimer (visible dans /modlog)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('raison')
                .setDescription('Raison de la suppression')
                .setRequired(true)),

    async execute(interaction, { dbManager }) {
        const sanctionsDb = dbManager.getSanctionsDb();
        const targetUser = interaction.options.getUser('utilisateur');
        const sanctionId = interaction.options.getInteger('id');
        const reason = interaction.options.getString('raison');
        const moderator = interaction.user;

        // Vérification de l'existence de la sanction
        sanctionsDb.get(
            'SELECT * FROM sanctions WHERE id = ? AND userId = ?',
            [sanctionId, targetUser.id],
            (err, row) => {
                if (err) {
                    console.error(err);
                    return interaction.reply({ content: '❌ Erreur de base de données.', ephemeral: true });
                }

                if (!row) {
                    return interaction.reply({ content: `❌ Aucune sanction trouvée avec l'ID ${sanctionId} pour cet utilisateur.`, ephemeral: true });
                }

                if (row.pendingDeletion) {
                    return interaction.reply({ content: '⚠️ Cette sanction est déjà programmée pour suppression.', ephemeral: true });
                }

                // Suppression effective dans 30 jours (sécurité)
                const deletionDate = Date.now() + (30 * 24 * 60 * 60 * 1000);

                sanctionsDb.run(
                    `UPDATE sanctions SET active = 0, pendingDeletion = 1, deletionReason = ?, deletionModeratorId = ?, deletionDate = ? WHERE id = ?`,
                    [reason, moderator.id, deletionDate, sanctionId],
                    (err) => {
                        if (err) {
                            return interaction.reply({ content: '❌ Erreur lors de la mise à jour.', ephemeral: true });
                        }

                        interaction.reply({
                            content: `🗑️ La sanction #${sanctionId} a été marquée pour suppression.\n**Raison:** ${reason}\n**Date effective:** ${new Date(deletionDate).toLocaleDateString()}\n(Elle n'apparaîtra plus comme active mais restera dans l'historique jusqu'à cette date avec un avertissement).`,
                            ephemeral: true
                        });
                    }
                );
            }
        );
    }
};