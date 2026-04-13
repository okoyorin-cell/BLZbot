const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getOrCreateEventUser, grantEventCurrency, getEventState, getMultiplierRemainingTime, getActiveMultiplier, grantGifts } = require('../../utils/db-noel');
const mainDb = require('../../database/database');
const logger = require('../../utils/logger');
const roleConfig = require('../../config/role.config.json');

const RICH_WINTER_ROLE = roleConfig.eventRoles.noel.shopRoles.richWinter;

const CHRISTMAS_SHOP_ITEMS = [
    {
        id: 'xp_money_boost',
        name: '⚡ Multiplicateur X2 Argent/Starss',
        description: 'Double votre gain d\'Argent et Starss pendant 1 heure.',
        price: 30000,
        type: 'xp_money_x2',
        duration: 3600000,
    },
    {
        id: 'rank_boost',
        name: '✨ Multiplicateur X2 Points de Rang',
        description: 'Double votre gain de Points de Rang pendant 1 heure.',
        price: 40000,
        type: 'rank_points_x2',
        duration: 3600000,
    },
    {
        id: 'cadeau_surprise',
        name: '🎁 Cadeau Surprise',
        description: 'Contient une récompense aléatoire. Utilisez /cadeau-ouvrir pour l\'ouvrir.',
        price: 20000,
    },
    {
        id: 'role_riche_hiver',
        name: `💎 Rôle "${RICH_WINTER_ROLE.name}"`,
        description: 'Affiche votre richesse hivernale sur le serveur.',
        price: 250000,
    },
];

