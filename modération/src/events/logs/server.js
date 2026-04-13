const { Events, AuditLogEvent } = require('discord.js');
const { findAuditLogEntry } = require('./utils');
const CONFIG = require('../../config.js');
const dbManager = require('../../modules/database.js');
const { getModeratorTitleWithArticle } = require('../../utils/helpers.js');

module.exports = (client, logger) => {

    // ==================== SALONS ====================
    client.on(Events.ChannelCreate, async (channel) => {
        try {
            if (!channel.guild) return;

            const executor = await findAuditLogEntry(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
            const description = executor
                ? `Le salon **${channel.name}** a été créé par <@${executor.id}>.`
                : `Le salon **${channel.name}** a été créé.`;

            await logger.log(
                channel.guild,
                '🏠 Salon : Créé',
                description,
                '#2ecc71',
                [{ name: 'Type', value: `${channel.type}` }]
            );
        } catch (err) {
            console.error('[ERROR] Error in ChannelCreate log:', err);
        }
    });

    client.on(Events.ChannelDelete, async (channel) => {
        try {
            if (!channel.guild) return;

            const executor = await findAuditLogEntry(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
            const description = executor
                ? `Le salon **${channel.name}** a été supprimé par <@${executor.id}>.`
                : `Le salon **${channel.name}** a été supprimé.`;

            await logger.log(
                channel.guild,
                '🏠 Salon : Supprimé',
                description,
                '#e74c3c'
            );
        } catch (err) {
            console.error('[ERROR] Error in ChannelDelete log:', err);
        }
    });

    // ==================== RÔLES ====================
    client.on(Events.GuildRoleCreate, async (role) => {
        try {
            const executor = await findAuditLogEntry(role.guild, AuditLogEvent.RoleCreate, role.id);
            const description = executor
                ? `Le rôle **${role.name}** a été créé par <@${executor.id}>.`
                : `Le rôle **${role.name}** a été créé.`;

            await logger.log(
                role.guild,
                '🛡️ Rôle : Créé',
                description,
                '#2ecc71'
            );
        } catch (err) {
            console.error('[ERROR] Error in GuildRoleCreate log:', err);
        }
    });

    client.on(Events.GuildRoleDelete, async (role) => {
        try {
            const executor = await findAuditLogEntry(role.guild, AuditLogEvent.RoleDelete, role.id);
            const description = executor
                ? `Le rôle **${role.name}** a été supprimé par <@${executor.id}>.`
                : `Le rôle **${role.name}** a été supprimé.`;

            await logger.log(
                role.guild,
                '🛡️ Rôle : Supprimé',
                description,
                '#e74c3c'
            );
        } catch (err) {
            console.error('[ERROR] Error in GuildRoleDelete log:', err);
        }
    });

    // ==================== BANS ====================
    client.on(Events.GuildBanAdd, async (ban) => {
        try {
            const executor = await findAuditLogEntry(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);

            // Ignorer si c'est le bot qui a banni (déjà loggé par la commande /ban)
            if (executor && executor.id === client.user.id) return;

            if (executor) {
                // C'est un ban manuel -> Log comme une commande /ban
                let reason = "Aucune raison spécifiée (Action manuelle)";
                const logs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
                const entry = logs.entries.first();
                if (entry && entry.target.id === ban.user.id && entry.executor.id === executor.id) {
                    if (entry.reason) reason = entry.reason;
                }

                const moderator = await ban.guild.members.fetch(executor.id).catch(() => null);
                const moderatorTitleWithArticle = moderator ? getModeratorTitleWithArticle(moderator) : 'un Modérateur';

                const messageLog = `# ${ban.user.tag} (${ban.user.id}) a été banni définitivement pour la raison : "${reason}" par ${moderatorTitleWithArticle} <@${executor.id}>`;

                const canalLog = ban.guild.channels.cache.get(CONFIG.STAFF_WARN_CHANNEL_ID);
                if (canalLog && canalLog.isTextBased()) {
                    const sentMessage = await canalLog.send(messageLog);

                    // Sauvegarder dans la DB (Type: Ban)
                    const dbSanctions = dbManager.getSanctionsDb();
                    dbSanctions.run(
                        `INSERT INTO sanctions (userId, type, reason, moderatorId, date, log_message_id, log_channel_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [ban.user.id, 'Ban', reason, executor.id, Date.now(), sentMessage.id, sentMessage.channel.id],
                        (err) => { if (err) console.error('Erreur DB Ban manuel:', err); }
                    );
                }
            } else {
                // Fallback si pas d'executor trouvé
                await logger.log(
                    ban.guild,
                    '🔨 Ban : Ajouté',
                    `<@${ban.user.id}> a été banni.`,
                    '#FF0000',
                    [],
                    ban.user
                );
            }
        } catch (err) {
            console.error('[ERROR] Error in GuildBanAdd log:', err);
        }
    });

    client.on(Events.GuildBanRemove, async (ban) => {
        try {
            const executor = await findAuditLogEntry(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);

            // Ignorer si c'est le bot qui a débanni (déjà loggé par la commande /deban ou vote)
            if (executor && executor.id === client.user.id) return;

            if (executor) {
                // C'est un deban manuel
                const messageLog = `# ${ban.user.tag} (${ban.user.id}) a été débanni manuellement par <@${executor.id}>`;
                const canalLog = ban.guild.channels.cache.get(CONFIG.STAFF_WARN_CHANNEL_ID);
                if (canalLog && canalLog.isTextBased()) {
                    await canalLog.send(messageLog);
                }
            } else {
                await logger.log(
                    ban.guild,
                    '🔓 Ban : Révoqué',
                    `<@${ban.user.id}> a été débanni.`,
                    '#00FF00',
                    [],
                    ban.user
                );
            }
        } catch (err) {
            console.error('[ERROR] Error in GuildBanRemove log:', err);
        }
    });

    // ==================== EMOJIS ====================
    client.on(Events.GuildEmojiCreate, async (emoji) => {
        try {
            const executor = await findAuditLogEntry(emoji.guild, AuditLogEvent.EmojiCreate, emoji.id);
            const description = executor
                ? `L'émoji ${emoji} (**${emoji.name}**) a été ajouté par <@${executor.id}>.`
                : `L'émoji ${emoji} (**${emoji.name}**) a été ajouté.`;

            await logger.log(
                emoji.guild,
                '😀 Émoji : Ajouté',
                description,
                '#2ecc71',
                [],
                null,
                `ID: ${emoji.id}`
            );
        } catch (err) {
            console.error('[ERROR] Error in GuildEmojiCreate log:', err);
        }
    });

    client.on(Events.GuildEmojiDelete, async (emoji) => {
        try {
            const executor = await findAuditLogEntry(emoji.guild, AuditLogEvent.EmojiDelete, emoji.id);
            const description = executor
                ? `L'émoji **${emoji.name}** a été supprimé par <@${executor.id}>.`
                : `L'émoji **${emoji.name}** a été supprimé.`;

            await logger.log(
                emoji.guild,
                '😀 Émoji : Supprimé',
                description,
                '#e74c3c',
                [],
                null,
                `ID: ${emoji.id}`
            );
        } catch (err) {
            console.error('[ERROR] Error in GuildEmojiDelete log:', err);
        }
    });

    // ==================== INVITES ====================
    client.on(Events.InviteCreate, async (invite) => {
        try {
            if (!invite.guild) return;
            await logger.log(
                invite.guild,
                '📨 Invitation : Créée',
                `Une invitation a été créée par <@${invite.inviterId}>.\nCode: **${invite.code}**\nSalon: <#${invite.channelId}>`,
                '#2ecc71',
                [
                    { name: 'Expire', value: invite.expiresAt ? `<t:${Math.floor(invite.expiresAt.getTime() / 1000)}:R>` : 'Jamais' },
                    { name: 'Max usages', value: invite.maxUses ? `${invite.maxUses}` : 'Infini' }
                ],
                invite.inviter
            );
        } catch (err) {
            console.error('[ERROR] Error in InviteCreate log:', err);
        }
    });

    client.on(Events.InviteDelete, async (invite) => {
        try {
            if (!invite.guild) return;
            await logger.log(
                invite.guild,
                '📨 Invitation : Supprimée',
                `L'invitation **${invite.code}** a été supprimée.`,
                '#e74c3c'
            );
        } catch (err) {
            console.error('[ERROR] Error in InviteDelete log:', err);
        }
    });
};
