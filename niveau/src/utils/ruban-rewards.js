const { getEventState: getNoelState, canClaimRubans, setRubanCooldown, grantRubans } = require('./db-noel');
const logger = require('./logger');

// Montants de rubans pour chaque action
const RUBAN_REWARDS = {
    message: 25,
    voice: 60,        // par minute
    image: 50,
    reaction: 10,
};

/**
 * Accorde des rubans pour une action si l'événement Noël est actif et cooldown respecté
 * @param {string} userId - ID de l'utilisateur
 * @param {string} type - Type d'action (message, voice, image, reaction)
 * @returns {Object|null} L'utilisateur mis à jour ou null si échoué
 */
function grantRubanForAction(userId, type) {
    if (!getNoelState('noël')) {
        return null;
    }

    if (!RUBAN_REWARDS[type]) {
        logger.warn(`Type de récompense ruban invalide: ${type}`);
        return null;
    }

    if (!canClaimRubans(userId, type)) {
        return null; // Cooldown actif
    }

    try {
        setRubanCooldown(userId, type);
        const amount = RUBAN_REWARDS[type];
        const result = grantRubans(userId, amount);
        return result;
    } catch (error) {
        logger.error(`Erreur lors de l'octroi de rubans pour ${userId} (${type}):`, error);
        return null;
    }
}

/**
 * Accorde des rubans pour une durée en vocale (par minute)
 * @param {string} userId - ID de l'utilisateur
 * @param {number} durationMs - Durée en millisecondes
 * @returns {Object|null} L'utilisateur mis à jour ou null si échoué
 */
function grantRubansForVoice(userId, durationMs) {
    if (!getNoelState('noël')) {
        return null;
    }

    try {
        const minutes = Math.floor(durationMs / 60000);
        if (minutes <= 0) return null;

        // Pour 60s (1 minute), accorder 60 rubans
        const amount = minutes * RUBAN_REWARDS.voice;
        const result = grantRubans(userId, amount);
        logger.debug(`Granted ${amount} rubans to ${userId} for ${minutes} minute(s) in voice`);
        return result;
    } catch (error) {
        logger.error(`Erreur lors de l'octroi de rubans vocaux pour ${userId}:`, error);
        return null;
    }
}

module.exports = {
    grantRubanForAction,
    grantRubansForVoice,
    RUBAN_REWARDS,
};
