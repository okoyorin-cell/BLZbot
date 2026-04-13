const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getOrCreateUser, updateUserBalance } = require('../../../utils/db-users');
const { adjustWarInitialValues } = require('../../../utils/guild/guild-wars');
const logger = require('../../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove-money')
        .setDescription('Retirer des Starss à un membre.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Le membre à qui retirer des Starss.')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('montant')
                .setDescription('Le nombre de Starss à retirer.')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('membre');
        const amount = interaction.options.getInteger('montant');

        if (targetUser.bot) {
            return interaction.reply({ content: 'Vous ne pouvez pas modifier le solde d\'un bot.', flags: 64 });
        }

        getOrCreateUser(targetUser.id, targetUser.username);
        updateUserBalance(targetUser.id, { stars: -amount });
        adjustWarInitialValues(targetUser.id, { stars: -amount }); // Ne compte pas pour la guerre

        await interaction.reply({
            content: `Vous avez retiré **${amount.toLocaleString('fr-FR')}** Starss à **${targetUser.username}**.`,
            flags: 64
        });
    },
};