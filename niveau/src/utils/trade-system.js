
const trades = {};

function generateTradeId() {
    return Math.random().toString(36).substring(2, 15);
}

function startTrade(user1Id, user2Id) {
    const tradeId = generateTradeId();
    trades[tradeId] = {
        id: tradeId,
        messageId: null,
        user1: {
            id: user1Id,
            items: [],
            ready: false
        },
        user2: {
            id: user2Id,
            items: [],
            ready: false
        }
    };
    return tradeId;
}

function getTrade(tradeId) {
    return trades[tradeId];
}

function updateTrade(tradeId, tradeData) {
    if (!trades[tradeId]) return;

    // Mise à jour profonde pour les objets imbriqués user1 et user2
    if (tradeData.user1) {
        trades[tradeId].user1 = { ...trades[tradeId].user1, ...tradeData.user1 };
    }
    if (tradeData.user2) {
        trades[tradeId].user2 = { ...trades[tradeId].user2, ...tradeData.user2 };
    }
    if (tradeData.messageId !== undefined) {
        trades[tradeId].messageId = tradeData.messageId;
    }
}

function endTrade(tradeId) {
    delete trades[tradeId];
}

module.exports = { startTrade, getTrade, updateTrade, endTrade };
