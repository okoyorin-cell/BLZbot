/**
 * ============================================
 * SYSTÈME DE TROPHÉES & VALEUR - MAJ Mars 2026
 * ============================================
 * 
 * Renomme les "succès" en "trophées" avec raretés.
 * Introduit le concept de "valeur" qui agrège tout le profil.
 * 
 * TROPHÉES :
 * - Les quêtes/succès existants deviennent des trophées
 * - Chaque trophée a une rareté basée sur sa quête d'origine
 * - Les trophées Halloween spéciaux valent 15 000 valeur
 * 
 * VALEUR :
 * - Ranked : RP ≤ 100K → RP × 3 / RP > 100K → RP × 10 (totalité)
 * - Niveaux : 1 de valeur par XP
 * - PC : 1 de valeur par PC (point de comptage)
 * - Trophées Commun : 300 valeurs
 * - Trophées Rare : 1000 valeurs
 * - Trophées Épique : 2500 valeurs
 * - Trophées Légendaire : 5000 valeurs
 * - Trophées Mythique : 10000 valeurs
 * - Trophées Goatesque : 25000 valeurs
 * - Trophées Halloween spéciaux : 15000 valeurs
 * 
 * CLASSEMENTS :
 * - Classement de valeur individuel (dans /classement)
 * - Classement de valeur de guilde (total des membres)
 * - Upgrades guilde : seuils de valeur hardcodés dans UPGRADE_MATRIX
 */

const db = require('../database/database');
const logger = require('./logger');

// ==========================================
// VALEURS DES TROPHÉES PAR RARETÉ
// ==========================================

const TROPHY_VALUES = {
    'Commune': 300,
    'Rare': 1000,
    'Épique': 2500,
    'Légendaire': 5000,
    'Mythique': 10000,
    'Goatesque': 25000,
    'Halloween': 15000,
};

// ==========================================
// REQUÊTES PRÉPARÉES
// ==========================================

const getUserTrophiesStmt = db.prepare('SELECT * FROM user_trophies WHERE user_id = ? ORDER BY earned_at ASC');
const grantTrophyStmt = db.prepare('INSERT OR IGNORE INTO user_trophies (user_id, trophy_id, rarity, earned_at) VALUES (?, ?, ?, ?)');
const getUserTrophyCountStmt = db.prepare('SELECT rarity, COUNT(*) as count FROM user_trophies WHERE user_id = ? GROUP BY rarity');
const hasTrophyStmt = db.prepare('SELECT 1 FROM user_trophies WHERE user_id = ? AND trophy_id = ?');
const updateUserValueStmt = db.prepare('UPDATE users SET total_value = ? WHERE id = ?');
const updateGuildValueStmt = db.prepare('UPDATE guilds SET total_value = ? WHERE id = ?');

// ==========================================
// FONCTIONS TROPHÉES
// ==========================================

/**
 * Accorde un trophée à un utilisateur
 * @param {string} userId
 * @param {string} trophyId - L'ID du trophée (= quest_id)
 * @param {string} rarity - La rareté du trophée
 * @returns {boolean} true si nouveau trophée accordé
 */
function grantTrophy(userId, trophyId, rarity) {
    try {
        // Vérifier si déjà obtenu
        if (hasTrophyStmt.get(userId, trophyId)) {
            return false;
        }

        grantTrophyStmt.run(userId, trophyId, rarity, Date.now());
        logger.info(`[TROPHÉE] ${userId} a obtenu le trophée "${trophyId}" (${rarity})`);

        // Recalculer la valeur de l'utilisateur
        recalculateUserValue(userId);

        return true;
    } catch (error) {
        logger.error(`[TROPHÉE] Erreur grantTrophy pour ${userId}:`, error);
        return false;
    }
}

/**
 * Récupère tous les trophées d'un utilisateur
 * @param {string} userId
 * @returns {Array<{trophy_id: string, rarity: string, earned_at: number}>}
 */
function getUserTrophies(userId) {
    return getUserTrophiesStmt.all(userId);
}

