const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getOrCreateEventUser, grantEventCurrency } = require('../../utils/db-noel');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rubans')
        .setDescription('Gérer les rubans de Noël (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('ajouter')
                .setDescription('Ajouter des rubans à un utilisateur')
                .addUserOption(option =>
                    option
                        .setName('utilisateur')
                        .setDescription('L\'utilisateur qui recevra les rubans')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option
                        .setName('montant')
                        .setDescription('Le nombre de rubans à ajouter')
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('retirer')
                .setDescription('Retirer des rubans à un utilisateur')
                .addUserOption(option =>
                    option
                        .setName('utilisateur')
                        .setDescription('L\'utilisateur qui perdra les rubans')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option
                        .setName('montant')
                        .setDescription('Le nombre de rubans à retirer')
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('définir')
                .setDescription('Définir le nombre exact de rubans pour un utilisateur')
                .addUserOption(option =>
                    option
                        .setName('utilisateur')
                        .setDescription('L\'utilisateur')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option
                        .setName('montant')
                        .setDescription('Le nombre exact de rubans')
                        .setRequired(true)
                        .setMinValue(0)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('utilisateur');
        const amount = interaction.options.getInteger('montant');

        await interaction.deferReply({ ephemeral: true });

        try {
            const eventUser = getOrCreateEventUser(targetUser.id, targetUser.username);
            let newBalance = eventUser.rubans;
            let action = '';

            switch (subcommand) {
                case 'ajouter':
                    grantEventCurrency(targetUser.id, { rubans: amount });
                    newBalance = eventUser.rubans + amount;
                    action = `✅ Ajouté **${amount}** rubans à <@${targetUser.id}>`;
                    logger.info(`${interaction.user.username} a ajouté ${amount} rubans à ${targetUser.username}`);
                    break;

                case 'retirer':
                    if (eventUser.rubans < amount) {
                        return interaction.editReply({
                            content: `❌ <@${targetUser.id}> n'a que **${eventUser.rubans}** rubans, impossible de retirer **${amount}**.`
                        });
                    }
                    grantEventCurrency(targetUser.id, { rubans: -amount });
                    newBalance = eventUser.rubans - amount;
                    action = `✅ Retiré **${amount}** rubans à <@${targetUser.id}>`;
                    logger.info(`${interaction.user.username} a retiré ${amount} rubans à ${targetUser.username}`);
                    break;

                case 'définir':
                    // Obtenir l'utilisateur à jour
                    const currentUser = getOrCreateEventUser(targetUser.id, targetUser.username);
                    const difference = amount - currentUser.rubans;
                    grantEventCurrency(targetUser.id, { rubans: difference });
                    newBalance = amount;
                    action = `✅ Défini à **${amount}** rubans pour <@${targetUser.id}>`;
                    logger.info(`${interaction.user.username} a défini les rubans de ${targetUser.username} à ${amount}`);
                    break;
            }

            const embed = new EmbedBuilder()
                .setTitle('🎀 Gestion des Rubans')
                .setDescription(action)
                .addFields(
                    { name: 'Utilisateur', value: `<@${targetUser.id}>`, inline: true },
                    { name: 'Nouveau solde', value: `**${newBalance.toLocaleString('fr-FR')}** rubans 🎀`, inline: true },
                    { name: 'Modifié par', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setColor('#DC143C')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error(`Erreur lors de la gestion des rubans pour ${targetUser.username}:`, error);
            await interaction.editReply({ content: '❌ Une erreur est survenue.' });
        }
    },
};
