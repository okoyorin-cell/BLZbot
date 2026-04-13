const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../utils/db-noel');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add-cadeau')
        .setDescription('Ajoute des cadeaux surprise à un utilisateur (Admin)')
        .addUserOption(option => 
            option.setName('utilisateur')
                .setDescription('L\'utilisateur auquel ajouter des cadeaux')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('montant')
                .setDescription('Nombre de cadeaux à ajouter')
                .setRequired(true)
                .setMinValue(1)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const user = interaction.options.getUser('utilisateur');
        const amount = interaction.options.getInteger('montant');

        db.grantEventCurrency(user.id, { cadeaux_surprise: amount });

        await interaction.reply({
            content: `✅ **${amount}** cadeau(x) surprise ajouté(s) à <@${user.id}>`,
            ephemeral: true
        });

        logger.info(`${interaction.user.username} a ajouté ${amount} cadeaux à ${user.username}`);
    },
};