/**
 * Vérifie si un utilisateur a un trophée spécifique
 * @param {string} userId
 * @param {string} trophyId
 * @returns {boolean}
 */
function hasTrophy(userId, trophyId) {
    return !!hasTrophyStmt.get(userId, trophyId);
}

/**
 * Récupère le nombre de trophées par rareté
 * @param {string} userId
 * @returns {object} { Commune: 5, Rare: 3, ... }
 */
function getUserTrophyCountByRarity(userId) {
    const counts = getUserTrophyCountStmt.all(userId);
    const result = {};
    for (const rarity of Object.keys(TROPHY_VALUES)) {
        result[rarity] = 0;
    }
    for (const row of counts) {
        result[row.rarity] = row.count;
    }
    return result;
}

// ==========================================
// FONCTIONS VALEUR
// ==========================================

/**
 * Calcule la valeur totale d'un utilisateur
 * @param {string} userId
 * @returns {number} La valeur totale
 */
function calculateUserValue(userId) {
    const user = db.prepare('SELECT points, xp, level, xp_needed, points_comptage FROM users WHERE id = ?').get(userId);
    if (!user) return 0;

    let totalValue = 0;

    // --- Ranked (RP/Points) ---
    const rp = user.points || 0;
    if (rp <= 100000) {
        totalValue += rp * 3;
    } else {
        totalValue += rp * 10; // Au-dessus de 100K : la totalité ×10
    }

    // --- Niveaux (XP total accumulé) ---
    // Calculer le total d'XP accumulé : somme de xp_needed pour chaque niveau passé + xp courant
    let totalXP = user.xp || 0;
    for (let lvl = 1; lvl < (user.level || 1); lvl++) {
        totalXP += 100 * (lvl + 1); // xp_needed = 100 * (level + 1)
    }
    totalValue += totalXP;

    // --- Points de Comptage (PC) ---
    totalValue += user.points_comptage || 0;

    // --- Trophées ---
    const trophyCounts = getUserTrophyCountByRarity(userId);
    for (const [rarity, count] of Object.entries(trophyCounts)) {
        totalValue += (TROPHY_VALUES[rarity] || 0) * count;
    }

    return totalValue;
}

/**
 * Recalcule et met à jour la valeur en cache d'un utilisateur
 * @param {string} userId
 * @returns {number} La nouvelle valeur
 */
function recalculateUserValue(userId) {
    const value = calculateUserValue(userId);
    updateUserValueStmt.run(value, userId);
    return value;
}

/**
 * Calcule la valeur totale d'une guilde (somme des valeurs de ses membres)
 * @param {number} guildId
 * @returns {number}
 */
function calculateGuildValue(guildId) {
    const result = db.prepare(`
        SELECT COALESCE(SUM(u.total_value), 0) as total 
        FROM guild_members gm 
        JOIN users u ON gm.user_id = u.id 
        WHERE gm.guild_id = ?
    `).get(guildId);

    return result?.total || 0;
}

/**
 * Recalcule et met à jour la valeur en cache d'une guilde
 * @param {number} guildId
 * @returns {number}
 */
function recalculateGuildValue(guildId) {
    const value = calculateGuildValue(guildId);
    updateGuildValueStmt.run(value, guildId);
    return value;
}

/**
 * Recalcule les valeurs de tous les utilisateurs et guildes
 * Appelé périodiquement (toutes les heures par ex.)
 */
function recalculateAllValues() {
    try {
        const users = db.prepare('SELECT id FROM users').all();
        let updated = 0;

        const updateTransaction = db.transaction(() => {
            for (const user of users) {
                const value = calculateUserValue(user.id);
                updateUserValueStmt.run(value, user.id);
                updated++;
            }
        });
        updateTransaction();

        // Recalculer les guildes
        const guilds = db.prepare('SELECT id FROM guilds').all();
        const updateGuildsTransaction = db.transaction(() => {
            for (const guild of guilds) {
                const value = calculateGuildValue(guild.id);
                updateGuildValueStmt.run(value, guild.id);
            }
        });
        updateGuildsTransaction();

        logger.info(`[VALEUR] Recalculé la valeur de ${updated} utilisateurs et ${guilds.length} guildes.`);
    } catch (error) {
        logger.error('[VALEUR] Erreur lors du recalcul global:', error);
    }
}

