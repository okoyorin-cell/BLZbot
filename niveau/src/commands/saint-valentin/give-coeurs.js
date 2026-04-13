const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getOrCreateEventUser, grantEventCurrency, getEventState } = require('../../utils/db-valentin');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('give-coeurs')
        .setDescription('[Admin] Donner des cœurs à un membre.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Le membre à qui donner des cœurs.')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('montant')
                .setDescription('Le nombre de cœurs à donner.')
                .setRequired(true)),

    async execute(interaction) {
        if (!getEventState('valentin')) {
            return interaction.reply({ content: "L'événement Saint-Valentin n'est pas actif pour le moment.", ephemeral: true });
        }

        const targetUser = interaction.options.getUser('membre');
        const amount = interaction.options.getInteger('montant');

        if (targetUser.bot) {
            return interaction.reply({ content: 'Vous ne pouvez pas donner de cœurs à un bot.', ephemeral: true });
        }

        getOrCreateEventUser(targetUser.id, targetUser.username);
        grantEventCurrency(targetUser.id, { coeurs: amount });

        await interaction.reply({
            content: `✅ Vous avez donné **${amount.toLocaleString('fr-FR')}** cœurs à **${targetUser.username}**.`,
            ephemeral: true
        });
    },
};
