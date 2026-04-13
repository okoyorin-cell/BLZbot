const db = require('../database/database');
const { getRankFromPoints, updateUserRank } = require('./ranks');
const logger = require('../utils/logger');

// Seuil de points pour être éligible au decay
const DECAY_MINIMUM_POINTS = 3000;

// Préparer les requêtes
const getDecayCandidatesStmt = db.prepare('SELECT id, points, last_activity_timestamp FROM users WHERE points >= ?');

/**
 * Détermine le seuil d'inactivité en heures pour un rang donné.
 * @param {object} rank L'objet de rang.
 * @returns {number} Le nombre d'heures d'inactivité avant decay.
 */
function getInactivityThresholdHours(rank) {
    // Les rangs de Or I à Diamant II ont 4h, les autres (supérieurs) ont 3h
    if (rank.points >= 3000 && rank.points < 12500) { // Or I à Diamant II
        return 4;
    }
    return 3; // Diamant III et plus
}

/**
 * Traite la perte de points pour tous les utilisateurs inactifs.
 * @param {import('discord.js').Client} client Le client Discord.
 */
function processDecay(client) {
    logger.info('Vérification de la perte de points (decay) par inactivité...');

    const candidates = getDecayCandidatesStmt.all(DECAY_MINIMUM_POINTS);
    const now = Date.now();
    const { burnPlayerRP } = require('./ranked-shares');

    for (const user of candidates) {
        const rank = getRankFromPoints(user.points);

        // Si le rang n'a pas de valeur de decay, on l'ignore
        if (!rank || !rank.decay) {
            continue;
        }

        const inactivityThresholdHours = getInactivityThresholdHours(rank);
        const inactivityThresholdMs = inactivityThresholdHours * 60 * 60 * 1000;

        const timeSinceLastActivity = now - (user.last_activity_timestamp || now); // Utiliser now si le timestamp est null

        if (timeSinceLastActivity >= inactivityThresholdMs) {
            burnPlayerRP(user.id, rank.decay);

            logger.info(`L'utilisateur ${user.id} a perdu ${rank.decay} RP (Shares Burn) pour inactivité.`);

            // Mettre à jour le rôle si le rang a changé
            updateUserRank(client, user.id);
        }
    }
}

module.exports = { processDecay };