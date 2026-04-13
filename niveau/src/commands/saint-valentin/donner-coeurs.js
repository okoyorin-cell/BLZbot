const { SlashCommandBuilder } = require('discord.js');
const { getOrCreateEventUser, grantEventCurrency, getEventState } = require('../../utils/db-valentin');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('donner-coeurs')
        .setDescription('Donne des Cœurs à un autre membre.')
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Le membre à qui donner des Cœurs.')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('montant')
                .setDescription('Le montant de Cœurs à donner.')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        if (!getEventState('valentin')) {
            return interaction.reply({ content: "L'événement Saint-Valentin n'est pas actif.", ephemeral: true });
        }

        const senderId = interaction.user.id;
        const receiver = interaction.options.getUser('membre');
        const amount = interaction.options.getInteger('montant');

        if (senderId === receiver.id) {
            return interaction.reply({ content: "S'aimer soi-même c'est bien, mais là tu abuses. 🙄", ephemeral: true });
        }

        if (receiver.bot) {
            return interaction.reply({ content: "Les robots n'ont pas besoin d'amour. Enfin... c'est ce qu'on dit.", ephemeral: true });
        }

        const senderUser = getOrCreateEventUser(senderId, interaction.user.username);

        if (senderUser.coeurs < amount) {
            return interaction.reply({
                content: `Tu n'as pas assez de Cœurs ! Tu as **${senderUser.coeurs.toLocaleString('fr-FR')}** Cœurs, mais tu veux en donner **${amount.toLocaleString('fr-FR')}**.`,
                ephemeral: true
            });
        }

        try {
            getOrCreateEventUser(receiver.id, receiver.username);
            grantEventCurrency(senderId, { coeurs: -amount });
            grantEventCurrency(receiver.id, { coeurs: amount });

            await interaction.reply({
                content: `💝 Tu as offert **${amount.toLocaleString('fr-FR')} Cœurs** à ${receiver}. Que c'est mignon ! 🥹`
            });
            logger.info(`${interaction.user.username} a donné ${amount} Cœurs à ${receiver.username}.`);

        } catch (error) {
            logger.error(`Erreur transfert Cœurs:`, error);
            await interaction.reply({ content: 'Une erreur est survenue.', ephemeral: true });
        }
    },
};
