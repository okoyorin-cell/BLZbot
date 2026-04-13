const { SlashCommandBuilder } = require('discord.js');
const { getOrCreateEventUser, grantEventCurrency, getEventState } = require('../../utils/db-halloween');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('donner-bonbons')
        .setDescription('Donne des Bonbons d\'Halloween à un autre membre.')
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Le membre à qui donner des Bonbons.')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('montant')
                .setDescription('Le montant de Bonbons à donner.')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        if (!getEventState('halloween')) {
            return interaction.reply({ content: "L'événement Halloween n'est pas actif pour le moment.", ephemeral: true });
        }

        const senderId = interaction.user.id;
        const receiver = interaction.options.getUser('membre');
        const amount = interaction.options.getInteger('montant');

        if (senderId === receiver.id) {
            return interaction.reply({ content: 'Vous ne pouvez pas vous donner des Bonbons à vous-même.', ephemeral: true });
        }

        const senderUser = getOrCreateEventUser(senderId, interaction.user.username);

        if (senderUser.bonbons < amount) {
            return interaction.reply({ content: `Vous n\'avez pas assez de Bonbons pour en donner ${amount.toLocaleString('fr-FR')}. Vous avez actuellement ${senderUser.bonbons.toLocaleString('fr-FR')} Bonbons.`, ephemeral: true });
        }

        try {
            // S'assurer que le receveur existe dans la base de données de l\'événement
            getOrCreateEventUser(receiver.id, receiver.username);

            // Retirer les bonbons de l\'envoyeur
            grantEventCurrency(senderId, { bonbons: -amount });
            // Ajouter les bonbons au receveur
            grantEventCurrency(receiver.id, { bonbons: amount });

            await interaction.reply({ content: `Vous avez donné **${amount.toLocaleString('fr-FR')}** Bonbons à ${receiver}.` });
            logger.info(`${interaction.user.username} a donné ${amount} Bonbons à ${receiver.username}.`);

        } catch (error) {
            logger.error(`Erreur lors du transfert de Bonbons de ${interaction.user.username} à ${receiver.username}:`, error);
            await interaction.reply({ content: 'Une erreur est survenue lors du transfert des Bonbons. Veuillez réessayer.', ephemeral: true });
        }
    },
};
