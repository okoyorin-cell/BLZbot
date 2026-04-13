const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SectionBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getOrCreateEventUser, grantEventCurrency, getEventState, hasUnlocked, unlockItem } = require('../../utils/db-valentin');
const { ITEMS } = require('../../utils/items');
const { useCoeurRouge } = require('../../utils/item-effects');
const logger = require('../../utils/logger');

const VALENTIN_SHOP_ITEMS = [
    { id: 'bague_mariage', item: ITEMS.bague_mariage, type: 'passive' },
    { id: 'ami_chiant', item: ITEMS.ami_chiant, type: 'passive' },
    { id: 'coeur_rouge', item: ITEMS.coeur_rouge, type: 'consumable' }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('boutique-valentin')
        .setDescription('Dépensez vos cœurs dans la Boutique Aimable de la Saint-Valentin.'),

    async execute(interaction) {
        if (!getEventState('valentin')) {
            return interaction.reply({ content: "Il n'y a pas d'événement Saint-Valentin actif pour le moment.", ephemeral: true });
        }

        const userId = interaction.user.id;
        let eventUser = getOrCreateEventUser(userId, interaction.user.username);

        const generateMessagePayload = () => {
            const container = new ContainerBuilder();

            // Header Section
            const headerText = new TextDisplayBuilder()
                .setContent(`# 💖 Boutique Aimable 💖\nVotre solde : **${eventUser.coeurs.toLocaleString('fr-FR')}** Cœurs ❤️\n\n⚠️ **Attention** : Les items achetés ici sont **activés ou utilisés immédiatement** et n'apparaissent pas dans votre inventaire classique.`);

            container.addTextDisplayComponents(headerText);

            // Items Section
            VALENTIN_SHOP_ITEMS.forEach(entry => {
                const item = entry.item;
                const canAfford = eventUser.coeurs >= item.price;

                // Vérifier si déjà débloqué pour les passifs
                const isUnlocked = entry.type === 'passive' && hasUnlocked(userId, entry.id);

                let description = `**Prix :** ${item.price.toLocaleString('fr-FR')} cœurs\n${item.description}`;
                let buttonLabel = 'Acheter';
                let buttonStyle = ButtonStyle.Primary;
                let isDisabled = !canAfford;

                if (isUnlocked) {
                    buttonLabel = 'Déjà possédé (Actif)';
                    buttonStyle = ButtonStyle.Success;
                    isDisabled = true;
                    description += '\n✅ **Cet effet est déjà actif sur votre compte.**';
                }

                const itemText = new TextDisplayBuilder()
                    .setContent(`### ${item.name}\n${description}`);

                const buyButton = new ButtonBuilder()
                    .setCustomId(`valentin_buy_${entry.id}`)
                    .setLabel(buttonLabel)
                    .setStyle(buttonStyle)
                    .setDisabled(isDisabled);

                const section = new SectionBuilder()
                    .addTextDisplayComponents(itemText)
                    .setButtonAccessory(buyButton);

                container.addSectionComponents(section);
            });

            return {
                components: [container],
                ephemeral: true,
                flags: 32768 // Required flag for V2 components
            };
        };

        const response = await interaction.reply(generateMessagePayload());

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 5 * 60 * 1000
        });

        collector.on('collect', async i => {
            if (i.user.id !== userId) return i.reply({ content: '❌ Vous ne pouvez pas utiliser ce menu.', ephemeral: true }).catch(() => null);

            if (!i.customId.startsWith('valentin_buy_')) return;

            const itemId = i.customId.replace('valentin_buy_', '');
            const selectedItemEntry = VALENTIN_SHOP_ITEMS.find(e => e.id === itemId);
            const selectedItem = selectedItemEntry.item;

            // Re-fetch user state
            eventUser = getOrCreateEventUser(userId, i.user.username);

            if (eventUser.coeurs < selectedItem.price) {
                return i.reply({
                    content: `❌ Vous n'avez pas assez de cœurs. Il vous manque **${(selectedItem.price - eventUser.coeurs).toLocaleString('fr-FR')}** cœurs.`,
                    ephemeral: true
                });
            }

            // Vérification double pour les passifs
            if (selectedItemEntry.type === 'passive' && hasUnlocked(userId, itemId)) {
                return i.reply({ content: '❌ Vous possédez déjà cet effet passif.', ephemeral: true });
            }

            await i.deferUpdate().catch(() => null);

            // Déduire l'argent
            grantEventCurrency(userId, { coeurs: -selectedItem.price });
            eventUser.coeurs -= selectedItem.price;

            let purchaseMessage = `🎁 **Achat réussi !**\nVous avez acheté **${selectedItem.name}** pour ${selectedItem.price.toLocaleString('fr-FR')} cœurs.`;

            // Traitement spécifique
            if (selectedItemEntry.type === 'passive') {
                unlockItem(userId, itemId);
                purchaseMessage += `\n✅ **L'effet est maintenant activé sur votre compte !**`;

                if (itemId === 'bague_mariage') {
                    purchaseMessage += `\n\n💍 **Information Mariage** :\nLe boost de la bague est de 10% de base. Pour atteindre **30%**, vous devez vous marier avec quelqu'un qui possède aussi la bague via la commande \`/marier <utilisateur>\` !`;
                }
            } else if (itemId === 'coeur_rouge') {
                const result = await useCoeurRouge(i, userId);
                if (result) {
                    purchaseMessage += `\n\n${result}`;
                } else {
                    purchaseMessage += `\n⚠️ Une erreur est survenue lors de l'ouverture du cœur.`;
                }
            }

            await i.followUp({ content: purchaseMessage, ephemeral: true });

            // Re-render shop
            await i.editReply(generateMessagePayload());

            logger.info(`${i.user.username} a acheté ${selectedItem.name} pour ${selectedItem.price} cœurs`);
        });

        collector.on('end', async () => { });
    },
};
