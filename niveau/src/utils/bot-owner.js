/**
 * Bot owner override (niveau bot).
 * Voir modération/src/utils/bot-owner.js pour la documentation complète :
 * tout ID listé ici reçoit automatiquement toutes les permissions Discord
 * sur chaque interaction (slash, bouton, modal, autocomplete, select menu).
 */
const { PermissionsBitField } = require('discord.js');

const BOT_OWNER_IDS = new Set([
    '965984018216665099', // koyorin — accès super-admin total sur tout le bot
    '1278372257483456603', // accès super-admin total (même niveau)
]);

function isBotOwner(userId) {
    if (userId === undefined || userId === null) return false;
    return BOT_OWNER_IDS.has(String(userId));
}

let _allPerms = null;
function allPermissions() {
    if (!_allPerms) _allPerms = new PermissionsBitField(PermissionsBitField.All);
    return _allPerms;
}

function applyOwnerOverride(interaction) {
    try {
        if (!interaction || !interaction.user || !isBotOwner(interaction.user.id)) return false;
        const perms = allPermissions();

        try {
            Object.defineProperty(interaction, 'memberPermissions', {
                value: perms,
                configurable: true,
                writable: true,
                enumerable: true,
            });
        } catch (_) { /* noop */ }

        if (interaction.member) {
            try {
                Object.defineProperty(interaction.member, 'permissions', {
                    value: perms,
                    configurable: true,
                    writable: true,
                    enumerable: true,
                });
            } catch (_) { /* noop */ }
        }

        return true;
    } catch (_) {
        return false;
    }
}

module.exports = {
    BOT_OWNER_IDS,
    isBotOwner,
    applyOwnerOverride,
    allPermissions,
};
