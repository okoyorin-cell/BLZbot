const { SlashCommandBuilder } = require('discord.js');
const { getOrCreateUser, updateUserBalance } = require('../../utils/db-users');
const { adjustWarInitialValues } = require('../../utils/guild/guild-wars');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('payer')
        .setDescription('Donne des Starss à un autre membre.')
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Le membre à qui donner des Starss.')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('montant')
                .setDescription('Le montant de Starss à donner.')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        const senderId = interaction.user.id;
        const receiver = interaction.options.getUser('membre');
        const amount = interaction.options.getInteger('montant');

        if (senderId === receiver.id) {
            return interaction.reply({ content: 'Vous ne pouvez pas vous donner des Starss à vous-même.', flags: 64 });
        }

        const senderUser = getOrCreateUser(senderId, interaction.user.username);

        if (senderUser.stars < amount) {
            return interaction.reply({ content: `Vous n'avez pas assez de Starss pour donner ${amount.toLocaleString('fr-FR')} Starss. Vous avez actuellement ${senderUser.stars.toLocaleString('fr-FR')} Starss.`, flags: 64 });
        }

        try {
            // Retirer les Starss de l'envoyeur (sans multiplicateurs)
            updateUserBalance(senderId, { stars: -amount });
            // Ajouter les Starss au receveur (sans multiplicateurs)
            getOrCreateUser(receiver.id, receiver.username);
            updateUserBalance(receiver.id, { stars: amount });

            // Ajuster les initial_stars pour que le transfert ne compte pas en guerre
            adjustWarInitialValues(senderId, { stars: -amount });
            adjustWarInitialValues(receiver.id, { stars: amount });

            await interaction.reply({ content: `Vous avez donné **${amount.toLocaleString('fr-FR')}** Starss à ${receiver}.` });
            logger.info(`${interaction.user.username} a donné ${amount} Starss à ${receiver.username}.`);

        } catch (error) {
            logger.error(`Erreur lors du transfert de Starss de ${interaction.user.username} à ${receiver.username}:`, error);
            await interaction.reply({ content: 'Une erreur est survenue lors du transfert de Starss. Veuillez réessayer.', flags: 64 });
        }
    },
};