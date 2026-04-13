const { SlashCommandBuilder, TextDisplayBuilder, SectionBuilder, ContainerBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getOrCreateUser, getUserInventory, removeUserItem, addItemToInventory, grantResources } = require('../../utils/db-users');
const { getItem } = require('../../utils/items');
const { useItem } = require('../../utils/item-effects');
const logger = require('../../utils/logger');
const db = require('../../database/database');

const ITEMS_PER_PAGE = 8;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventaire')
        .setDescription('Affiche votre inventaire et permet d\'utiliser des objets.'),

    async execute(interaction) {
        const userId = interaction.user.id;
        let user = getOrCreateUser(userId, interaction.user.username);
        let inventory = getUserInventory(userId);

        if (inventory.length === 0) {
            const emptyText = new TextDisplayBuilder()
                .setContent('# 🎒 Inventaire\nVotre inventaire est vide.');
            const emptyContainer = new ContainerBuilder().addTextDisplayComponents(emptyText);
            return interaction.reply({ components: [emptyContainer], flags: MessageFlags.IsComponentsV2, ephemeral: true });
        }

        let currentPage = 0;

        const generateMessagePayload = (page) => {
            inventory = getUserInventory(userId); // Refresh
            const totalPages = Math.ceil(inventory.length / ITEMS_PER_PAGE);

            if (inventory.length === 0) {
                const emptyText = new TextDisplayBuilder().setContent('# 🎒 Inventaire\nVotre inventaire est vide.');
                return { components: [new ContainerBuilder().addTextDisplayComponents(emptyText)], flags: MessageFlags.IsComponentsV2, ephemeral: true };
            }

            if (page >= totalPages) page = Math.max(0, totalPages - 1);

            const components = [];

            const container = new ContainerBuilder();

            // Header
            const headerText = new TextDisplayBuilder()
                .setContent(`# 🎒 Inventaire de ${interaction.user.username}\n*Page ${page + 1}/${totalPages}*`);

            container.addTextDisplayComponents(headerText);

            // Items
            const startIdx = page * ITEMS_PER_PAGE;
            const endIdx = startIdx + ITEMS_PER_PAGE;
            const pageItems = inventory.slice(startIdx, endIdx);

            pageItems.forEach(invItem => {
                const item = getItem(invItem.item_id);
                if (!item) return;

                // Masquer les items passifs (micro, ecran, couronne)
                const { PASSIVE_ITEMS } = require('../../utils/items');
                if (PASSIVE_ITEMS.includes(item.id)) return;

                const description = `**Quantité:** ${invItem.quantity}\n*${item.description || 'Aucune description'}*`;

                const itemText = new TextDisplayBuilder()
                    .setContent(`### ${item.emoji || ''} ${item.name}\n${description}`);

                const itemSection = new SectionBuilder()
                    .addTextDisplayComponents(itemText);

                const useButton = new ButtonBuilder()
                    .setCustomId(`use_item_${item.id}`)
                    .setLabel('Utiliser')
                    .setStyle(ButtonStyle.Success);

                itemSection.setButtonAccessory(useButton);
                container.addSectionComponents(itemSection);
            });

            // Navigation
            const navRow = new ActionRowBuilder();
            const prevButton = new ButtonBuilder()
                .setCustomId('inv_prev')
                .setLabel('◀️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0);

            const nextButton = new ButtonBuilder()
                .setCustomId('inv_next')
                .setLabel('▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page >= totalPages - 1);

            navRow.addComponents(prevButton, nextButton);

            components.push(container, navRow);

            return {
                components: components,
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            };
        };

        const response = await interaction.reply(generateMessagePayload(currentPage));

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 10 * 60 * 1000,
        });

        // Helper function for item usage
        // Helper function for item usage
        const handleItemUsage = async (i, itemId) => {
            try {
                await useItem(i, itemId);
                // Refresh inventory display after usage
                await interaction.editReply(generateMessagePayload(currentPage));
            } catch (error) {
                console.error("Error using item:", error);
                if (!i.replied && !i.deferred) {
                    await i.reply({ content: "Une erreur est survenue.", ephemeral: true });
                }
            }
        };

        collector.on('collect', async (i) => {
            if (i.user.id !== userId) return i.reply({ content: 'Ceci n\'est pas votre inventaire.', ephemeral: true });

            if (i.customId === 'inv_prev') {
                currentPage = Math.max(0, currentPage - 1);
                await i.update(generateMessagePayload(currentPage));
                return;
            }

            if (i.customId === 'inv_next') {
                currentPage = Math.min(Math.ceil(inventory.length / ITEMS_PER_PAGE) - 1, currentPage + 1);
                await i.update(generateMessagePayload(currentPage));
                return;
            }

            if (i.customId.startsWith('use_item_')) {
                const itemId = i.customId.replace('use_item_', '');
                const item = getItem(itemId);

                if (!item) return i.reply({ content: 'Item inconnu.', ephemeral: true });

                if (item.rarity === 'Légendaire' || item.rarity === 'Mythique') {
                    // Confirmation via Embed classique (évite le conflit Components V2)
                    const { EmbedBuilder } = require('discord.js');

                    const confirmEmbed = new EmbedBuilder()
                        .setTitle('⚠️ ATTENTION')
                        .setDescription(`Vous allez utiliser **${item.name}**.\nÊtes-vous sûr ?`)
                        .setColor(0xFFAA00);

                    const confirmRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`confirm_use_btn_${itemId}`)
                            .setLabel('✅ Confirmer')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`cancel_use_btn_${itemId}`)
                            .setLabel('❌ Annuler')
                            .setStyle(ButtonStyle.Danger)
                    );

                    const confirmMsg = await i.reply({
                        embeds: [confirmEmbed],
                        components: [confirmRow],
                        ephemeral: true,
                        fetchReply: true
                    });

                    const confirmCollector = confirmMsg.createMessageComponentCollector({
                        componentType: ComponentType.Button,
                        time: 60000,
                        max: 1
                    });

                    confirmCollector.on('collect', async (subI) => {
                        if (subI.customId === `confirm_use_btn_${itemId}`) {
                            await subI.deferUpdate(); // Acknowledge click
                            await handleItemUsage(subI, itemId);
                            // Le message de confirmation est géré par useItem lui-même
                        } else {
                            await subI.update({ content: '❌ Annulé.', embeds: [], components: [] });
                        }
                    });

                } else {
                    await i.deferReply({ ephemeral: true });
                    await handleItemUsage(i, itemId);
                }
            }
        });

        collector.on('end', () => {
            // Cleanup
        });
    },
};