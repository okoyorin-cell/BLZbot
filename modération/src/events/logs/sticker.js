const { Events, AuditLogEvent } = require('discord.js');
const { findAuditLogEntry } = require('./utils');

module.exports = (client, logger) => {
    // 1. Création de sticker
    client.on(Events.GuildStickerCreate, async (sticker) => {
        try {
            const executor = await findAuditLogEntry(sticker.guild, AuditLogEvent.StickerCreate, sticker.id);
            const description = executor
                ? `L'autocollant **${sticker.name}** a été créé par <@${executor.id}>.`
                : `L'autocollant **${sticker.name}** a été créé.`;

            await logger.log(
                sticker.guild,
                '🖼️ Sticker : Créé',
                description,
                '#2ecc71',
                [],
                null,
                `ID: ${sticker.id}`
            );
        } catch (err) {
            console.error('[ERROR] Error in GuildStickerCreate log:', err);
        }
    });

    // 2. Suppression de sticker
    client.on(Events.GuildStickerDelete, async (sticker) => {
        try {
            const executor = await findAuditLogEntry(sticker.guild, AuditLogEvent.StickerDelete, sticker.id);
            const description = executor
                ? `L'autocollant **${sticker.name}** a été supprimé par <@${executor.id}>.`
                : `L'autocollant **${sticker.name}** a été supprimé.`;

            await logger.log(
                sticker.guild,
                '🖼️ Sticker : Supprimé',
                description,
                '#e74c3c',
                [],
                null,
                `ID: ${sticker.id}`
            );
        } catch (err) {
            console.error('[ERROR] Error in GuildStickerDelete log:', err);
        }
    });

    // 3. Modification de sticker
    client.on(Events.GuildStickerUpdate, async (oldSticker, newSticker) => {
        try {
            if (oldSticker.name !== newSticker.name) {
                await logger.log(
                    newSticker.guild,
                    '🖼️ Sticker : Modifié',
                    `L'autocollant **${newSticker.name}** a été renommé.`,
                    '#3498db',
                    [
                        { name: 'Avant', value: oldSticker.name, inline: true },
                        { name: 'Après', value: newSticker.name, inline: true }
                    ],
                    null,
                    `ID: ${newSticker.id}`
                );
            }
        } catch (err) {
            console.error('[ERROR] Error in GuildStickerUpdate log:', err);
        }
    });
};
