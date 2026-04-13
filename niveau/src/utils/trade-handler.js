
const { getTrade, updateTrade, endTrade } = require('./trade-system');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { getUserInventory, removeUserItem, addItemToInventory } = require('./db-users');
const { getItem, getRarityValue } = require('./items');
const { checkQuestProgress } = require('./quests');

async function handleTradeInteraction(interaction) {
    const parts = interaction.customId.split('_');
    let action, tradeId;

    if (parts[0] === 'accept' || parts[0] === 'decline') {
        // Format: accept_trade_ID
        action = parts[0];
        tradeId = parts[2];
    } else if (parts[0] === 'trade') {
        // Format: trade_ACTION_ID ou trade_select_item_ID
        if (parts[1] === 'select') {
            // trade_select_item_ID
            action = 'select';
            tradeId = parts[3];
        } else {
            // trade_add_ID, trade_ready_ID, trade_cancel_ID
            action = parts[1];
            tradeId = parts[2];
        }
    }

    const trade = getTrade(tradeId);

    if (!trade) {
        return interaction.reply({ content: "Cet échange n'existe plus.", ephemeral: true });
    }

    const userIsUser1 = interaction.user.id === trade.user1.id;
    const userIsUser2 = interaction.user.id === trade.user2.id;

    if (!userIsUser1 && !userIsUser2) {
        return interaction.reply({ content: "Vous ne participez pas à cet échange.", ephemeral: true });
    }

    switch (action) {
        case 'accept':
            // Empêcher l'initiateur d'accepter son propre échange
            if (interaction.user.id === trade.user1.id) {
                return interaction.reply({ content: "❌ Vous ne pouvez pas accepter votre propre échange.", ephemeral: true });
            }
            await handleAccept(interaction, trade);
            break;
        case 'decline':
            await handleDecline(interaction, trade);
            break;
        case 'add':
            await handleAddItem(interaction, trade);
            break;
        case 'select':
            await handleSelectItem(interaction, trade);
            break;
        case 'ready':
            await handleReady(interaction, trade);
            break;
        case 'cancel':
            await handleCancel(interaction, trade);
            break;
    }
}

async function handleAccept(interaction, trade) {
    const user1Member = interaction.guild.members.cache.get(trade.user1.id);
    const user2Member = interaction.guild.members.cache.get(trade.user2.id);

    const tradeEmbed = new EmbedBuilder()
        .setTitle('Échange')
        .setColor(0x3498db)
        .addFields(
            { name: user1Member?.displayName || 'Utilisateur 1', value: 'Aucun objet', inline: true },
            { name: user2Member?.displayName || 'Utilisateur 2', value: 'Aucun objet', inline: true },
        );

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`trade_add_${trade.id}`)
                .setLabel('Ajouter un objet')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`trade_ready_${trade.id}`)
                .setLabel('Prêt')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`trade_cancel_${trade.id}`)
                .setLabel('Annuler')
                .setStyle(ButtonStyle.Danger)
        );

    // Mise à jour du message et récupération de l'ID via interaction.message
    await interaction.update({ content: 'Échange accepté!', embeds: [tradeEmbed], components: [row] });

    // Stocker le messageId depuis l'interaction.message (le message qui a été mis à jour)
    const messageId = interaction.message.id;
    updateTrade(trade.id, { messageId: messageId });
}

async function handleDecline(interaction, trade) {
    endTrade(trade.id);
    await interaction.update({ content: 'Échange refusé.', embeds: [], components: [] });
}

async function handleAddItem(interaction, trade) {
    const userInventory = getUserInventory(interaction.user.id);
    const items = userInventory
        .map(invItem => getItem(invItem.item_id))
        .filter(item => item !== undefined);

    if (items.length === 0) {
        return interaction.reply({ content: "Vous n'avez aucun objet dans votre inventaire.", ephemeral: true });
    }

    // Limiter à 25 options max pour le select menu
    const options = items.slice(0, 25).map(item => ({
        label: item.name.slice(0, 100),
        value: item.id,
        description: item.description?.slice(0, 100) || 'Aucune description'
    }));

    const row = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`trade_select_item_${trade.id}`)
                .setPlaceholder('Sélectionnez un objet à ajouter')
                .addOptions(options)
        );

    await interaction.reply({ content: "Choisissez un objet à ajouter à l'échange.", components: [row], ephemeral: true });
}

