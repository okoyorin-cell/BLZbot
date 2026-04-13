const db = require('../database/database');

// --- Requêtes Préparées ---
const getQuestProgressStmt = db.prepare('SELECT * FROM quest_progress WHERE user_id = ? AND quest_id = ?');
const createOrUpdateQuestProgressStmt = db.prepare(`
    INSERT INTO quest_progress (user_id, quest_id, progress, completed)
    VALUES (?, ?, ?, 0)
    ON CONFLICT(user_id, quest_id) DO UPDATE SET
    progress = excluded.progress;
`);
const completeQuestStmt = db.prepare('UPDATE quest_progress SET completed = ? WHERE user_id = ? AND quest_id = ?');
const forceCompleteQuestStmt = db.prepare('UPDATE quest_progress SET completed = ? WHERE user_id = ? AND quest_id = ?');
const getAllUserQuestsStmt = db.prepare('SELECT * FROM quest_progress WHERE user_id = ?');
const grantBadgeStmt = db.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge_id, earned_at) VALUES (?, ?, ?)');

// --- Fonctions ---

/**
 * Récupère la progression d'un utilisateur sur une quête spécifique.
 * @param {string} userId
 * @param {string} questId
 * @returns {object|null} La progression de la quête ou null.
 */
function getQuestProgress(userId, questId) {
    return getQuestProgressStmt.get(userId, questId) || null;
}

/**
 * Met à jour la progression d'une quête pour un utilisateur.
 * @param {string} userId
 * @param {string} questId
 * @param {number} progress
 */
function updateQuestProgress(userId, questId, progress) {
    createOrUpdateQuestProgressStmt.run(userId, questId, progress);
}

/**
 * Marque une quête comme terminée pour un utilisateur.
 * @param {string} userId
 * @param {string} questId
 */
function completeQuest(userId, questId) {
    completeQuestStmt.run(Date.now(), userId, questId);
}

/**
 * Récupère toutes les quêtes d'un utilisateur.
 * @param {string} userId
 * @returns {Array<object>} La liste des quêtes de l'utilisateur.
 */
function getAllUserQuests(userId) {
    return getAllUserQuestsStmt.all(userId);
}

/**
 * Force la complétion d'une quête pour un utilisateur.
 * @param {string} userId
 * @param {string} questId
 */
function forceCompleteQuest(userId, questId) {
    try {
        // S'assurer que la quête existe pour l'utilisateur, sinon la créer avant de la compléter
        const existingProgress = getQuestProgress(userId, questId);
        if (!existingProgress) {
            updateQuestProgress(userId, questId, 0); // Crée une entrée si elle n'existe pas
        }
        forceCompleteQuestStmt.run(Date.now(), userId, questId);
    } catch (error) {
        console.error(`Erreur lors de la complétion forcée de la quête ${questId} pour ${userId}:`, error);
    }
}

/**
 * Accorde un badge à un utilisateur.
 * @param {string} userId
 * @param {string} badgeId
 */
function grantBadge(userId, badgeId) {
    try {
        grantBadgeStmt.run(userId, badgeId, Date.now());
    } catch (error) {
        console.error(`Erreur lors de l'attribution du badge ${badgeId} à ${userId}:`, error);
    }
}

module.exports = {
    getQuestProgress,
    updateQuestProgress,
    completeQuest,
    getAllUserQuests,
    forceCompleteQuest,
    grantBadge,
};