/**
 * Obtient le classement de valeur (top utilisateurs)
 * @param {number} limit
 * @returns {Array}
 */
function getValueLeaderboard(limit = 10) {
    return db.prepare(`
        SELECT id, username, total_value, level, points 
        FROM users 
        ORDER BY total_value DESC 
        LIMIT ?
    `).all(limit);
}

/**
 * Obtient le classement de valeur des guildes
 * @param {number} limit
 * @returns {Array}
 */
function getGuildValueLeaderboard(limit = 10) {
    return db.prepare(`
        SELECT id, name, total_value, upgrade_level, level 
        FROM guilds 
        ORDER BY total_value DESC 
        LIMIT ?
    `).all(limit);
}

/**
 * Obtient le rang d'un utilisateur dans le classement de valeur
 * @param {string} userId
 * @returns {number}
 */
function getUserValueRank(userId) {
    const result = db.prepare(`
        SELECT rank FROM (
            SELECT id, RANK() OVER (ORDER BY total_value DESC) as rank
            FROM users
        ) WHERE id = ?
    `).get(userId);
    return result ? result.rank : 0;
}

/**
 * Vérifie si une guilde remplit les conditions de valeur pour un upgrade
 * Utilise les seuils hardcodés de UPGRADE_MATRIX
 * @param {number} guildId
 * @param {number} upgradeLevel - Niveau d'upgrade ciblé
 * @returns {{ meets: boolean, current: number, required: number }}
 */
function checkGuildValueForUpgrade(guildId, upgradeLevel) {
    const guildValue = calculateGuildValue(guildId);
    const { UPGRADE_MATRIX } = require('./guild/guild-upgrades');
    const upgradeData = UPGRADE_MATRIX[upgradeLevel];
    const requiredValue = upgradeData ? upgradeData.requirements.guild_value : 0;

    return {
        meets: guildValue >= requiredValue,
        current: guildValue,
        required: requiredValue,
    };
}

/**
 * Obtient un résumé de valeur formaté pour un utilisateur
 * @param {string} userId
 * @returns {object}
 */
function getUserValueBreakdown(userId) {
    const user = db.prepare('SELECT points, xp, level, points_comptage, total_value FROM users WHERE id = ?').get(userId);
    if (!user) return null;

    const rp = user.points || 0;
    let rankedValue = 0;
    if (rp <= 100000) {
        rankedValue = rp * 3;
    } else {
        rankedValue = rp * 10; // Au-dessus de 100K : la totalité ×10
    }

    let totalXP = user.xp || 0;
    for (let lvl = 1; lvl < (user.level || 1); lvl++) {
        totalXP += 100 * (lvl + 1);
    }

    const trophyCounts = getUserTrophyCountByRarity(userId);
    let trophyValue = 0;
    for (const [rarity, count] of Object.entries(trophyCounts)) {
        trophyValue += (TROPHY_VALUES[rarity] || 0) * count;
    }

    return {
        total: user.total_value || 0,
        ranked: rankedValue,
        xp: totalXP,
        pc: user.points_comptage || 0,
        trophies: trophyValue,
        trophyCounts: trophyCounts,
        rank: getUserValueRank(userId),
    };
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    // Trophées
    grantTrophy,
    getUserTrophies,
    hasTrophy,
    getUserTrophyCountByRarity,

    // Valeur
    calculateUserValue,
    recalculateUserValue,
    calculateGuildValue,
    recalculateGuildValue,
    recalculateAllValues,
    getValueLeaderboard,
    getGuildValueLeaderboard,
    getUserValueRank,
    checkGuildValueForUpgrade,
    getUserValueBreakdown,

    // Constantes
    TROPHY_VALUES,
};
