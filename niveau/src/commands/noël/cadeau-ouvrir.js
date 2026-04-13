const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getEventState, getOrCreateEventUser, grantEventCurrency } = require('../../utils/db-noel');
const { openCadeauSurprise, applyReward } = require('../../utils/cadeau-surprise');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cadeau-ouvrir')
        .setDescription('Ouvre tous vos cadeaux surprise accumulés.'),

    async execute(interaction) {
        if (!getEventState('noël')) {
            return interaction.reply({ content: "Il n'y a pas d'événement Noël actif pour le moment.", ephemeral: true });
        }

        const userId = interaction.user.id;
        const eventUser = getOrCreateEventUser(userId, interaction.user.username);

        const cadeauxToOpen = Math.min(50, eventUser.cadeaux_surprise_count);

        if (cadeauxToOpen === 0) {
            return interaction.reply({ content: "Vous n'avez pas de cadeaux surprise à ouvrir.", ephemeral: true });
        }

        await interaction.deferReply();

        let cadeauxDeducted = false;
        try {
            // Déduire le nombre de cadeaux ouverts
            grantEventCurrency(userId, { cadeaux_surprise: -cadeauxToOpen });
            cadeauxDeducted = true;

            const winningsDetails = [];

            for (let i = 0; i < cadeauxToOpen; i++) {
                const reward = openCadeauSurprise();
                const rewardText = await applyReward(interaction.client, userId, reward);
                winningsDetails.push(rewardText);
            }

            // Grouper les récompenses pour un affichage propre
            const groupedWinnings = winningsDetails.reduce((acc, item) => {
                acc[item] = (acc[item] || 0) + 1;
                return acc;
            }, {});

            const description = Object.entries(groupedWinnings)
                .map(([item, count]) => `> ${item}${count > 1 ? ` **(x${count})**` : ''}`)
                .join('\n');

            const embed = new EmbedBuilder()
                .setTitle(`🎁 Contenu de ${cadeauxToOpen} Cadeau${cadeauxToOpen > 1 ? 'x' : ''} Surprise 🎁`)
                .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
                .setDescription(description)
                .setColor('#DC143C')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error(`Erreur lors de l'ouverture des cadeaux surprise pour ${interaction.user.username}:`, error);
            
            // Redonner les cadeaux en cas d'erreur seulement si on les a déduits
            if (cadeauxDeducted) {
                grantEventCurrency(userId, { cadeaux_surprise: cadeauxToOpen });
                await interaction.editReply({ content: "Une erreur est survenue lors de l'ouverture de vos cadeaux. Vos cadeaux vous ont été rendus. Veuillez réessayer." });
            } else {
                await interaction.editReply({ content: "Une erreur est survenue. Vos cadeaux n'ont pas été consommés. Veuillez réessayer." });
            }
        }
    },
};
