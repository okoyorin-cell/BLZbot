const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getOrCreateUser, updateUserBalance } = require('../../../utils/db-users');
const { adjustWarInitialValues } = require('../../../utils/guild/guild-wars');
const logger = require('../../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('give-xp')
        .setDescription('Donner de l\'XP à un membre.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Le membre à qui donner de l\'XP.')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('montant')
                .setDescription('La quantité d\'XP à donner.')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('membre');
        const amount = interaction.options.getInteger('montant');

        if (targetUser.bot) {
            return interaction.reply({ content: 'Vous ne pouvez pas modifier l\'XP d\'un bot.', flags: 64 });
        }

        getOrCreateUser(targetUser.id, targetUser.username);
        updateUserBalance(targetUser.id, { xp: amount });
        adjustWarInitialValues(targetUser.id, { xp: amount }); // Ne compte pas pour la guerre

        await interaction.reply({
            content: `Vous avez donné **${amount.toLocaleString('fr-FR')}** XP à **${targetUser.username}**. Sa progression de niveau a été mise à jour.`,
            flags: 64
        });
    },
};