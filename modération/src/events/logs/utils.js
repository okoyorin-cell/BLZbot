const { AuditLogEvent } = require('discord.js');

async function findAuditLogEntry(guild, type, targetId, timeWindow = 15000) {
    try {
        // Attendre un peu pour que l'audit log soit propagé
        await new Promise(resolve => setTimeout(resolve, 1000));

        const fetchedLogs = await guild.fetchAuditLogs({
            limit: 5,
            type: type,
        });

        const now = Date.now();
        for (const entry of fetchedLogs.entries.values()) {
            // Vérifier la cible et le timing
            const isTarget = entry.target && entry.target.id === targetId;
            const isRecent = (now - entry.createdTimestamp) < timeWindow;

            if (isTarget && isRecent) {
                return entry.executor;
            }
        }
    } catch (e) {
        console.error(`Erreur fetchAuditLogs (${type}):`, e);
    }
    return null;
}

module.exports = { findAuditLogEntry };