function formatTime(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('boutique-noël')
        .setDescription('Dépensez vos rubans dans la boutique de l\'événement Noël.'),

    async execute(interaction) {
        if (!getEventState('noël')) {
            return interaction.reply({ content: "Il n'y a pas d'événement Noël actif pour le moment.", ephemeral: true });
        }

        const userId = interaction.user.id;
        const eventUser = getOrCreateEventUser(userId, interaction.user.username);
        const activeMultiplier = getActiveMultiplier(userId);

        // Construire la description avec les multiplicateurs actifs
        let description = `Votre solde : **${eventUser.rubans.toLocaleString('fr-FR')}** Rubans 🎀\n\n`;
        
        if (activeMultiplier) {
            const remaining = getMultiplierRemainingTime(userId);
            if (remaining) {
                const multiplierName = activeMultiplier.multiplier_type === 'xp_money_x2' 
                    ? 'X2 Argent/Starss' 
                    : 'X2 Points de Rang';
                description += `**Multiplicateur actif :** ${multiplierName}\n`;
                description += `**Temps restant :** ${formatTime(remaining)}\n\n`;
            }
        }

        const embed = new EmbedBuilder()
            .setTitle('🎄 Boutique de Noël 🎄')
            .setDescription(description)
            .setColor('#DC143C');

        const menuOptions = CHRISTMAS_SHOP_ITEMS.map(item => {
            let isDisabled = false;
            let suffix = '';

            // Vérifier si le multiplicateur est déjà actif
            if ((item.id === 'xp_money_boost' || item.id === 'rank_boost') && activeMultiplier) {
                isDisabled = true;
                suffix = ' (✅ Actif)';
            }

            // Vérifier si l'utilisateur a déjà le rôle
            if (item.id === 'role_riche_hiver' && interaction.member.roles.cache.some(r => r.name === RICH_WINTER_ROLE.name)) {
                isDisabled = true;
                suffix = ' (✅ Possédé)';
            }

            embed.addFields({
                name: `${item.name}${suffix}`,
                value: `${item.description}\nPrix : **${item.price.toLocaleString('fr-FR')}** rubans`,
                inline: false,
            });

            return {
                label: item.name,
                value: item.id,
                description: `Prix : ${item.price.toLocaleString('fr-FR')} rubans${suffix}`,
                disabled: isDisabled,
            };
        });

        // Ne créer le menu que s'il y a au moins une option non désactivée
        const availableOptions = menuOptions.filter(opt => !opt.disabled);
        if (availableOptions.length === 0) {
            return interaction.reply({ 
                embeds: [embed], 
                content: 'Vous possédez déjà tous les items disponibles ou les multiplicateurs ne peuvent pas être cumulés !', 
                ephemeral: true 
            });
        }

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('christmas_boutique_select')
                .setPlaceholder('Sélectionnez un item à acheter')
                .addOptions(availableOptions)
        );

        const response = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 5 * 60 * 1000 });

        collector.on('collect', async i => {
            if (i.user.id !== userId) return i.reply({ content: 'Vous ne pouvez pas utiliser ce menu.', ephemeral: true }).catch(() => null);

            const itemId = i.values[0];
            const selectedItem = CHRISTMAS_SHOP_ITEMS.find(item => item.id === itemId);

            // Si c'est un cadeau surprise, ouvrir un modal pour la quantité
            if (selectedItem.id === 'cadeau_surprise') {
                const modal = new ModalBuilder()
                    .setCustomId('cadeau_surprise_quantity_modal')
                    .setTitle('Acheter des Cadeaux Surprise');

                const quantityInput = new TextInputBuilder()
                    .setCustomId('cadeau_quantity')
                    .setLabel('Quantité (1-99)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('1')
                    .setRequired(true)
                    .setMinLength(1)
                    .setMaxLength(2);

                const row = new ActionRowBuilder().addComponents(quantityInput);
                modal.addComponents(row);

                await i.showModal(modal);
                return;
            }

            const currentUserState = getOrCreateEventUser(userId, i.user.username);

            // Vérifier le solde
            if (currentUserState.rubans < selectedItem.price) {
                return i.reply({ 
                    content: `❌ Vous n'avez pas assez de rubans. Vous en avez **${currentUserState.rubans.toLocaleString('fr-FR')}** et l'item coûte **${selectedItem.price.toLocaleString('fr-FR')}**.`, 
                    ephemeral: true 
                });
            }

            // Vérifier les conditions supplémentaires
            if (selectedItem.id === 'xp_money_boost' || selectedItem.id === 'rank_boost') {
                const currentActive = getActiveMultiplier(userId);
                if (currentActive) {
                    return i.reply({ 
                        content: '❌ Vous avez déjà un multiplicateur actif. Attendez qu\'il expire avant d\'en acheter un autre.', 
                        ephemeral: true 
                    });
                }
                // Appliquer le multiplicateur
                const { setMultiplier } = require('../../utils/db-noel');
                setMultiplier(userId, selectedItem.type, selectedItem.duration);
            }

            if (selectedItem.id === 'role_riche_hiver') {
                if (i.member.roles.cache.some(r => r.name === RICH_WINTER_ROLE.name)) {
                    return i.reply({ 
                        content: '❌ Vous possédez déjà ce rôle.', 
                        ephemeral: true 
                    });
                }
                // Créer ou récupérer le rôle
                const guild = await i.guild.fetch();
                let role = guild.roles.cache.find(r => r.name === RICH_WINTER_ROLE.name);
                if (!role) {
                    role = await guild.roles.create({ 
                        name: RICH_WINTER_ROLE.name, 
                        color: RICH_WINTER_ROLE.color,
                        reason: 'Rôle boutique Noël'
                    });
                }
                await i.member.roles.add(role);
            }

            // Déduire les rubans
            grantEventCurrency(userId, { rubans: -selectedItem.price });

            const purchaseEmbed = new EmbedBuilder()
                .setTitle('✅ Achat réussi !')
                .setDescription(`Vous avez acheté : **${selectedItem.name}**`)
                .addFields(
                    { name: 'Prix payé', value: `${selectedItem.price.toLocaleString('fr-FR')} rubans`, inline: true },
                    { name: 'Nouveau solde', value: `${(currentUserState.rubans - selectedItem.price).toLocaleString('fr-FR')} rubans`, inline: true }
                )
                .setColor('Green')
                .setTimestamp();

            await i.reply({ embeds: [purchaseEmbed], ephemeral: true });
            logger.info(`${i.user.username} a acheté ${selectedItem.name} pour ${selectedItem.price} rubans`);
        });

        collector.on('end', async () => {
            try {
                await response.edit({ components: [] }).catch(() => {});
            } catch (error) {
                logger.error('Erreur lors de la désactivation du menu:', error);
            }
        });
    },
};
