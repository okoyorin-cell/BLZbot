
const games = {};

function generateGameId() {
    return Math.random().toString(36).substring(2, 15);
}

function startGame(gameType, player1Id, player1Username, player2Id, player2Username, bet) {
    const gameId = generateGameId();
    games[gameId] = {
        id: gameId,
        type: gameType,
        player1: {
            id: player1Id,
            username: player1Username,
            choice: null
        },
        player2: {
            id: player2Id,
            username: player2Username,
            choice: null
        },
        bet: bet,
        status: 'pending'
    };
    return gameId;
}

function getGame(gameId) {
    return games[gameId];
}

function updateGame(gameId, gameData) {
    games[gameId] = { ...games[gameId], ...gameData };
}

function endGame(gameId) {
    delete games[gameId];
}

module.exports = { startGame, getGame, updateGame, endGame, games };
