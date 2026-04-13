const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getOrCreateEventUser, grantEventCurrency } = require('../../utils/db-noel');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add-rubans')
        .setDescription('Ajoute des rubans à un utilisateur (Admin)')
        .addUserOption(option => 
            option.setName('utilisateur')
                .setDescription('L\'utilisateur auquel ajouter les rubans')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('montant')
                .setDescription('Nombre de rubans à ajouter')
                .setRequired(true)
                .setMinValue(1)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const user = interaction.options.getUser('utilisateur');
        const amount = interaction.options.getInteger('montant');

        getOrCreateEventUser(user.id, user.username);
        grantEventCurrency(user.id, { rubans: amount });

        await interaction.reply({
            content: `✅ **${amount} rubans** ont été ajoutés à <@${user.id}>`,
            ephemeral: true
        });

        logger.info(`${interaction.user.username} a ajouté ${amount} rubans à ${user.username}`);
    },
};
