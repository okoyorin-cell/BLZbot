const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { getUserInventory, getOrCreateUser } = require('../../utils/db-users');
const { getItem } = require('../../utils/items');
const { useItem } = require('../../utils/item-effects');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('use')
        .setDescription('Utiliser un item de votre inventaire.')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('L\'item à utiliser')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        const userId = interaction.user.id;
        const inventory = getUserInventory(userId);

        // Filtrer les items utilisables
        const usableItems = inventory.filter(row => {
            const item = getItem(row.item_id);
            if (!item) return false;
            // Liste des items utilisables
            return ['coffre_normal', 'coffre_mega', 'coffre_legendaire', 'mega_boost',
                'remboursement', 'streak_keeper', 'double_daily',
                'coup_detat', 'reset_boutique',
                'guild_upgrader'].includes(item.id);
        });

        const focusedValue = interaction.options.getFocused().toLowerCase();

        const choices = usableItems
            .map(row => {
                const item = getItem(row.item_id);
                return {
                    name: `${item.name} (x${row.quantity})`,
                    value: item.id
                };
            })
            .filter(choice => choice.name.toLowerCase().includes(focusedValue))
            .slice(0, 25); // Discord limite à 25 choix

        await interaction.respond(choices);
    },

    async execute(interaction) {
        const userId = interaction.user.id;
        const itemId = interaction.options.getString('item');
        const inventory = getUserInventory(userId);

        // Vérifier si l'utilisateur possède l'item
        const inventoryItem = inventory.find(row => row.item_id === itemId);
        if (!inventoryItem || inventoryItem.quantity <= 0) {
            return interaction.reply({
                content: '❌ Vous ne possédez pas cet item dans votre inventaire.',
                ephemeral: true
            });
        }

        const item = getItem(itemId);
        if (!item) {
            return interaction.reply({
                content: '❌ Item invalide.',
                ephemeral: true
            });
        }

        // Vérifier si l'item nécessite une confirmation (Épique ou plus)
        const needsConfirmation = ['Épique', 'Légendaire', 'Mythique', 'Goatesque'].includes(item.rarity);

        if (needsConfirmation) {
            const embed = new EmbedBuilder()
                .setTitle('⚠️ Confirmation requise')
                .setDescription(`Êtes-vous sûr de vouloir utiliser **${item.name}** ?\n\n*${item.description}*`)
                .setColor('Orange')
                .setFooter({ text: `Rareté: ${item.rarity}` });

            const confirmButton = new ButtonBuilder()
                .setCustomId(`confirm_use_${itemId}`)
                .setLabel('✅ Confirmer')
                .setStyle(ButtonStyle.Success);

            const cancelButton = new ButtonBuilder()
                .setCustomId('cancel_use')
                .setLabel('❌ Annuler')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder()
                .addComponents(confirmButton, cancelButton);

            const response = await interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: true
            });

            const collector = response.createMessageComponentCollector({
                time: 30000 // 30 secondes
            });

            collector.on('collect', async (i) => {
                if (i.user.id !== userId) {
                    return i.reply({
                        content: '❌ Vous ne pouvez pas utiliser ces boutons.',
                        ephemeral: true
                    });
                }

                if (i.customId === 'cancel_use') {
                    await i.update({
                        content: '❌ Utilisation annulée.',
                        embeds: [],
                        components: []
                    });
                    collector.stop();
                    return;
                }

                if (i.customId === `confirm_use_${itemId}`) {
                    await i.deferUpdate();
                    try {
                        await useItem(i, itemId);
                    } catch (error) {
                        console.error('Erreur lors de l\'utilisation de l\'item:', error);
                        // Afficher le message d'erreur à l'utilisateur
                        await i.editReply({
                            content: `❌ Une erreur est survenue lors de l\'utilisation de l\'item.\n\`\`\`\n${error.message}\n\`\`\``,
                            embeds: [],
                            components: []
                        });
                        // Relancer l'erreur pour qu'elle soit loggée dans les logs du bot
                        throw error;
                    }
                    collector.stop();
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    interaction.editReply({
                        content: '⏱️ Temps écoulé. Utilisation annulée.',
                        embeds: [],
                        components: []
                    }).catch(() => { });
                }
            });
        } else {
            // Pas de confirmation nécessaire, utiliser directement
            await interaction.deferReply({ ephemeral: true });
            await useItem(interaction, itemId);
        }
    }
};
