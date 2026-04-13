const { Events, AuditLogEvent } = require('discord.js');
const { findAuditLogEntry } = require('./utils');
const CONFIG = require('../../config.js');
const dbManager = require('../../modules/database.js');
const { msToReadableTime, getModeratorTitleWithArticle } = require('../../utils/helpers.js');

module.exports = (client, logger) => {
    // 1. Mises à jour de membre (Serveur)
    client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
        try {
            // Changement de pseudo
            if (oldMember.nickname !== newMember.nickname) {
                await logger.log(
                    newMember.guild,
                    '📝 Membre : Changement de pseudo',
                    `<@${newMember.id}> a changé de pseudo.`,
                    '#3498db',
                    [
                        { name: 'Avant', value: oldMember.nickname || oldMember.user.username, inline: true },
                        { name: 'Après', value: newMember.nickname || newMember.user.username, inline: true }
                    ],
                    newMember.user
                );
            }

            // Rôles
            const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
            const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

            if (addedRoles.size > 0) {
                await logger.log(
                    newMember.guild,
                    '➕ Membre : Rôle ajouté',
                    `<@${newMember.id}> a reçu des rôles.`,
                    '#2ecc71',
                    [{ name: 'Rôles ajoutés', value: addedRoles.map(r => r.name).join(', ') }],
                    newMember.user
                );
            }

            if (removedRoles.size > 0) {
                await logger.log(
                    newMember.guild,
                    '➖ Membre : Rôle retiré',
                    `<@${newMember.id}> a perdu des rôles.`,
                    '#e74c3c',
                    [{ name: 'Rôles retirés', value: removedRoles.map(r => r.name).join(', ') }],
                    newMember.user
                );
            }

            // Timeout (Exclusion temporaire)
            if (!oldMember.isCommunicationDisabled() && newMember.isCommunicationDisabled()) {
                const executor = await findAuditLogEntry(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);

                // Ignorer si c'est le bot qui a mis le timeout (déjà loggé par la commande /mute ou /warn)
                if (executor && executor.id === client.user.id) return;

                // Si c'est un humain, on log comme une commande /mute
                if (executor) {
                    const duration = newMember.communicationDisabledUntilTimestamp - Date.now();
                    const durationText = msToReadableTime(duration);

                    // Essayer de récupérer la raison via l'audit log
                    // Note: AuditLogEvent.MemberUpdate ne donne pas toujours la raison facilement si c'est mélangé
                    // Mais on peut essayer de fetch l'entry spécifique
                    let reason = "Aucune raison spécifiée (Action manuelle)";
                    // On a déjà l'entry dans executor normalement si findAuditLogEntry retournait l'entry entière, mais il retourne juste l'executor.
                    // On va refaire un fetch rapide pour la raison si besoin, ou modifier findAuditLogEntry.
                    // Pour simplifier, on assume qu'on n'a pas la raison facilement ici sans refetch, 
                    // mais findAuditLogEntry pourrait être amélioré.
                    // Cependant, pour l'instant on va utiliser une raison par défaut ou essayer de fetch.

                    const logs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate });
                    const entry = logs.entries.first();
                    if (entry && entry.target.id === newMember.id && entry.executor.id === executor.id) {
                        if (entry.reason) reason = entry.reason;
                    }

                    const moderator = await newMember.guild.members.fetch(executor.id).catch(() => null);
                    const moderatorTitleWithArticle = moderator ? getModeratorTitleWithArticle(moderator) : 'un Modérateur';

                    const messageLog = `# ${newMember.user.tag} (${newMember.id}) a été mute pendant ${durationText} pour la raison "${reason}" par ${moderatorTitleWithArticle} <@${executor.id}>`;

                    const canalLog = newMember.guild.channels.cache.get(CONFIG.STAFF_WARN_CHANNEL_ID);
                    if (canalLog && canalLog.isTextBased()) {
                        const sentMessage = await canalLog.send(messageLog);

                        // Sauvegarder dans la DB
                        const dbSanctions = dbManager.getSanctionsDb();
                        dbSanctions.run(
                            `INSERT INTO sanctions (userId, type, reason, moderatorId, duration, date, log_message_id, log_channel_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                            [newMember.id, 'Time Out', reason, executor.id, durationText, Date.now(), sentMessage.id, sentMessage.channel.id],
                            (err) => { if (err) console.error('Erreur DB Timeout manuel:', err); }
                        );
                    }
                } else {
                    // Fallback logger classique si pas d'executor trouvé (rare)
                    await logger.log(
                        newMember.guild,
                        '🚫 Membre : Timeout',
                        `<@${newMember.id}> a été exclu temporairement (timeout).`,
                        '#e74c3c',
                        [
                            { name: 'Fin du timeout', value: `<t:${Math.floor(newMember.communicationDisabledUntilTimestamp / 1000)}:R>` }
                        ],
                        newMember.user
                    );
                }

            } else if (oldMember.isCommunicationDisabled() && !newMember.isCommunicationDisabled()) {
                const executor = await findAuditLogEntry(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);

                // Ignorer si c'est le bot qui a retiré le timeout
                if (executor && executor.id === client.user.id) return;

                const executorText = executor ? ` par <@${executor.id}>` : '';

                await logger.log(
                    newMember.guild,
                    '✅ Membre : Fin de Timeout',
                    `<@${newMember.id}> n'est plus exclu temporairement${executorText}.`,
                    '#2ecc71',
                    [],
                    newMember.user
                );
            }

            // Boost
            if (!oldMember.premiumSince && newMember.premiumSince) {
                await logger.log(
                    newMember.guild,
                    '💎 Membre : Boost',
                    `<@${newMember.id}> a commencé à booster le serveur ! 🚀`,
                    '#f47fff',
                    [],
                    newMember.user
                );
            }

        } catch (err) {
            console.error('[ERROR] Error in GuildMemberUpdate log:', err);
        }
    });

    // 2. Arrivée
    client.on(Events.GuildMemberAdd, async (member) => {
        try {
            await logger.log(
                member.guild,
                '📥 Membre : Arrivée',
                `<@${member.id}> a rejoint le serveur.`,
                '#2ecc71',
                [
                    { name: 'Compte créé le', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                    { name: 'Membres', value: `${member.guild.memberCount}`, inline: true }
                ],
                member.user
            );
        } catch (err) {
            console.error('[ERROR] Error in GuildMemberAdd log:', err);
        }
    });

    // 3. Départ
    client.on(Events.GuildMemberRemove, async (member) => {
        try {
            // Vérifier si c'est un kick via audit log
            const kickExecutor = await findAuditLogEntry(member.guild, AuditLogEvent.MemberKick, member.id);

            // Ignorer si c'est le bot qui a kick
            if (kickExecutor && kickExecutor.id === client.user.id) return;

            if (kickExecutor) {
                // C'est un kick manuel -> Log comme une commande /kick (si elle existait) ou format similaire
                // Le user n'a pas demandé explicitement pour /kick mais pour /ban et /to.
                // Mais "les sanctions qui ne passent pas par le bot" inclut le kick.
                // On va utiliser un format similaire.

                let reason = "Aucune raison spécifiée (Action manuelle)";
                const logs = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick });
                const entry = logs.entries.first();
                if (entry && entry.target.id === member.id && entry.executor.id === kickExecutor.id) {
                    if (entry.reason) reason = entry.reason;
                }

                const moderator = await member.guild.members.fetch(kickExecutor.id).catch(() => null);
                const moderatorTitleWithArticle = moderator ? getModeratorTitleWithArticle(moderator) : 'un Modérateur';

                // Format custom pour Kick
                const messageLog = `# ${member.user.tag} (${member.id}) a été expulsé (kick) pour la raison : "${reason}" par ${moderatorTitleWithArticle} <@${kickExecutor.id}>`;

                const canalLog = member.guild.channels.cache.get(CONFIG.STAFF_WARN_CHANNEL_ID);
                if (canalLog && canalLog.isTextBased()) {
                    const sentMessage = await canalLog.send(messageLog);

                    // Sauvegarder dans la DB (Type: Kick)
                    const dbSanctions = dbManager.getSanctionsDb();
                    dbSanctions.run(
                        `INSERT INTO sanctions (userId, type, reason, moderatorId, date, log_message_id, log_channel_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [member.id, 'Kick', reason, kickExecutor.id, Date.now(), sentMessage.id, sentMessage.channel.id],
                        (err) => { if (err) console.error('Erreur DB Kick manuel:', err); }
                    );
                }

            } else {
                await logger.log(
                    member.guild,
                    '📤 Membre : Départ',
                    `<@${member.id}> a quitté le serveur.`,
                    '#e74c3c',
                    [{ name: 'Membres', value: `${member.guild.memberCount}`, inline: true }],
                    member.user
                );
            }
        } catch (err) {
            console.error('[ERROR] Error in GuildMemberRemove log:', err);
        }
    });

    // 4. Mises à jour utilisateur (Global - Username, Avatar)
    client.on(Events.UserUpdate, async (oldUser, newUser) => {
        try {
            for (const guild of client.guilds.cache.values()) {
                if (guild.members.cache.has(newUser.id)) {
                    // Changement de username
                    if (oldUser.username !== newUser.username) {
                        await logger.log(
                            guild,
                            '👤 Utilisateur : Changement de pseudo',
                            `<@${newUser.id}> a changé son nom d'utilisateur.`,
                            '#3498db',
                            [
                                { name: 'Avant', value: oldUser.username, inline: true },
                                { name: 'Après', value: newUser.username, inline: true }
                            ],
                            newUser
                        );
                    }

                    // Changement d'avatar
                    if (oldUser.avatar !== newUser.avatar) {
                        await logger.log(
                            guild,
                            '🖼️ Utilisateur : Nouvel avatar',
                            `<@${newUser.id}> a changé sa photo de profil.`,
                            '#3498db',
                            [],
                            newUser
                        );
                    }
                }
            }
        } catch (err) {
            console.error('[ERROR] Error in UserUpdate log:', err);
        }
    });
};
