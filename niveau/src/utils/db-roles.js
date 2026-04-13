
const db = require('../database/database');
const logger = require('./logger');

// --- Requêtes Préparées ---
const createCustomRoleStmt = db.prepare('INSERT INTO custom_roles (role_id, guild_id, owner_id, members) VALUES (?, ?, ?, ?)');
const getCustomRoleByOwnerStmt = db.prepare('SELECT * FROM custom_roles WHERE owner_id = ?');
const getCustomRoleByRoleStmt = db.prepare('SELECT * FROM custom_roles WHERE role_id = ?');
const updateCustomRoleMembersStmt = db.prepare('UPDATE custom_roles SET members = ? WHERE role_id = ?');

/**
 * Enregistre un nouveau rôle personnalisé dans la base de données.
 * @param {string} roleId L'ID du rôle créé.
 * @param {string} guildId L'ID du serveur.
 * @param {string} ownerId L'ID du propriétaire du rôle.
 */
function createCustomRole(roleId, guildId, ownerId) {
    try {
        // Le propriétaire est le premier membre
        const members = JSON.stringify([ownerId]);
        createCustomRoleStmt.run(roleId, guildId, ownerId, members);
        logger.info(`Rôle personnalisé ${roleId} créé pour ${ownerId} dans la guilde ${guildId}.`);
    } catch (error) {
        logger.error('Erreur lors de la création du rôle personnalisé en BDD:', error);
    }
}

/**
 * Récupère les informations d'un rôle personnalisé via son propriétaire.
 * @param {string} ownerId L'ID du propriétaire.
 * @returns {object|null} Les données du rôle ou null.
 */
function getCustomRoleByOwner(ownerId) {
    return getCustomRoleByOwnerStmt.get(ownerId) || null;
}

/**
 * Récupère les informations d'un rôle personnalisé via son ID.
 * @param {string} roleId L'ID du rôle.
 * @returns {object|null} Les données du rôle ou null.
 */
function getCustomRoleByRole(roleId) {
    return getCustomRoleByRoleStmt.get(roleId) || null;
}

/**
 * Ajoute un membre à un rôle personnalisé.
 * @param {string} roleId L'ID du rôle.
 * @param {string} userId L'ID de l'utilisateur à ajouter.
 */
function addMemberToCustomRole(roleId, userId) {
    try {
        const roleData = getCustomRoleByRole(roleId);
        if (!roleData) {
            logger.error(`Tentative d'ajout de membre à un rôle personnalisé inexistant: ${roleId}`);
            return;
        }
        const members = JSON.parse(roleData.members);
        if (!members.includes(userId)) {
            members.push(userId);
            updateCustomRoleMembersStmt.run(JSON.stringify(members), roleId);
            logger.info(`Membre ${userId} ajouté au rôle personnalisé ${roleId}.`);
        }
    } catch (error) {
        logger.error(`Erreur lors de l'ajout d'un membre au rôle personnalisé ${roleId}:`, error);
    }
}

module.exports = {
    createCustomRole,
    getCustomRoleByOwner,
    getCustomRoleByRole,
    addMemberToCustomRole,
};
