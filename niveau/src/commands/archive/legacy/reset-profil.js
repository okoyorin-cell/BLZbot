const { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } = require('discord.js');
const { getOrCreateUser, resetUser } = require('../../../utils/db-users');
const logger = require('../../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reset-profil')
        .setDescription('Réinitialise complètement les données d\'un membre (niveau, XP, rang, Starss, etc.).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Le membre dont le profil doit être réinitialisé.')
                .setRequired(true)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('membre');

        // Vérifier si l'utilisateur existe dans la DB avant de demander confirmation
        getOrCreateUser(targetUser.id, targetUser.username);

        const confirmButton = new ButtonBuilder()
            .setCustomId('confirm_reset')
            .setLabel('Oui, réinitialiser')
            .setStyle(ButtonStyle.Danger);

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_reset')
            .setLabel('Non, annuler')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        const response = await interaction.reply({
            content: `Êtes-vous sûr de vouloir réinitialiser complètement le profil de **${targetUser.username}** ? Cette action est irréversible.`,
            components: [row],
            flags: 64,
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60 * 1000, // 60 secondes pour confirmer
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({ content: 'Vous ne pouvez pas interagir avec cette confirmation.', flags: 64 });
                return;
            }

            if (i.customId === 'confirm_reset') {
                resetUser(targetUser.id);
                await i.update({ content: `Le profil de **${targetUser.username}** a été complètement réinitialisé.`, components: [] });
            } else if (i.customId === 'cancel_reset') {
                await i.update({ content: 'Réinitialisation annulée.', components: [] });
            }
            collector.stop();
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                response.edit({ content: 'Confirmation expirée. Réinitialisation annulée.', components: [] }).catch(() => {});
            }
        });
    },
};