async function handleReady(interaction, trade) {
    const userIsUser1 = interaction.user.id === trade.user1.id;

    if (userIsUser1) {
        trade.user1.ready = true;
    } else {
        trade.user2.ready = true;
    }

    // Mise à jour complète du trade dans le store
    updateTrade(trade.id, {
        user1: { ...trade.user1 },
        user2: { ...trade.user2 }
    });

    const user1Member = interaction.guild.members.cache.get(trade.user1.id);
    const user2Member = interaction.guild.members.cache.get(trade.user2.id);

    // Vérifier si les deux sont prêts AVANT de répondre
    const bothReady = trade.user1.ready && trade.user2.ready;

    if (bothReady) {
        // Vérifier l'équilibre de l'échange
        const user1Value = trade.user1.items.reduce((acc, itemId) => {
            const item = getItem(itemId);
            return acc + (item ? getRarityValue(item.rarity) : 0);
        }, 0);
        const user2Value = trade.user2.items.reduce((acc, itemId) => {
            const item = getItem(itemId);
            return acc + (item ? getRarityValue(item.rarity) : 0);
        }, 0);

        const valueDifference = Math.abs(user1Value - user2Value);
        const totalValue = user1Value + user2Value;
        const differencePercentage = totalValue > 0 ? (valueDifference / totalValue) * 100 : 0;

        if (differencePercentage > 25) {
            // Échange non équilibré - reset les états
            trade.user1.ready = false;
            trade.user2.ready = false;
            updateTrade(trade.id, {
                user1: { ...trade.user1 },
                user2: { ...trade.user2 }
            });

            const resetEmbed = new EmbedBuilder()
                .setTitle('Échange')
                .setColor(0xe74c3c)
                .addFields(
                    {
                        name: user1Member?.displayName || 'Utilisateur 1',
                        value: trade.user1.items.map(id => getItem(id)?.name || 'Item inconnu').join('\n') || 'Aucun objet',
                        inline: true
                    },
                    {
                        name: user2Member?.displayName || 'Utilisateur 2',
                        value: trade.user2.items.map(id => getItem(id)?.name || 'Item inconnu').join('\n') || 'Aucun objet',
                        inline: true
                    },
                );

            await interaction.update({
                content: "⚠️ L'échange n'est pas équilibré (plus de 25% de différence de valeur). L'état de prêt a été réinitialisé.",
                embeds: [resetEmbed]
            });
            return;
        }

        // Transférer les items
        trade.user1.items.forEach(itemId => {
            removeUserItem(trade.user1.id, itemId);
            addItemToInventory(trade.user2.id, itemId, 1);
        });
        trade.user2.items.forEach(itemId => {
            removeUserItem(trade.user2.id, itemId);
            addItemToInventory(trade.user1.id, itemId, 1);
        });

        // Déclencher les quêtes
        checkQuestProgress(interaction.client, 'TRADE_COMPLETE', { id: trade.user1.id }, { otherUserId: trade.user2.id });
        checkQuestProgress(interaction.client, 'TRADE_COMPLETE', { id: trade.user2.id }, { otherUserId: trade.user1.id });

        endTrade(trade.id);

        // Finaliser l'échange avec un seul appel update()
        await interaction.update({ content: "✅ Échange terminé avec succès!", embeds: [], components: [] });
    } else {
        // Un seul utilisateur est prêt, afficher l'état actuel
        const tradeEmbed = new EmbedBuilder()
            .setTitle('Échange')
            .setColor(0x3498db)
            .addFields(
                {
                    name: `${user1Member?.displayName || 'Utilisateur 1'} ${trade.user1.ready ? '✅' : ''}`,
                    value: trade.user1.items.map(id => getItem(id)?.name || 'Item inconnu').join('\n') || 'Aucun objet',
                    inline: true
                },
                {
                    name: `${user2Member?.displayName || 'Utilisateur 2'} ${trade.user2.ready ? '✅' : ''}`,
                    value: trade.user2.items.map(id => getItem(id)?.name || 'Item inconnu').join('\n') || 'Aucun objet',
                    inline: true
                },
            );

        await interaction.update({ embeds: [tradeEmbed] });
    }
}

