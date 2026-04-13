const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } = require('discord.js');
const { getAllGuilds } = require('../../utils/db-guilds');
const logger = require('../../utils/logger');

const GUILDS_PER_PAGE = 5;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('liste-guildes')
        .setDescription('Affiche la liste de toutes les guildes du serveur.'),

    async execute(interaction) {
        const guilds = getAllGuilds();

        if (!guilds || guilds.length === 0) {
            return interaction.reply({ content: 'Il n\'y a actuellement aucune guilde sur le serveur.', flags: 64 });
        }

        // --- Création des Pages (Embeds) ---
        const pages = [];
        for (let i = 0; i < guilds.length; i += GUILDS_PER_PAGE) {
            const currentGuilds = guilds.slice(i, i + GUILDS_PER_PAGE);
            const embed = new EmbedBuilder()
                .setTitle('Liste des Guildes')
                .setColor('Blurple')
                .setDescription(currentGuilds.map((guild, index) => {
                    return `**${i + index + 1}. ${guild.name}** - Niveau ${guild.level}`;
                }).join('\n'));
            pages.push(embed);
        }

        let currentPage = 0;

        const getButtons = () => new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('prev_page')
                .setLabel('Précédent')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId('next_page')
                .setLabel('Suivant')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === pages.length - 1),
        );

        pages.forEach((page, index) => page.setFooter({ text: `Page ${index + 1} / ${pages.length}` }));

        const response = await interaction.reply({
            embeds: [pages[currentPage]],
            components: [getButtons()],
            fetchReply: true,
        });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'Vous ne pouvez pas utiliser ces boutons.', flags: 64 });
            }

            if (i.customId === 'prev_page') {
                currentPage--;
            } else if (i.customId === 'next_page') {
                currentPage++;
            }

            await i.update({ embeds: [pages[currentPage]], components: [getButtons()] });
        });

        collector.on('end', () => {
            interaction.editReply({ components: [] }).catch(() => {logger.warn(`Erreur lors de la mise à jour du message de liste de guilde expiré pour ${interaction.user.username}.`);});
        });
    },
};