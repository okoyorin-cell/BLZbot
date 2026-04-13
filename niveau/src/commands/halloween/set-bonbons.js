const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getOrCreateEventUser, db, getEventState } = require('../../utils/db-halloween');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('set-bonbons')
        .setDescription('[Admin] Définir le nombre de bonbons d\'un membre.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Le membre à modifier.')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('montant')
                .setDescription('Le nouveau nombre de bonbons.')
                .setRequired(true)
                .setMinValue(0)),

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
        db.prepare('UPDATE event_users SET bonbons = ? WHERE user_id = ?').run(amount, targetUser.id);

        await interaction.reply({
            content: `Le nombre de bonbons de **${targetUser.username}** a été défini sur **${amount.toLocaleString('fr-FR')}**. `,
            flags: 64
        });
    },
};