async function handleCancel(interaction, trade) {
    endTrade(trade.id);
    try {
        await interaction.message.delete();
    } catch (error) {
        // Le message a peut-être déjà été supprimé
        await interaction.reply({ content: "L'échange a été annulé.", ephemeral: true });
    }
}

async function handleSelectItem(interaction, trade) {
    const selectedItemId = interaction.values[0];
    const userIsUser1 = interaction.user.id === trade.user1.id;

    // Vérifier que l'utilisateur possède bien l'item
    const userInventory = getUserInventory(interaction.user.id);
    const hasItem = userInventory.some(invItem => invItem.item_id === selectedItemId);

    if (!hasItem) {
        return interaction.reply({ content: "Vous ne possédez pas cet objet.", ephemeral: true });
    }

    // Vérifier si l'item n'est pas déjà dans l'échange
    const userItems = userIsUser1 ? trade.user1.items : trade.user2.items;
    if (userItems.includes(selectedItemId)) {
        return interaction.reply({ content: "Cet objet est déjà dans l'échange.", ephemeral: true });
    }

    if (userIsUser1) {
        trade.user1.items.push(selectedItemId);
    } else {
        trade.user2.items.push(selectedItemId);
    }

    // Mise à jour complète du trade
    updateTrade(trade.id, {
        user1: { ...trade.user1 },
        user2: { ...trade.user2 }
    });

    const user1Member = interaction.guild.members.cache.get(trade.user1.id);
    const user2Member = interaction.guild.members.cache.get(trade.user2.id);

    const tradeEmbed = new EmbedBuilder()
        .setTitle('Échange')
        .setColor(0x3498db)
        .addFields(
            {
                name: `${user1Member?.displayName || 'Utilisateur 1'} ${trade.user1.ready ? '✅' : ''}`,
                value: trade.user1.items.map(id => getItem(id)?.name || 'Item inconnu').join('\n') || 'Aucun objet',
                inline: true
            },
            {
                name: `${user2Member?.displayName || 'Utilisateur 2'} ${trade.user2.ready ? '✅' : ''}`,
                value: trade.user2.items.map(id => getItem(id)?.name || 'Item inconnu').join('\n') || 'Aucun objet',
                inline: true
            },
        );

    try {
        // Utiliser le messageId stocké dans le trade
        if (!trade.messageId) {
            await interaction.reply({ content: "Erreur: L'échange n'a pas de message associé.", ephemeral: true });
            return;
        }

        const channel = await interaction.client.channels.fetch(interaction.channelId);
        const message = await channel.messages.fetch(trade.messageId);

        await message.edit({ embeds: [tradeEmbed] });
        await interaction.reply({ content: 'Objet ajouté! ✅', ephemeral: true });
    } catch (error) {
        if (error.code === 10008) { // Unknown Message
            endTrade(trade.id);
            await interaction.reply({ content: "Le message d'échange est introuvable. L'échange a été annulé par sécurité.", ephemeral: true });
        } else {
            console.error('Erreur lors de la mise à jour de l\'échange:', error);
            if (!interaction.replied) {
                await interaction.reply({ content: "Une erreur est survenue lors de l'ajout de l'objet.", ephemeral: true });
            }
        }
    }
}

module.exports = { handleTradeInteraction };
