const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getOrCreateUser, setPoints, setStars } = require('../../../utils/db-users');
const logger = require('../../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('set-money')
        .setDescription('Définir le solde exact de Starss ou de Points pour un membre.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Le membre cible.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Le type de monnaie à définir.')
                .setRequired(true)
                .addChoices(
                    { name: 'Starss (Monnaie)', value: 'stars' },
                    { name: 'Points (Classement)', value: 'points' }
                ))
        .addIntegerOption(option =>
            option.setName('montant')
                .setDescription('Le nouveau montant exact.')
                .setRequired(true)
                .setMinValue(0)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('membre');
        const type = interaction.options.getString('type');
        const amount = interaction.options.getInteger('montant');

        if (targetUser.bot) {
            return interaction.reply({ content: 'Impossible de modifier le solde d\'un bot.', flags: 64 });
        }

        getOrCreateUser(targetUser.id, targetUser.username);

        try {
            if (type === 'stars') {
                setStars(targetUser.id, amount);
                await interaction.reply({
                    content: `Le solde de **Starss** de **${targetUser.username}** a été défini à **${amount.toLocaleString('fr-FR')}**.`,
                    flags: 64
                });
                logger.info(`Admin ${interaction.user.tag} set stars for ${targetUser.tag} to ${amount}`);
            } else if (type === 'points') {
                setPoints(targetUser.id, amount);
                await interaction.reply({
                    content: `Le solde de **Points** de **${targetUser.username}** a été défini à **${amount.toLocaleString('fr-FR')}**.`,
                    flags: 64
                });
                logger.info(`Admin ${interaction.user.tag} set points for ${targetUser.tag} to ${amount}`);
            }
        } catch (error) {
            logger.error(`Erreur lors de la commande set-money pour ${targetUser.id}`, error);
            await interaction.reply({ content: 'Une erreur est survenue lors de la mise à jour du solde.', flags: 64 });
        }
    },
};
