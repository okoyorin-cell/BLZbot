const path = require('path');
const { isBlzTestGuild } = require(path.join(__dirname, '..', '..', '..', 'blzbot-env.js'));
const CONFIG = require('../config.js');

/** Salon logs « tout » sur le serveur de test (défaut demandé par le staff). */
const DEFAULT_TEST_ALL_LOG = '1493282572925669498';

/**
 * @param {string | null | undefined} guildId
 * @returns {string | null}
 */
function resolveAllLogChannelId(guildId) {
    if (!guildId) return CONFIG.ALL_LOG_CHANNEL_ID;
    if (isBlzTestGuild(guildId)) {
        const t = String(process.env.TEST_ALL_LOG_CHANNEL_ID || '').trim();
        return /^\d{17,22}$/.test(t) ? t : DEFAULT_TEST_ALL_LOG;
    }
    return CONFIG.ALL_LOG_CHANNEL_ID;
}

/**
 * Logs sanctions / warn (souvent le même salon que les logs généraux sur le test).
 * @param {string | null | undefined} guildId
 */
function resolveModerationSanctionLogChannelId(guildId) {
    if (!guildId) return CONFIG.LOGS_CHANNEL_ID;
    if (isBlzTestGuild(guildId)) {
        const t = String(process.env.TEST_MOD_LOG_CHANNEL_ID || process.env.TEST_ALL_LOG_CHANNEL_ID || '').trim();
        if (/^\d{17,22}$/.test(t)) return t;
        return DEFAULT_TEST_ALL_LOG;
    }
    return CONFIG.LOGS_CHANNEL_ID;
}

/**
 * @param {string} channelId
 * @param {string | null | undefined} guildId
 */
function isProtectedLogChannel(channelId, guildId) {
    const all = resolveAllLogChannelId(guildId);
    return all && String(channelId) === String(all);
}

module.exports = {
    resolveAllLogChannelId,
    resolveModerationSanctionLogChannelId,
    isProtectedLogChannel,
    DEFAULT_TEST_ALL_LOG,
};
