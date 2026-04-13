const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getOrCreateEventUser } = require('../../utils/db-noel');
const db = require('../../utils/db-noel');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('set-rubans')
        .setDescription('Définit le nombre de rubans d\'un utilisateur (Admin)')
        .addUserOption(option => 
            option.setName('utilisateur')
                .setDescription('L\'utilisateur auquel définir les rubans')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('montant')
                .setDescription('Nombre de rubans à définir')
                .setRequired(true)
                .setMinValue(0)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const user = interaction.options.getUser('utilisateur');
        const amount = interaction.options.getInteger('montant');

        getOrCreateEventUser(user.id, user.username);
        
        // Récupérer les rubans actuels et calculer la différence
        const eventUser = getOrCreateEventUser(user.id, user.username);
        const difference = amount - eventUser.rubans;
        
        // Ajouter la différence
        db.grantEventCurrency(user.id, { rubans: difference });

        await interaction.reply({
            content: `✅ Les rubans de <@${user.id}> ont été définis à **${amount}**`,
            ephemeral: true
        });

        logger.info(`${interaction.user.username} a défini les rubans de ${user.username} à ${amount}`);
    },
};
