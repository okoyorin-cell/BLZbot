const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getOrCreateUser, setPoints } = require('../../utils/db-users');
const { RANKS, updateUserRank } = require('../../utils/ranks');
const logger = require('../../utils/logger');

// Créer les choix pour la commande à partir de la liste des rangs
// Discord a une limite de 25 choix, donc on doit splitter les rangs
const rankChoices = RANKS.map(rank => ({ name: rank.name, value: rank.name }));

// Diviser en deux groupes si nécessaire
const mainRanks = ['Plastique', 'Carton', 'Bronze', 'Fer', 'Or', 'Diamant', 'Émeraude', 'Rubis', 'Légendaire', 'Mythique', 'GOAT'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('set-rank')
        .setDescription('Définir le rang d\'un membre.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Le membre à modifier.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('rang')
                .setDescription('Le nouveau rang.')
                .setRequired(true)
                .addChoices(...rankChoices.slice(0, 25))),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('membre');
        const rankName = interaction.options.getString('rang');

        if (targetUser.bot) {
            return interaction.reply({ content: 'Vous ne pouvez pas modifier le rang d\'un bot.', ephemeral: true });
        }

        const targetRank = RANKS.find(r => r.name === rankName);
        if (!targetRank) {
            return interaction.reply({ content: 'Ce rang est invalide.', ephemeral: true });
        }

        await interaction.deferReply({ flags: 64 });

        getOrCreateUser(targetUser.id, targetUser.username);
        // Définir les points au minimum requis pour le rang
        setPoints(targetUser.id, targetRank.points);

        // Mettre à jour les rôles
        await updateUserRank(interaction.client, targetUser.id);

        await interaction.editReply({
            content: `Le rang de **${targetUser.username}** a été défini sur **${rankName}**.`
        });
    },
};
