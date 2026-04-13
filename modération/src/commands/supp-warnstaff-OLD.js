const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('supp-warnstaff')
        .setDescription('Supprimer un warn staff par son ID (Admin/Owner uniquement).')
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('L\'ID du warn staff à supprimer')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, { dbManager }) {
        const authorizedUsers = ['1222548578539536405', '845654783264030721'];

        if (!authorizedUsers.includes(interaction.user.id)) {
            return interaction.reply({
                content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.',
                flags: MessageFlags.Ephemeral
            });
        }

        const warnId = interaction.options.getInteger('id');
        const db = dbManager.databases.staffWarns;

        // Vérifier si le warn existe avant de le supprimer pour donner un feedback plus précis
        db.get('SELECT * FROM staff_warns WHERE id = ?', [warnId], (err, row) => {
            if (err) {
                console.error('Erreur lors de la recherche du warn staff:', err);
                return interaction.reply({
                    content: '❌ Une erreur est survenue lors de la recherche du warn.',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (!row) {
                return interaction.reply({
                    content: `❌ Aucun warn staff trouvé avec l'ID #${warnId}.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // Supprimer le warn
            db.run('DELETE FROM staff_warns WHERE id = ?', [warnId], function (err) {
                if (err) {
                    console.error('Erreur lors de la suppression du warn staff:', err);
                    return interaction.reply({
                        content: '❌ Une erreur est survenue lors de la suppression du warn.',
                        flags: MessageFlags.Ephemeral
                    });
                }

                interaction.reply({
                    content: `✅ Le warn staff #${warnId} (Utilisateur: <@${row.userId}>, Raison: "${row.reason}") a été supprimé avec succès.`,
                    flags: MessageFlags.Ephemeral
                });
            });
        });
    }
};
