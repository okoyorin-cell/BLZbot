const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getEventState, getOrCreateEventUser, grantEventCurrency } = require('../../utils/db-halloween');
const { openBonbonSurprise, applyReward } = require('../../utils/bonbon-surprise');
const { checkQuestProgress } = require('../../utils/quests');
const logger = require('../../utils/logger');
const { handleCommandError } = require('../../utils/error-handler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bonbons-ouvrir')
        .setDescription('Ouvre tous vos bonbons surprise accumulés.'),

    async execute(interaction) {
        if (!getEventState('halloween')) {
            return interaction.reply({ content: "Il n'y a pas d'événement Halloween actif pour le moment.", ephemeral: true });
        }

        const userId = interaction.user.id;
        const eventUser = getOrCreateEventUser(userId, interaction.user.username);

        const bonbonsToOpen = Math.min(50, eventUser.bonbons_surprise_count);

        if (bonbonsToOpen === 0) {
            return interaction.reply({ content: "Vous n'avez pas de bonbons surprise à ouvrir.", ephemeral: true });
        }

        await interaction.deferReply();

        let bonbonsDeducted = false;
        try {
            // Déduire le nombre de bonbons ouverts
            grantEventCurrency(userId, { bonbons_surprise: -bonbonsToOpen });
            bonbonsDeducted = true;

            const winningsDetails = [];

            for (let i = 0; i < bonbonsToOpen; i++) {
                const reward = openBonbonSurprise();
                const rewardText = await applyReward(interaction.client, userId, reward);
                winningsDetails.push(rewardText);
            }
            
            // Vérifier la progression de la quête après avoir tout ouvert
            checkQuestProgress(interaction.client, 'HALLOWEEN_CANDY_OPEN', interaction.user);

            // Grouper les récompenses pour un affichage propre
            const groupedWinnings = winningsDetails.reduce((acc, item) => {
                acc[item] = (acc[item] || 0) + 1;
                return acc;
            }, {});

            const description = Object.entries(groupedWinnings)
                .map(([item, count]) => `> ${item}${count > 1 ? ` **(x${count})**` : ''}`)
                .join('\n');

            const embed = new EmbedBuilder()
                .setTitle(`🍬 Contenu de ${bonbonsToOpen} Bonbon${bonbonsToOpen > 1 ? 's' : ''} Surprise 🍬`)
                .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
                .setDescription(description)
                .setColor('Purple')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error(`Erreur lors de l'ouverture des bonbons surprise pour ${interaction.user.username}:`, error);
            // Si les bonbons ont été déduits avant l'erreur, on les rend à l'utilisateur.
            if (bonbonsDeducted) {
                grantEventCurrency(userId, { bonbons_surprise: bonbonsToOpen });
            }
            // Maintenant, on appelle le gestionnaire d'erreur global.
            await handleCommandError(interaction, error);
        }
    },
};