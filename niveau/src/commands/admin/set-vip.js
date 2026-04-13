const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { handleCommandError } = require('../../utils/error-handler');
const db = require('../../database/database');
const { getOrCreateUser } = require('../../utils/db-users');

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('set-vip')
        .setDescription("[Admin] Donne ou retire le Pass VIP à un utilisateur.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription("L'utilisateur à qui donner/retirer le VIP.")
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('actif')
                .setDescription("true = donner le VIP, false = retirer le VIP")
                .setRequired(true)),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('utilisateur');
            const shouldBeVip = interaction.options.getBoolean('actif');

            // S'assurer que l'utilisateur existe en base de données
            getOrCreateUser(targetUser.id, targetUser.username);

            // Récupérer le statut VIP actuel
            const currentUser = db.prepare('SELECT is_vip, vip_expires_at FROM users WHERE id = ?').get(targetUser.id);
            const isCurrentlyVip = currentUser?.is_vip === 1 && (currentUser?.vip_expires_at || 0) > Date.now();

            if (shouldBeVip) {
                // Donner le VIP (1 mois)
                if (isCurrentlyVip) {
                    const expiresDate = new Date(currentUser.vip_expires_at).toLocaleDateString('fr-FR');
                    return interaction.reply({
                        content: `ℹ️ **${targetUser.username}** a déjà le Pass VIP ! (expire le ${expiresDate})`,
                        ephemeral: true
                    });
                }

                const expiresAt = Date.now() + ONE_MONTH_MS;
                const expiresDate = new Date(expiresAt).toLocaleDateString('fr-FR');
                db.prepare('UPDATE users SET is_vip = 1, vip_expires_at = ? WHERE id = ?').run(expiresAt, targetUser.id);

                return interaction.reply({
                    content: `✅ **${targetUser.username}** a reçu le **Pass VIP** pour **30 jours** ! 👑\n📅 Expiration : ${expiresDate}\n\nIl peut maintenant récupérer les récompenses VIP du Battle Pass avec \`/battlepass claim\`.`,
                    ephemeral: true
                });

            } else {
                // Retirer le VIP
                if (!currentUser || currentUser.is_vip !== 1) {
                    return interaction.reply({
                        content: `ℹ️ **${targetUser.username}** n'a pas le Pass VIP.`,
                        ephemeral: true
                    });
                }

                db.prepare('UPDATE users SET is_vip = 0, vip_expires_at = 0 WHERE id = ?').run(targetUser.id);
                return interaction.reply({
                    content: `✅ Le **Pass VIP** a été retiré à **${targetUser.username}**.`,
                    ephemeral: true
                });
            }

        } catch (error) {
            await handleCommandError(interaction, error, interaction.client);
        }
    },
};
