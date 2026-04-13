const db = require('../database/database');
const logger = require('./logger');

/**
 * Valide si un message contient un nombre valide pour le comptage
 * @param {string} content - Le contenu du message
 * @returns {boolean} True si valide, false sinon
 */
function isValidCountingNumber(content) {
    // Vérifier s'il y a des retours à la ligne ou des caractères non numériques
    if (content.includes('\n')) {
        return false;
    }

    // Vérifier que le contenu ne contient que des chiffres
    if (!/^\d+$/.test(content.trim())) {
        return false;
    }

    return true;
}

/**
 * Récupère le dernier nombre valide du historique de comptage
 * @param {Array} messages - Les messages à analyser
 * @returns {number|null} Le dernier nombre valide ou null
 */
function getLastValidNumber(messages) {
    let maxNum = null;
    for (const message of messages) {
        if (isValidCountingNumber(message.content)) {
            const num = parseInt(message.content.trim());
            if (!isNaN(num)) {
                if (maxNum === null || num > maxNum) {
                    maxNum = num;
                }
            }
        }
    }
    return maxNum;
}

/**
 * Valide si un nombre est correct selon la séquence
 * @param {number} newNumber - Le nouveau nombre envoyé
 * @param {number|null} expectedNumber - Le nombre attendu
 * @returns {boolean} True si le nombre est correct
 */
function isCorrectSequence(newNumber, expectedNumber) {
    if (expectedNumber === null) {
        // Pas de nombre précédent valide, le premier nombre doit être 1
        return newNumber === 1;
    }
    return newNumber === expectedNumber + 1;
}

/**
 * Récupère la dernière séquence valide depuis les 100 derniers messages
 * Valide la chaîne complète et identifie les nombres faux et les utilisateurs à pénaliser
 * Reprend à partir du dernier nombre valide, pas à zéro
 * @param {Channel} channel - Le salon de comptage
 * @returns {Promise<{lastNumber: number, invalidMessages: Array, usersToRemovePC: Object}>}
 */
async function getLastValidSequence(channel) {
    try {
        // Récupère les 100 derniers messages
        const messages = await channel.messages.fetch({ limit: 100 });
        const sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        const messagesArray = Array.from(sortedMessages.values());

        let expectedNumber = null;
        let lastValidNumber = null;
        let lastValidMessageIndex = -1;
        const invalidMessages = [];
        const usersToRemovePC = {}; // { userId: countOfInvalidMessages }

        logger.info('[COUNTING] Analyse des 100 derniers messages...');

        // Traite chaque message
        for (let i = 0; i < messagesArray.length; i++) {
            const message = messagesArray[i];

            if (isValidCountingNumber(message.content)) {
                const num = parseInt(message.content.trim());
                if (!isNaN(num)) {
                    // Si c'est le tout premier nombre qu'on rencontre, on l'accepte comme point de départ
                    if (expectedNumber === null) {
                        lastValidNumber = num;
                        lastValidMessageIndex = i;
                        expectedNumber = num + 1;
                    }
                    else if (num === expectedNumber) {
                        // ✅ Nombre correct - continue la chaîne
                        lastValidNumber = num;
                        lastValidMessageIndex = i;
                        expectedNumber = num + 1;
                    } else {
                        // ❌ Nombre faux - une erreur est détectée
                        logger.info(`[COUNTING] Erreur détectée à index ${i}: attendu ${expectedNumber}, reçu ${num}`);

                        // Pénaliser UNIQUEMENT ce message faux et tous les messages APRÈS jusqu'à la prochaine bonne séquence
                        invalidMessages.push({
                            index: i,
                            userId: message.author.id,
                            number: num,
                            reason: 'incorrect_number'
                        });
                        usersToRemovePC[message.author.id] = (usersToRemovePC[message.author.id] || 0) + 1;

                        // Chercher la prochaine chaîne valide qui commence après ce nombre faux
                        let j = i + 1;
                        let tempExpected = expectedNumber; // Continuer à partir du nombre attendu

                        while (j < messagesArray.length) {
                            const nextMessage = messagesArray[j];

                            if (isValidCountingNumber(nextMessage.content)) {
                                const nextNum = parseInt(nextMessage.content.trim());

                                if (!isNaN(nextNum)) {
                                    if (nextNum === tempExpected) {
                                        // ✅ Trouvé un nombre correct! Reprendre à partir d'ici
                                        logger.info(`[COUNTING] Chaîne réparée au nombre ${nextNum}`);
                                        expectedNumber = nextNum + 1;
                                        lastValidNumber = nextNum;
                                        lastValidMessageIndex = j;
                                        i = j - 1; // -1 car la boucle va incrémenter
                                        break;
                                    } else {
                                        // Nombre faux aussi
                                        logger.info(`[COUNTING] Nombre faux ignoré à index ${j}: ${nextNum}`);
                                        invalidMessages.push({
                                            index: j,
                                            userId: nextMessage.author.id,
                                            number: nextNum,
                                            reason: 'part_of_error_chain'
                                        });
                                        usersToRemovePC[nextMessage.author.id] = (usersToRemovePC[nextMessage.author.id] || 0) + 1;
                                        tempExpected = expectedNumber; // Continuer à chercher le même nombre
                                        j++;
                                    }
                                } else {
                                    j++;
                                }
                            } else {
                                // Message avec format invalide
                                logger.info(`[COUNTING] Format invalide à index ${j}`);
                                invalidMessages.push({
                                    index: j,
                                    userId: nextMessage.author.id,
                                    content: nextMessage.content,
                                    reason: 'invalid_format'
                                });
                                usersToRemovePC[nextMessage.author.id] = (usersToRemovePC[nextMessage.author.id] || 0) + 1;
                                j++;
                            }
                        }
                    }
                }
            } else {
                // ❌ Message format invalide
                logger.info(`[COUNTING] Format invalide détecté à index ${i}: "${message.content}"`);

                invalidMessages.push({
                    index: i,
                    userId: message.author.id,
                    content: message.content,
                    reason: 'invalid_format'
                });
                usersToRemovePC[message.author.id] = (usersToRemovePC[message.author.id] || 0) + 1;

                // Chercher la prochaine chaîne valide
                let j = i + 1;
                let tempExpected = expectedNumber;

                while (j < messagesArray.length) {
                    const nextMessage = messagesArray[j];

                    if (isValidCountingNumber(nextMessage.content)) {
                        const nextNum = parseInt(nextMessage.content.trim());

                        if (!isNaN(nextNum)) {
                            if (nextNum === tempExpected) {
                                // ✅ Trouvé un nombre correct! Reprendre à partir d'ici
                                logger.info(`[COUNTING] Chaîne réparée au nombre ${nextNum}`);
                                expectedNumber = nextNum + 1;
                                lastValidNumber = nextNum;
                                lastValidMessageIndex = j;
                                i = j - 1;
                                break;
                            } else {
                                // Nombre faux aussi
                                invalidMessages.push({
                                    index: j,
                                    userId: nextMessage.author.id,
                                    number: nextNum,
                                    reason: 'part_of_error_chain'
                                });
                                usersToRemovePC[nextMessage.author.id] = (usersToRemovePC[nextMessage.author.id] || 0) + 1;
                                tempExpected = expectedNumber;
                                j++;
                            }
                        } else {
                            j++;
                        }
                    } else {
                        // Format invalide aussi
                        invalidMessages.push({
                            index: j,
                            userId: nextMessage.author.id,
                            content: nextMessage.content,
                            reason: 'invalid_format'
                        });
                        usersToRemovePC[nextMessage.author.id] = (usersToRemovePC[nextMessage.author.id] || 0) + 1;
                        j++;
                    }
                }
            }
        }

        logger.info(`[COUNTING] Séquence restaurée: dernier nombre = ${lastValidNumber || 0}, messages faux = ${invalidMessages.length}`);

        return {
            lastNumber: lastValidNumber,
            invalidMessages: invalidMessages,
            usersToRemovePC: usersToRemovePC,
            lastValidMessageIndex: lastValidMessageIndex
        };
    } catch (error) {
        logger.error('[COUNTING] Erreur lors de la récupération de la dernière séquence valide:', error);
        return {
            lastNumber: null,
            invalidMessages: [],
            usersToRemovePC: {},
            lastValidMessageIndex: -1
        };
    }
}

