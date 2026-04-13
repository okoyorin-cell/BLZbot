const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getOrCreateUser, updateUserBalance, setPoints, setStars } = require('../../utils/db-users');
const { adjustWarInitialValues } = require('../../utils/guild/guild-wars');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('money')
        .setDescription('Gérer les Starss et Points des membres (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('give')
                .setDescription('Donner des Starss à un membre')
                .addUserOption(option =>
                    option.setName('membre')
                        .setDescription('Le membre à qui donner des Starss')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('montant')
                        .setDescription('Le nombre de Starss à donner')
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Retirer des Starss à un membre')
                .addUserOption(option =>
                    option.setName('membre')
                        .setDescription('Le membre à qui retirer des Starss')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('montant')
                        .setDescription('Le nombre de Starss à retirer')
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Définir le solde exact de Starss ou Points pour un membre')
                .addUserOption(option =>
                    option.setName('membre')
                        .setDescription('Le membre cible')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Le type de monnaie à définir')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Starss (Monnaie)', value: 'stars' },
                            { name: 'Points (Classement)', value: 'points' }
                        ))
                .addIntegerOption(option =>
                    option.setName('montant')
                        .setDescription('Le nouveau montant exact')
                        .setRequired(true)
                        .setMinValue(0))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('membre');
        const amount = interaction.options.getInteger('montant');

        if (targetUser.bot) {
            return interaction.reply({ content: 'Vous ne pouvez pas modifier le solde d\'un bot.', flags: 64 });
        }

        getOrCreateUser(targetUser.id, targetUser.username);

        try {
            if (subcommand === 'give') {
                updateUserBalance(targetUser.id, { stars: amount });
                adjustWarInitialValues(targetUser.id, { stars: amount }); // Ne compte pas pour la guerre

                await interaction.reply({
                    content: `✅ Vous avez donné **${amount.toLocaleString('fr-FR')}** Starss à **${targetUser.username}**.`,
                    flags: 64
                });
                logger.info(`Admin ${interaction.user.tag} gave ${amount} stars to ${targetUser.tag}`);

            } else if (subcommand === 'remove') {
                updateUserBalance(targetUser.id, { stars: -amount });
                adjustWarInitialValues(targetUser.id, { stars: -amount }); // Ne compte pas pour la guerre

                await interaction.reply({
                    content: `✅ Vous avez retiré **${amount.toLocaleString('fr-FR')}** Starss à **${targetUser.username}**.`,
                    flags: 64
                });
                logger.info(`Admin ${interaction.user.tag} removed ${amount} stars from ${targetUser.tag}`);

            } else if (subcommand === 'set') {
                const type = interaction.options.getString('type');

                if (type === 'stars') {
                    setStars(targetUser.id, amount);
                    await interaction.reply({
                        content: `✅ Le solde de **Starss** de **${targetUser.username}** a été défini à **${amount.toLocaleString('fr-FR')}**.`,
                        flags: 64
                    });
                    logger.info(`Admin ${interaction.user.tag} set stars for ${targetUser.tag} to ${amount}`);

                } else if (type === 'points') {
                    setPoints(targetUser.id, amount);
                    await interaction.reply({
                        content: `✅ Le solde de **Points** de **${targetUser.username}** a été défini à **${amount.toLocaleString('fr-FR')}**.`,
                        flags: 64
                    });
                    logger.info(`Admin ${interaction.user.tag} set points for ${targetUser.tag} to ${amount}`);
                }
            }
        } catch (error) {
            logger.error(`Error in money command:`, error);
            await interaction.reply({
                content: `❌ Une erreur est survenue lors de l'opération.`,
                flags: 64
            });
        }
    },
};
