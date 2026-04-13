const { pendingActions } = require('./tools.js');
const fs = require('fs');
const path = require('path');
const { PermissionsBitField, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, UserSelectMenuBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder } = require('discord.js');
const dbManager = require('../../modération/src/modules/database');
const CONFIG = require('../../modération/src/config');
const { getModeratorTitleWithArticle, msToReadableTime } = require('../../modération/src/utils/helpers');

// Helper for permission checks in actions
async function checkActionPermission(interaction, permission) {
    if (!interaction.member.permissions.has(permission)) {
        const content = `⛔ Permission manquante: ${permission}`;
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content });
        } else {
            await interaction.reply({ content, flags: [64] });
        }
        return false;
    }
    return true;
}

async function checkActionHierarchy(interaction, targetId) {
    const member = interaction.member;
    const guild = interaction.guild;
    const target = await guild.members.fetch(targetId).catch(() => null);

    if (!target) return true; // Target gone, proceed (or fail later)
    if (member.id === guild.ownerId) return true;
    if (target.id === guild.ownerId) {
        const content = "⛔ Vous ne pouvez pas agir sur le propriétaire.";
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content });
        } else {
            await interaction.reply({ content, flags: [64] });
        }
        return false;
    }

    if (target.roles.highest.position >= member.roles.highest.position) {
        const content = "⛔ Vous ne pouvez pas agir sur un membre supérieur ou égal à vous.";
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content });
        } else {
            await interaction.reply({ content, flags: [64] });
        }
        return false;
    }
    return true;
}