/**
 * Ajoute des points de comptage à un utilisateur
 * Applique le boost x2 si actif
 * @param {string} userId - L'ID de l'utilisateur
 * @param {number} amount - Le nombre de PC à ajouter
 * @returns {object} L'utilisateur mis à jour
 */
function grantCountingPoints(userId, amount = 1) {
    // Vérifier si le boost comptage x2 est actif
    const userStmt = db.prepare('SELECT counting_boost_until FROM users WHERE id = ?');
    const user = userStmt.get(userId);
    const now = Date.now();

    let finalAmount = amount;
    if (user && user.counting_boost_until && user.counting_boost_until > now) {
        finalAmount = amount * 2; // Boost x2 actif
        logger.info(`[COUNTING] Boost x2 actif pour ${userId}, ${amount} -> ${finalAmount} PC`);
    }

    const stmt = db.prepare('UPDATE users SET points_comptage = points_comptage + ? WHERE id = ?');
    stmt.run(finalAmount, userId);

    const getUserStmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return getUserStmt.get(userId);
}

/**
 * Retire des points de comptage à un utilisateur
 * @param {string} userId - L'ID de l'utilisateur
 * @param {number} amount - Le nombre de PC à retirer
 * @returns {object} L'utilisateur mis à jour
 */
function removeCountingPoints(userId, amount = 1) {
    const getUserStmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const user = getUserStmt.get(userId);

    if (user && user.points_comptage > 0) {
        const toRemove = Math.min(amount, user.points_comptage);
        const stmt = db.prepare('UPDATE users SET points_comptage = points_comptage - ? WHERE id = ?');
        stmt.run(toRemove, userId);

        const updatedUser = getUserStmt.get(userId);
        logger.info(`[COUNTING] ${toRemove} PC retirés à l'utilisateur ${userId}. Nouveau total: ${updatedUser.points_comptage}`);
        return updatedUser;
    }

    return user;
}

module.exports = {
    isValidCountingNumber,
    getLastValidNumber,
    isCorrectSequence,
    getLastValidSequence,
    grantCountingPoints,
    removeCountingPoints
};
