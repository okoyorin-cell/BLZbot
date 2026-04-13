require('dotenv').config();
const db = require('../database/database');

const ALL_ITEMS = [
    'micro', 'ecran', 'couronne', 'xp_boost_1h', 'xp_boost_4h', 
    'points_boost_1h', 'joker_guilde', 'reset_boutique', 'streak_keeper',
    'mega_boost', 'remboursement', 'guild_upgrader', 'pass_combat_vip',
    'coffre_normal', 'coffre_mega', 'coffre_legendaire'
];

function getRandomItem() {
    return ALL_ITEMS[Math.floor(Math.random() * ALL_ITEMS.length)];
}

function canClaimHackerItem(userId) {
    const stmt = db.prepare(`
        SELECT hacker_item_timestamp FROM users WHERE id = ?
    `);
    
    const user = stmt.get(userId);
    if (!user || !user.hacker_item_timestamp) {
        return true;
    }
    
    const lastClaim = new Date(user.hacker_item_timestamp);
    const now = new Date();
    const hoursSinceLastClaim = (now - lastClaim) / (1000 * 60 * 60);
    
    return hoursSinceLastClaim >= 12;
}

function giveHackerItem(userId) {
    try {
        const item = getRandomItem();
        
        // Ajouter l'item à l'inventaire
        const checkStmt = db.prepare('SELECT quantity FROM user_inventory WHERE user_id = ? AND item_id = ?');
        const existingItem = checkStmt.get(userId, item);
        
        if (existingItem) {
            const updateStmt = db.prepare('UPDATE user_inventory SET quantity = quantity + 1 WHERE user_id = ? AND item_id = ?');
            updateStmt.run(userId, item);
        } else {
            const insertStmt = db.prepare('INSERT INTO user_inventory (user_id, item_id, quantity) VALUES (?, ?, ?)');
            insertStmt.run(userId, item, 1);
        }
        
        // Mettre à jour le timestamp
        const updateUserStmt = db.prepare('UPDATE users SET hacker_item_timestamp = ? WHERE id = ?');
        updateUserStmt.run(new Date().toISOString(), userId);
        
        return item;
    } catch (error) {
        console.error(`Erreur lors de la distribution d'item Hackeur à ${userId}:`, error);
        return null;
    }
}

function getItemDisplayName(itemId) {
    const itemNames = {
        'micro': '🎤 Micro',
        'ecran': '🖥️ Écran',
        'couronne': '👑 Couronne',
        'xp_boost_1h': '⚡ X2 Expérience 1h',
        'xp_boost_4h': '⚡⚡ X4 Expérience 1h',
        'points_boost_1h': '🎯 X2 Points Ranked 1h',
        'joker_guilde': '🃏 Joker de Guilde',
        'reset_boutique': '🔄 Reset Boutique',
        'streak_keeper': '🔥 Streak Keeper',
        'mega_boost': '🚀 MEGA BOOST',
        'remboursement': '💰 Remboursement',
        'guild_upgrader': '⬆️ Guild Upgrader',
        'pass_combat_vip': '🎖️ Pass de Combat VIP',
        'coffre_normal': '📦 Coffre au Trésor Normal',
        'coffre_mega': '📦📦 Méga Coffre au Trésor',
        'coffre_legendaire': '📦📦📦 Coffre Légendaire'
    };
    
    return itemNames[itemId] || itemId;
}

module.exports = {
    getRandomItem,
    canClaimHackerItem,
    giveHackerItem,
    getItemDisplayName
};
