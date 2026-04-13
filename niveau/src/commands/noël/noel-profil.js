const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getOrCreateEventUser } = require('../../utils/db-noel');
const { getActiveMultiplier } = require('../../utils/db-noel');
const { generateNoelProfileCanvas } = require('../../utils/canvas-noel-profile');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('noel-profil')
        .setDescription('Affiche ton profil de l\'événement Noël')
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('Utilisateur dont afficher le profil (par défaut: toi)')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();
        
        try {
            const targetUser = interaction.options.getUser('utilisateur') || interaction.user;
            const eventUser = getOrCreateEventUser(targetUser.id, targetUser.username);
            
            // Vérifier que eventUser a les propriétés requises
            if (!eventUser) {
                throw new Error('Impossible de récupérer les données utilisateur');
            }
            
            // S'assurer que les propriétés existent
            if (eventUser.rubans === undefined) eventUser.rubans = 0;
            if (eventUser.cadeaux_surprise === undefined) eventUser.cadeaux_surprise = 0;
            
            // Récupérer les multiplicateurs actifs
            const multipliers = {
                xp_money_x2: getActiveMultiplier(targetUser.id, 'xp_money_x2'),
                rank_points_x2: getActiveMultiplier(targetUser.id, 'rank_points_x2'),
                xp_x2_calendar: getActiveMultiplier(targetUser.id, 'xp_x2_calendar'),
                rank_points_x2_calendar: getActiveMultiplier(targetUser.id, 'rank_points_x2_calendar'),
                stars_x2_calendar: getActiveMultiplier(targetUser.id, 'stars_x2_calendar'),
            };

            logger.debug(`Multiplicateurs pour ${targetUser.username}:`, JSON.stringify({
                xp_money_x2: multipliers.xp_money_x2 ? { type: multipliers.xp_money_x2.type, remaining: multipliers.xp_money_x2.remaining } : null,
                rank_points_x2: multipliers.rank_points_x2 ? { type: multipliers.rank_points_x2.type, remaining: multipliers.rank_points_x2.remaining } : null,
                xp_x2_calendar: multipliers.xp_x2_calendar ? { type: multipliers.xp_x2_calendar.type, remaining: multipliers.xp_x2_calendar.remaining } : null,
                rank_points_x2_calendar: multipliers.rank_points_x2_calendar ? { type: multipliers.rank_points_x2_calendar.type, remaining: multipliers.rank_points_x2_calendar.remaining } : null,
                stars_x2_calendar: multipliers.stars_x2_calendar ? { type: multipliers.stars_x2_calendar.type, remaining: multipliers.stars_x2_calendar.remaining } : null,
            }));

            // Générer l'image du profil
            const canvas = await generateNoelProfileCanvas(targetUser, eventUser, multipliers);
            const attachment = new AttachmentBuilder(canvas, { name: 'noel-profil.png' });

            // Envoyer uniquement l'image sans embed pour maximiser la taille
            await interaction.editReply({ files: [attachment] });
            logger.info(`Profil Noël affiché pour ${targetUser.username}`);
        } catch (error) {
            logger.error('Erreur lors de l\'affichage du profil Noël:', error);
            await interaction.editReply({ content: '❌ Une erreur s\'est produite lors de la génération de ton profil.', ephemeral: true });
        }
    },
};
