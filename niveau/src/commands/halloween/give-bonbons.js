const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getOrCreateEventUser, grantEventCurrency, getEventState } = require('../../utils/db-halloween');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('give-bonbons')
        .setDescription('[Admin] Donner des bonbons à un membre.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Le membre à qui donner des bonbons.')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('montant')
                .setDescription('Le nombre de bonbons à donner.')
                .setRequired(true)),

    async execute(interaction) {
        if (!getEventState('halloween')) {
            return interaction.reply({ content: "L'événement Halloween n'est pas actif pour le moment.", ephemeral: true });
        }

        const targetUser = interaction.options.getUser('membre');
        const amount = interaction.options.getInteger('montant');

        if (targetUser.bot) {
            return interaction.reply({ content: 'Vous ne pouvez pas modifier le solde d\'un bot.', flags: 64 });
        }

        getOrCreateEventUser(targetUser.id, targetUser.username);
        grantEventCurrency(targetUser.id, { bonbons: amount });

        await interaction.reply({
            content: `Vous avez donné **${amount.toLocaleString('fr-FR')}** bonbons à **${targetUser.username}**. `,
            flags: 64 // Pour ne pas spammer les salons
        });
    },
};