async function handleAdminAction(interaction, client) {
    const customId = interaction.customId;

    if (customId.startsWith('ADMIN_CANCEL_')) {
        const pendingAction = pendingActions.get(customId);
        if (pendingAction) {
            if (pendingAction.userId !== interaction.user.id) {
                return interaction.reply({ content: "Seul l'auteur de la commande peut annuler.", flags: [64] });
            }

            // Update message to show cancelled status
            const embed = EmbedBuilder.from(interaction.message.embeds[0]);
            embed.setColor('#FF0000'); // Red
            embed.setTitle(`❌ Action Annulée: ${embed.data.title.replace('🛡️ Confirmation Action: ', '')}`);
            embed.setFooter({ text: `Annulé par ${interaction.user.tag}` });

            await interaction.update({ embeds: [embed], components: [] });

            pendingActions.delete(customId);
            // Also delete the confirm action
            const confirmId = customId.replace('CANCEL', 'CONFIRM');
            pendingActions.delete(confirmId);
            return;
        }
        return interaction.reply({ content: "Action expirée ou introuvable.", flags: [64] });
    }

    if (customId.startsWith('ADMIN_CONFIRM_')) {
        const action = pendingActions.get(customId);
        if (!action) {
            return interaction.reply({ content: "Action expirée ou introuvable.", flags: [64] });
        }

        if (action.userId !== interaction.user.id) {
            return interaction.reply({ content: "Seul l'auteur de la commande peut confirmer.", flags: [64] });
        }

        const { type, data } = action;
        console.log(`[AdminAction] Executing action: ${type}`, data); // Debug log

        const guild = interaction.guild;
        let resultMsg = "";

        try {
            await interaction.deferReply({ flags: [64] }); // Ephemeral reply for result

            switch (type) {
                // ... (cases remain unchanged) ...
                // I need to be careful not to replace the switch content, just the surrounding logic.
                // But replace_file_content works on contiguous blocks.
                // I will target the end of the function where the cleanup happens.
            }
            // Wait, I can't easily target the end without including the switch.
            // Let's do this in two chunks.
            // Chunk 1: The Cancel block.
            // Chunk 2: The Confirm block's cleanup at the end.


            switch (type) {
                // --- Actions Membres ---
                case 'BAN_MEMBER':
                    if (!await checkActionPermission(interaction, 'BanMembers')) return;
                    if (!await checkActionHierarchy(interaction, data.user_id)) return;

                    const banUser = await client.users.fetch(data.user_id);
                    const banReason = data.reason || 'Aucune raison spécifiée';
                    const banModerator = interaction.member;

                    // Send DM
                    try {
                        await banUser.send(
                            `Vous avez été BANNI définitivement du serveur pour la raison : "${banReason}".\n` +
                            `Si vous souhaitez vous faire debannir, vous pouvez rejoindre le serveur support : https://discord.gg/UJNZxzmmPV`
                        );
                    } catch (e) { console.warn("Impossible d'envoyer DM ban"); }

                    // Ban
                    await guild.members.ban(data.user_id, { reason: banReason, deleteMessageSeconds: data.delete_messages_seconds || 0 });

                    // DB & Log
                    const dbSanctionsBan = dbManager.getSanctionsDb();
                    dbSanctionsBan.run(
                        `INSERT INTO sanctions (userId, type, reason, moderatorId, date) VALUES (?, ?, ?, ?, ?)`,
                        [data.user_id, 'Ban', banReason, banModerator.id, Date.now()],
                        async function (err) {
                            if (err) return console.error('Erreur DB Ban:', err);
                            const sanctionId = this.lastID;

                            const canalLog = guild.channels.cache.get(CONFIG.STAFF_WARN_CHANNEL_ID);
                            if (canalLog && canalLog.isTextBased()) {
                                const moderatorTitleWithArticle = getModeratorTitleWithArticle(banModerator);
                                const messageLog = `# ${banUser.tag} (${banUser.id}) a été banni définitivement pour la raison : "${banReason}" par ${moderatorTitleWithArticle} <@${banModerator.id}>`;

                                const sentMessage = await canalLog.send({ content: messageLog });
                                if (sentMessage) {
                                    dbSanctionsBan.run('UPDATE sanctions SET log_message_id = ?, log_channel_id = ? WHERE id = ?', [sentMessage.id, sentMessage.channel.id, sanctionId]);
                                }
                            }
                        }
                    );
                    resultMsg = `✅ Membre <@${data.user_id}> banni.`;
                    break;

                case 'UNBAN_MEMBER':
                    if (!await checkActionPermission(interaction, 'BanMembers')) return;
                    await guild.members.unban(data.user_id);
                    resultMsg = `✅ Membre ${data.user_id} débanni.`;
                    break;

                case 'KICK_MEMBER':
                    if (!await checkActionPermission(interaction, 'KickMembers')) return;
                    if (!await checkActionHierarchy(interaction, data.user_id)) return;

                    const kickUser = await client.users.fetch(data.user_id);
                    const kickReason = data.reason || 'Aucune raison spécifiée';
                    const kickModerator = interaction.member;

                    try {
                        await kickUser.send(`Vous avez été expulsé du serveur pour la raison : "${kickReason}".`);
                    } catch (e) { }

                    await guild.members.kick(data.user_id, kickReason);

                    const canalLogKick = guild.channels.cache.get(CONFIG.STAFF_WARN_CHANNEL_ID);
                    if (canalLogKick && canalLogKick.isTextBased()) {
                        const moderatorTitleWithArticle = getModeratorTitleWithArticle(kickModerator);
                        await canalLogKick.send(`# ${kickUser.tag} (${kickUser.id}) a été expulsé pour la raison : "${kickReason}" par ${moderatorTitleWithArticle} <@${kickModerator.id}>`);
                    }

                    resultMsg = `✅ Membre <@${data.user_id}> expulsé.`;
                    break;

                case 'TIMEOUT_MEMBER':
                    if (!await checkActionPermission(interaction, 'ModerateMembers')) return;
                    if (!await checkActionHierarchy(interaction, data.user_id)) return;

                    const timeoutMember = await guild.members.fetch(data.user_id);
                    const timeoutReason = data.reason || 'Aucune raison';
                    const timeoutDurationMs = data.duration_seconds * 1000;
                    const timeoutModerator = interaction.member;
                    const timeoutDurationText = msToReadableTime(timeoutDurationMs);

                    // Remove admin roles if any
                    const dbTempRemovedRoles = dbManager.getTempRemovedRolesDb();
                    const adminRoles = timeoutMember.roles.cache.filter(role => role.permissions.has(PermissionsBitField.Flags.Administrator));
                    if (adminRoles.size > 0) {
                        const expires_at = Date.now() + timeoutDurationMs;
                        for (const role of adminRoles.values()) {
                            await timeoutMember.roles.remove(role, 'Retrait temporaire pour mute');
                            dbTempRemovedRoles.run('INSERT INTO temp_removed_roles (userId, roleId, expires_at) VALUES (?, ?, ?)', [timeoutMember.id, role.id, expires_at]);
                        }
                    }

                    await timeoutMember.timeout(timeoutDurationMs, timeoutReason);

                    // DB & Log
                    const dbSanctionsMute = dbManager.getSanctionsDb();
                    dbSanctionsMute.run(
                        `INSERT INTO sanctions (userId, type, reason, moderatorId, duration, date, rule_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [timeoutMember.id, 'Time Out', timeoutReason, timeoutModerator.id, timeoutDurationText, Date.now(), null],
                        async function (err) {
                            if (err) return console.error('Erreur DB Mute:', err);
                            const sanctionId = this.lastID;

                            const canalLog = guild.channels.cache.get(CONFIG.STAFF_WARN_CHANNEL_ID);
                            if (canalLog && canalLog.isTextBased()) {
                                const moderatorTitleWithArticle = getModeratorTitleWithArticle(timeoutModerator);
                                const messageLog = `# ${timeoutMember.user.tag} (${timeoutMember.id}) a été mute pendant ${timeoutDurationText} pour la raison "${timeoutReason}" par ${moderatorTitleWithArticle} <@${timeoutModerator.id}>`;

                                const sentMessage = await canalLog.send({ content: messageLog });
                                if (sentMessage) {
                                    dbSanctionsMute.run('UPDATE sanctions SET log_message_id = ?, log_channel_id = ? WHERE id = ?', [sentMessage.id, sentMessage.channel.id, sanctionId]);
                                }
                            }
                        }
                    );

                    try { await timeoutMember.send(`Vous avez été rendu muet pour la raison : "${timeoutReason}" pendant une durée de ${timeoutDurationText}.`); } catch (e) { }

                    resultMsg = `✅ Membre <@${data.user_id}> exclu temporairement (${timeoutDurationText}).`;
                    break;

                case 'REMOVE_TIMEOUT':
                    if (!await checkActionPermission(interaction, 'ModerateMembers')) return;
                    if (!await checkActionHierarchy(interaction, data.user_id)) return;

                    const untimeoutMember = await guild.members.fetch(data.user_id);
                    await untimeoutMember.timeout(null);

                    // Log unmute
                    const canalLogUnmute = guild.channels.cache.get(CONFIG.STAFF_WARN_CHANNEL_ID);
                    if (canalLogUnmute && canalLogUnmute.isTextBased()) {
                        const moderatorTitleWithArticle = getModeratorTitleWithArticle(interaction.member);
                        await canalLogUnmute.send(`# ${untimeoutMember.user.tag} (${untimeoutMember.id}) a été unmute par ${moderatorTitleWithArticle} <@${interaction.member.id}>`);
                    }

                    resultMsg = `✅ Timeout retiré pour <@${data.user_id}>.`;
                    break;

                case 'ADD_ROLE_TO_MEMBER':
                    if (!await checkActionPermission(interaction, 'ManageRoles')) return;
                    if (!await checkActionHierarchy(interaction, data.user_id)) return;
                    const memberAddRole = await guild.members.fetch(data.user_id);
                    await memberAddRole.roles.add(data.role_id, `Ajout par ${interaction.user.tag}`);
                    resultMsg = `✅ Rôle ajouté à <@${data.user_id}>.`;
                    break;

                case 'REMOVE_ROLE_FROM_MEMBER':
                    if (!await checkActionPermission(interaction, 'ManageRoles')) return;
                    if (!await checkActionHierarchy(interaction, data.user_id)) return;
                    const memberRemRole = await guild.members.fetch(data.user_id);
                    await memberRemRole.roles.remove(data.role_id, `Retrait par ${interaction.user.tag}`);
                    resultMsg = `✅ Rôle retiré de <@${data.user_id}>.`;
                    break;

                case 'SET_NICKNAME':
                    if (!await checkActionPermission(interaction, 'ManageNicknames')) return;
                    if (!await checkActionHierarchy(interaction, data.user_id)) return;
                    const memberToNick = await guild.members.fetch(data.user_id);
                    await memberToNick.setNickname(data.nickname || null);
                    resultMsg = `✅ Pseudo de <@${data.user_id}> changé.`;
                    break;

                // --- Messages ---
                case 'SEND_MESSAGE':
                    if (!await checkActionPermission(interaction, 'SendMessages')) return;
                    const channel = await guild.channels.fetch(data.channel_id);
                    const msgOptions = {};
                    if (data.content) msgOptions.content = data.content;
                    if (data.embed_json) {
                        try { msgOptions.embeds = [JSON.parse(data.embed_json)]; } catch (e) { throw new Error("JSON Embed invalide"); }
                    }
                    if (data.reply_to_message_id) {
                        msgOptions.reply = { messageReference: data.reply_to_message_id };
                    }
                    await channel.send(msgOptions);
                    resultMsg = `✅ Message envoyé dans <#${data.channel_id}>.`;
                    break;

                case 'DELETE_MESSAGE':
                    if (!await checkActionPermission(interaction, 'ManageMessages')) return;
                    const delChannel = await guild.channels.fetch(data.channel_id);
                    const msgToDelete = await delChannel.messages.fetch(data.message_id);
                    await msgToDelete.delete();
                    resultMsg = `✅ Message supprimé.`;
                    break;

                case 'PURGE_MESSAGES':
                    if (!await checkActionPermission(interaction, 'ManageMessages')) return;
                    const purgeChannel = await guild.channels.fetch(data.channel_id);
                    if (data.filter_user_id) {
                        const messages = await purgeChannel.messages.fetch({ limit: 100 });
                        const userMessages = messages.filter(m => m.author.id === data.filter_user_id).first(data.count);
                        if (userMessages.length > 0) await purgeChannel.bulkDelete(userMessages);
                    } else {
                        await purgeChannel.bulkDelete(data.amount || data.count);
                    }
                    resultMsg = `✅ ${data.amount || data.count} messages purgés.`;
                    break;

                case 'PIN_MESSAGE':
                    if (!await checkActionPermission(interaction, 'ManageMessages')) return;
                    const pinChannel = await guild.channels.fetch(data.channel_id);
                    const msgToPin = await pinChannel.messages.fetch(data.message_id);
                    await msgToPin.pin();
                    resultMsg = `✅ Message épinglé.`;
                    break;

                case 'UNPIN_MESSAGE':
                    if (!await checkActionPermission(interaction, 'ManageMessages')) return;
                    const unpinChannel = await guild.channels.fetch(data.channel_id);
                    const msgToUnpin = await unpinChannel.messages.fetch(data.message_id);
                    await msgToUnpin.unpin();
                    resultMsg = `✅ Message désépinglé.`;
                    break;

                // --- Salons ---
                case 'CREATE_CHANNEL':
                    if (!await checkActionPermission(interaction, 'ManageChannels')) return;
                    await guild.channels.create({
                        name: data.name,
                        type: data.type,
                        parent: data.parent_id,
                        topic: data.topic,
                        reason: data.auditLogReason
                    });
                    resultMsg = `✅ Salon "${data.name}" créé.`;
                    break;

                case 'DELETE_CHANNEL':
                    if (!await checkActionPermission(interaction, 'ManageChannels')) return;
                    const chanToDelete = await guild.channels.fetch(data.channel_id);
                    await chanToDelete.delete(data.auditLogReason);
                    resultMsg = `✅ Salon supprimé.`;
                    break;

                case 'UPDATE_CHANNEL_SETTINGS':
                    if (!await checkActionPermission(interaction, 'ManageChannels')) return;
                    const chanToUpdate = await guild.channels.fetch(data.channel_id);
                    await chanToUpdate.edit({
                        name: data.name,
                        topic: data.topic,
                        nsfw: data.nsfw,
                        rateLimitPerUser: data.slowmode,
                        bitrate: data.bitrate,
                        reason: data.auditLogReason
                    });
                    resultMsg = `✅ Salon mis à jour.`;
                    break;

                case 'UPDATE_CHANNEL_PERMISSIONS':
                    if (!await checkActionPermission(interaction, 'ManageChannels')) return;
                    const chanPerms = await guild.channels.fetch(data.channel_id);
                    const allow = data.allow_permissions ? BigInt(data.allow_permissions.reduce((acc, p) => acc | PermissionsBitField.Flags[p], 0n)) : 0n;
                    const deny = data.deny_permissions ? BigInt(data.deny_permissions.reduce((acc, p) => acc | PermissionsBitField.Flags[p], 0n)) : 0n;
                    await chanPerms.permissionOverwrites.edit(data.target_id, { allow, deny }, { reason: data.auditLogReason });
                    resultMsg = `✅ Permissions mises à jour.`;
                    break;

                // --- Rôles ---
                case 'CREATE_ROLE':
                    if (!await checkActionPermission(interaction, 'ManageRoles')) return;
                    await guild.roles.create({
                        name: data.name,
                        color: data.color,
                        hoist: data.hoist,
                        mentionable: data.mentionable,
                        reason: data.auditLogReason
                    });
                    resultMsg = `✅ Rôle "${data.name}" créé.`;
                    break;

                case 'DELETE_ROLE':
                    if (!await checkActionPermission(interaction, 'ManageRoles')) return;
                    const roleToDelete = await guild.roles.fetch(data.role_id);
                    await roleToDelete.delete(data.auditLogReason);
                    resultMsg = `✅ Rôle supprimé.`;
                    break;

                case 'UPDATE_ROLE':
                    if (!await checkActionPermission(interaction, 'ManageRoles')) return;
                    const roleToUpdate = await guild.roles.fetch(data.role_id);
                    await roleToUpdate.edit({
                        name: data.name,
                        color: data.color,
                        hoist: data.hoist,
                        mentionable: data.mentionable,
                        reason: data.auditLogReason
                    });
                    resultMsg = `✅ Rôle mis à jour.`;
                    break;

                // --- AutoMod ---
                case 'AUTOMOD_BLOCK_WORDS':
                    if (!await checkActionPermission(interaction, 'ManageGuild')) return;
                    await guild.autoModerationRules.create({
                        name: data.rule_name,
                        eventType: 1, // MESSAGE_SEND
                        triggerType: 1, // KEYWORD
                        triggerMetadata: { keywordFilter: data.words },
                        actions: [{ type: 1 }], // BLOCK_MESSAGE
                        enabled: true
                    });
                    resultMsg = `✅ Règle AutoMod "${data.rule_name}" créée et activée.`;
                    break;

                case 'AUTOMOD_SPAM_FILTER':
                    if (!await checkActionPermission(interaction, 'ManageGuild')) return;
                    resultMsg = `✅ Filtres spam activés (simulation).`;
                    break;

                case 'UPDATE_AUTOMOD_RULE':
                    if (!await checkActionPermission(interaction, 'ManageGuild')) return;
                    const rule = await guild.autoModerationRules.fetch(data.rule_id);
                    if (!rule) throw new Error("Règle introuvable.");

                    const editOptions = {};
                    if (data.name) editOptions.name = data.name;
                    if (data.enabled !== undefined) editOptions.enabled = data.enabled;

                    // Handle Trigger Metadata (Words/Regex)
                    if (data.add_words || data.remove_words || data.add_regex || data.remove_regex) {
                        const currentMeta = rule.triggerMetadata;
                        let newKeywords = currentMeta.keywordFilter || [];
                        let newRegex = currentMeta.regexPatterns || [];

                        if (data.add_words) newKeywords = [...new Set([...newKeywords, ...data.add_words])];
                        if (data.remove_words) newKeywords = newKeywords.filter(w => !data.remove_words.includes(w));

                        if (data.add_regex) newRegex = [...new Set([...newRegex, ...data.add_regex])];
                        if (data.remove_regex) newRegex = newRegex.filter(r => !data.remove_regex.includes(r));

                        editOptions.triggerMetadata = {
                            keywordFilter: newKeywords,
                            regexPatterns: newRegex
                        };
                    }

                    // Handle Actions
                    if (data.actions) {
                        editOptions.actions = data.actions.map(a => ({
                            type: a.type,
                            metadata: a.metadata
                        }));
                    }

                    await rule.edit(editOptions);
                    resultMsg = `✅ Règle AutoMod "${rule.name}" mise à jour.`;
                    break;

                // --- Divers ---
                case 'CREATE_EVENT':
                    if (!await checkActionPermission(interaction, 'ManageEvents')) return;
                    await guild.scheduledEvents.create({
                        name: data.name,
                        scheduledStartTime: data.start_time,
                        scheduledEndTime: data.end_time,
                        privacyLevel: 2, // GUILD_ONLY
                        entityType: 3, // EXTERNAL (requires location) or VOICE
                        entityMetadata: { location: data.location }
                    });
                    resultMsg = `✅ Événement "${data.name}" créé.`;
                    break;

                case 'CREATE_INVITE':
                    if (!await checkActionPermission(interaction, 'CreateInstantInvite')) return;
                    const invChan = await guild.channels.fetch(data.channel_id);
                    const invite = await invChan.createInvite({ maxUses: data.max_uses, maxAge: data.max_age_seconds, reason: data.auditLogReason });
                    resultMsg = `✅ Invitation créée: ${invite.url}`;
                    break;

                case 'VOICE_MOVE_MEMBER':
                    if (!await checkActionPermission(interaction, 'MoveMembers')) return;
                    if (!await checkActionHierarchy(interaction, data.user_id)) return;
                    const memberMove = await guild.members.fetch(data.user_id);
                    await memberMove.voice.setChannel(data.target_channel_id);
                    resultMsg = `✅ Membre déplacé.`;
                    break;

                case 'VOICE_DISCONNECT':
                    if (!await checkActionPermission(interaction, 'MoveMembers')) return;
                    if (!await checkActionHierarchy(interaction, data.user_id)) return;
                    const disconnectMember = await guild.members.fetch(data.user_id);
                    await disconnectMember.voice.disconnect();
                    resultMsg = `✅ Membre déconnecté du vocal.`;
                    break;

                case 'COMPLEX_UI_MESSAGE':
                    if (!await checkActionPermission(interaction, 'SendMessages')) return;
                    const uiChannel = await guild.channels.fetch(data.channel_id);
                    let componentsData = [];
                    try {
                        const parsed = JSON.parse(data.components);
                        componentsData = Array.isArray(parsed) ? parsed : [parsed];
                    } catch (e) { throw new Error("JSON Components invalide"); }

                    const rows = componentsData.map(rowData => {
                        const row = new ActionRowBuilder();
                        rowData.components.forEach(comp => {
                            if (comp.type === 2) { // Button
                                const btn = new ButtonBuilder()
                                    .setStyle(comp.style)
                                    .setLabel(comp.label);
                                if (comp.emoji) btn.setEmoji(comp.emoji);
                                if (comp.custom_id) btn.setCustomId(comp.custom_id);
                                if (comp.url) btn.setURL(comp.url);
                                if (comp.disabled) btn.setDisabled(comp.disabled);
                                row.addComponents(btn);
                            } else if (comp.type === 3) { // String Select
                                const select = new StringSelectMenuBuilder()
                                    .setCustomId(comp.custom_id)
                                    .setPlaceholder(comp.placeholder);
                                if (comp.options) select.addOptions(comp.options);
                                row.addComponents(select);
                            }
                        });
                        return row;
                    });

                    await uiChannel.send({
                        content: data.content,
                        embeds: data.embeds ? data.embeds.map(e => typeof e === 'string' ? JSON.parse(e) : e) : [],
                        components: rows
                    });

                    // Save button responses
                    if (data.button_responses) {
                        try {
                            const newResponses = JSON.parse(data.button_responses);
                            const responsesPath = path.join(__dirname, '../data/button_responses.json');
                            let currentResponses = {};
                            if (fs.existsSync(responsesPath)) {
                                currentResponses = JSON.parse(fs.readFileSync(responsesPath, 'utf8'));
                            }
                            const updatedResponses = { ...currentResponses, ...newResponses };
                            fs.writeFileSync(responsesPath, JSON.stringify(updatedResponses, null, 2));
                        } catch (e) {
                            console.error("Erreur sauvegarde réponses boutons:", e);
                        }
                    }

                    resultMsg = `✅ Message UI envoyé dans <#${data.channel_id}>.`;
                    break;

                case 'EDIT_SERVER':
                    if (!await checkActionPermission(interaction, 'ManageGuild')) return;
                    const editGuildOptions = {};
                    if (data.name) editGuildOptions.name = data.name;
                    if (data.icon_url) editGuildOptions.icon = data.icon_url;
                    if (data.afk_channel_id) editGuildOptions.afkChannel = data.afk_channel_id;
                    await guild.edit(editGuildOptions);
                    resultMsg = `✅ Serveur modifié.`;
                    break;

                case 'CREATE_EMOJI':
                    if (!await checkActionPermission(interaction, 'ManageEmojisAndStickers')) return;
                    await guild.emojis.create({ attachment: data.url, name: data.name });
                    resultMsg = `✅ Emoji "${data.name}" créé.`;
                    break;

                case 'LOCKDOWN_CHANNEL':
                    if (!await checkActionPermission(interaction, 'ManageChannels')) return;
                    const lockChannel = await guild.channels.fetch(data.channel_id);
                    await lockChannel.permissionOverwrites.edit(guild.id, { SendMessages: false }, { reason: data.reason || 'Lockdown' });
                    resultMsg = `✅ Salon verrouillé.`;
                    break;

                default:
                    resultMsg = "Action inconnue.";
            }

            await interaction.editReply({ content: resultMsg });

            // Update confirmation message to show success
            const embed = EmbedBuilder.from(interaction.message.embeds[0]);
            embed.setColor('#00FF00'); // Green
            embed.setTitle(`✅ Action Effectuée: ${embed.data.title.replace('🛡️ Confirmation Action: ', '')}`);
            embed.setFooter({ text: `Effectué par ${interaction.user.tag}` });

            await interaction.message.edit({ embeds: [embed], components: [] });

            pendingActions.delete(customId);

        } catch (error) {
            console.error(error);
            if (interaction.deferred) {
                await interaction.editReply({ content: `❌ Erreur lors de l'exécution: ${error.message}`, embeds: [], components: [] });
            } else {
                await interaction.reply({ content: `❌ Erreur lors de l'exécution: ${error.message}`, flags: [64] });
            }
        }
    }
}

module.exports = { handleAdminAction };
