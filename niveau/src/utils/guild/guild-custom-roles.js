const db = require('../../database/database');
const logger = require('../logger');

/**
 * Permissions disponibles pour les rôles personnalisés de guilde.
 * Les valeurs correspondent aux clés dans l'objet `permissions` des rôles.
 */
const CUSTOM_ROLE_PERMISSIONS = {
    KICK_MEMBER: 'can_kick',
    MANAGE_BLACKLIST: 'can_manage_blacklist',
    START_WAR: 'can_start_war',
    EMPTY_TREASURY: 'can_empty_treasury'
};

// --- Prepared Statements (utilise custom_roles_config + role_id) ---
const getCustomRolesStmt = db.prepare('SELECT custom_roles_config FROM guilds WHERE id = ?');
const saveCustomRolesStmt = db.prepare('UPDATE guilds SET custom_roles_config = ? WHERE id = ?');
const getMemberRoleStmt = db.prepare('SELECT role_id FROM guild_members WHERE guild_id = ? AND user_id = ?');
const setMemberRoleStmt = db.prepare('UPDATE guild_members SET role_id = ? WHERE guild_id = ? AND user_id = ?');
const clearMemberRoleStmt = db.prepare('UPDATE guild_members SET role_id = NULL WHERE guild_id = ? AND user_id = ?');
const clearRoleFromAllMembersStmt = db.prepare('UPDATE guild_members SET role_id = NULL WHERE guild_id = ? AND role_id = ?');
const countMembersWithRoleStmt = db.prepare('SELECT COUNT(*) as count FROM guild_members WHERE guild_id = ? AND role_id = ?');

/**
 * Récupère les rôles personnalisés d'une guilde.
 * Stockés dans guilds.custom_roles_config (JSON).
 * @param {number} guildId 
 * @returns {Array<{id: string, name: string, icon: string, permissions: object}>}
 */
function getCustomRoles(guildId) {
    const result = getCustomRolesStmt.get(guildId);
    if (!result || !result.custom_roles_config) return [];
    
    try {
        const roles = JSON.parse(result.custom_roles_config);
        return Array.isArray(roles) ? roles : [];
    } catch (error) {
        logger.error(`Erreur parsing custom_roles_config pour guilde ${guildId}:`, error);
        return [];
    }
}

/**
 * Sauvegarde les rôles personnalisés d'une guilde.
 */
function saveCustomRoles(guildId, roles) {
    saveCustomRolesStmt.run(JSON.stringify(roles), guildId);
}

/**
 * Ajoute ou met à jour un rôle personnalisé.
 * @param {number} guildId 
 * @param {string|null} roleId - null pour un nouveau rôle, sinon l'ID existant
 * @param {string} name - Nom du rôle
 * @param {object} permissions - { can_kick, can_manage_blacklist, can_start_war, can_empty_treasury }
 * @param {string} [icon='📋'] - Emoji du rôle
 * @returns {string} L'ID du rôle créé/modifié
 */
function addOrUpdateCustomRole(guildId, roleId, name, permissions = {}, icon = '📋') {
    const roles = getCustomRoles(guildId);
    
    const normalizedPerms = {
        can_kick: !!permissions.can_kick,
        can_manage_blacklist: !!permissions.can_manage_blacklist,
        can_start_war: !!permissions.can_start_war,
        can_empty_treasury: !!permissions.can_empty_treasury
    };

    if (roleId) {
        // Mise à jour d'un rôle existant
        const existingIndex = roles.findIndex(r => r.id === roleId);
        if (existingIndex < 0) {
            throw new Error(`Rôle avec l'ID "${roleId}" introuvable`);
        }
        roles[existingIndex].name = name;
        roles[existingIndex].permissions = normalizedPerms;
        if (icon !== '📋') roles[existingIndex].icon = icon;
        saveCustomRoles(guildId, roles);
        return roleId;
    } else {
        // Création d'un nouveau rôle
        if (roles.length >= 3) {
            throw new Error('Maximum 3 rôles personnalisés');
        }
        const newId = Date.now().toString();
        roles.push({
            id: newId,
            name: name,
            icon: icon,
            permissions: normalizedPerms
        });
        saveCustomRoles(guildId, roles);
        return newId;
    }
}

/**
 * Supprime un rôle personnalisé et retire l'assignation de tous les membres.
 * @param {number} guildId
 * @param {string} roleId
 * @returns {Array} Rôles restants
 */
function deleteCustomRole(guildId, roleId) {
    const roles = getCustomRoles(guildId);
    const filtered = roles.filter(r => r.id !== roleId);
    saveCustomRoles(guildId, filtered);
    
    // Retirer le rôle de tous les membres qui l'avaient
    clearRoleFromAllMembersStmt.run(guildId, roleId);
    
    return filtered;
}

/**
 * Assigne un rôle personnalisé à un utilisateur.
 * @param {number} guildId
 * @param {string} userId
 * @param {string} roleId
 */
function assignCustomRoleToUser(guildId, userId, roleId) {
    // Vérifier que le rôle existe
    const roles = getCustomRoles(guildId);
    const role = roles.find(r => r.id === roleId);
    if (!role) {
        throw new Error(`Rôle "${roleId}" introuvable`);
    }
    
    setMemberRoleStmt.run(roleId, guildId, userId);
}

/**
 * Retire le rôle personnalisé d'un utilisateur.
 * @param {number} guildId
 * @param {string} userId
 */
function revokeCustomRoleFromUser(guildId, userId) {
    clearMemberRoleStmt.run(guildId, userId);
}

/**
 * Récupère le rôle personnalisé d'un utilisateur.
 * @param {number} guildId
 * @param {string} userId
 * @returns {object|null} Le rôle ou null
 */
function getUserCustomRole(guildId, userId) {
    const member = getMemberRoleStmt.get(guildId, userId);
    if (!member || !member.role_id) return null;
    
    const roles = getCustomRoles(guildId);
    return roles.find(r => r.id === member.role_id) || null;
}

/**
 * Vérifie si un utilisateur a une permission via son rôle personnalisé.
 * @param {number} guildId
 * @param {string} userId
 * @param {string} permission - Clé de permission (ex: 'can_kick', 'can_start_war')
 * @returns {boolean}
 */
function hasCustomPermission(guildId, userId, permission) {
    const role = getUserCustomRole(guildId, userId);
    if (!role || !role.permissions) return false;
    return role.permissions[permission] === true;
}

/**
 * Compte le nombre de membres ayant un rôle donné.
 * @param {number} guildId
 * @param {string} roleId
 * @returns {number}
 */
function countMembersWithRole(guildId, roleId) {
    return countMembersWithRoleStmt.get(guildId, roleId).count;
}

module.exports = {
    CUSTOM_ROLE_PERMISSIONS,
    getCustomRoles,
    saveCustomRoles,
    addOrUpdateCustomRole,
    deleteCustomRole,
    assignCustomRoleToUser,
    revokeCustomRoleFromUser,
    getUserCustomRole,
    hasCustomPermission,
    countMembersWithRole
};
