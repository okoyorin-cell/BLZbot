const { Events, AuditLogEvent } = require('discord.js');
const { findAuditLogEntry } = require('./utils');

module.exports = (client, logger) => {
    // 1. Mise à jour des intégrations (Bots, Applications)
    client.on(Events.GuildIntegrationsUpdate, async (guild) => {
        try {
            const executor = await findAuditLogEntry(guild, AuditLogEvent.IntegrationCreate, null); // Difficile de cibler l'ID exact
            const description = executor
                ? `Les intégrations du serveur ont été mises à jour par <@${executor.id}>.`
                : `Les intégrations du serveur ont été mises à jour.`;

            await logger.log(
                guild,
                '🤖 Intégrations : Mise à jour',
                description,
                '#3498db'
            );
        } catch (err) {
            console.error('[ERROR] Error in GuildIntegrationsUpdate log:', err);
        }
    });

    // 2. Mise à jour de Webhook
    client.on(Events.WebhooksUpdate, async (channel) => {
        try {
            const guild = channel.guild;
            const executor = await findAuditLogEntry(guild, AuditLogEvent.WebhookCreate, null); // Ou WebhookUpdate/Delete

            await logger.log(
                guild,
                '🔗 Webhook : Mise à jour',
                `Un webhook a été créé, modifié ou supprimé dans le salon ${channel}.`,
                '#9b59b6',
                [
                    { name: 'Salon', value: channel.name }
                ]
            );
        } catch (err) {
            console.error('[ERROR] Error in WebhooksUpdate log:', err);
        }
    });
};
