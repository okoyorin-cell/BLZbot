const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const logger = require('./logger');

/** Salon d’accueil par défaut (rejoindre ce vocal → création d’un salon privé). */
const DEFAULT_LOBBY_CHANNEL_ID = '1388968408711823411';

function getConfig() {
    const lobbyChannelId = String(
        process.env.PRIVATE_ROOM_LOBBY_CHANNEL_ID || DEFAULT_LOBBY_CHANNEL_ID
    ).trim();
    const voiceCategoryId = String(process.env.PRIVATE_ROOM_CATEGORY_ID || '').trim();
    const panelTextChannelId = String(process.env.PRIVATE_ROOM_PANEL_CHANNEL_ID || '').trim();
    const enabled =
        process.env.PRIVATE_ROOM_ENABLED !== '0' &&
        voiceCategoryId.length > 0 &&
        /^\d{17,22}$/.test(voiceCategoryId);
    return { lobbyChannelId, voiceCategoryId, panelTextChannelId, enabled };
}

function sessionKey(guildId, userId) {
    return `${guildId}:${userId}`;
}

function ensureSessions(client) {
    if (!client.privateRoomSessions) {
        client.privateRoomSessions = new Map();
    }
    return client.privateRoomSessions;
}

function defaultChannelName(member) {
    const prefix = 'Salon de ';
    const raw =
        String(member.displayName || member.user?.username || 'membre')
            .replace(/[\r\n\t]/g, ' ')
            .trim() || 'membre';
    const maxRest = Math.max(0, 100 - prefix.length);
    return (prefix + raw.slice(0, maxRest)).slice(0, 100);
}

/**
 * Salon ouvert à tous les membres du serveur ; le créateur a Gérer le salon + mute/déplacer.
 */
function buildOverwrites(guild, member) {
    return [
        {
            id: guild.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
            ],
        },
        {
            id: member.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.MuteMembers,
                PermissionFlagsBits.DeafenMembers,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.ManageChannels,
            ],
        },
    ];
}

async function createPrivateVoice(client, member) {
    const cfg = getConfig();
    const guild = member.guild;
    const me = guild.members.me;
    if (
        !me?.permissions.has(PermissionFlagsBits.ManageChannels) ||
        !me?.permissions.has(PermissionFlagsBits.MoveMembers)
    ) {
        logger.warn('[PRIVATE_ROOM] Le bot a besoin de « Gérer les salons » et « Déplacer les membres ».');
        return { ok: false, error: 'perms' };
    }

    const parent = await guild.channels.fetch(cfg.voiceCategoryId).catch(() => null);
    if (!parent || parent.type !== ChannelType.GuildCategory) {
        logger.warn('[PRIVATE_ROOM] Catégorie PRIVATE_ROOM_CATEGORY_ID introuvable ou invalide.');
        return { ok: false, error: 'category' };
    }

    const name = defaultChannelName(member);
    const channel = await guild.channels.create({
        name,
        type: ChannelType.GuildVoice,
        parent,
        permissionOverwrites: buildOverwrites(guild, member),
        reason: `Salon vocal privé — ${member.user.tag}`,
    });

    const sessions = ensureSessions(client);
    sessions.set(sessionKey(guild.id, member.id), { voiceChannelId: channel.id });

    if (member.voice?.channel) {
        await member.voice.setChannel(channel).catch((e) => {
            logger.warn(`[PRIVATE_ROOM] Impossible de déplacer le membre: ${e.message}`);
        });
    }

    if (cfg.panelTextChannelId && /^\d{17,22}$/.test(cfg.panelTextChannelId)) {
        const tch = await guild.channels.fetch(cfg.panelTextChannelId).catch(() => null);
        if (tch?.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor(0x5865f2)
                .setTitle('Salon vocal privé')
                .setDescription(
                    `Ton salon : ${channel}\nTu as **Gérer le salon** : renomme, limite de places, permissions, etc.`
                )
                .setFooter({ text: 'Quitte le salon quand tu as fini — il sera supprimé s’il est vide.' });
            await tch.send({ content: `<@${member.id}>`, embeds: [embed] }).catch(() => null);
        }
    }

    logger.info(`[PRIVATE_ROOM] Créé ${channel.name} (${channel.id}) pour ${member.user.tag}`);
    return { ok: true, channel };
}

/**
 * Supprime le vocal privé du bot quand plus aucun humain dedans.
 */
async function deleteIfOwnerEmpty(client, channel) {
    const cfg = getConfig();
    if (!cfg.enabled || !channel?.isVoiceBased?.()) return;
    if (String(channel.parentId || '') !== String(cfg.voiceCategoryId)) return;

    const sessions = client.privateRoomSessions;
    if (!sessions) return;

    const entry = [...sessions.entries()].find(([, v]) => v.voiceChannelId === channel.id);
    if (!entry) return;

    const humans = channel.members.filter((m) => !m.user.bot).size;
    if (humans > 0) return;

    await channel.delete(`Salon privé vide — ${channel.name}`).catch((e) => {
        logger.debug(`[PRIVATE_ROOM] Suppression: ${e.message}`);
    });
    sessions.set(entry[0], { voiceChannelId: null });
}

async function handleLobbyJoin(client, oldState, newState) {
    const cfg = getConfig();
    if (!cfg.enabled || !newState.member || newState.member.user.bot) return;

    const lobbyIds = new Set([cfg.lobbyChannelId]);
    const joinedLobby =
        oldState.channelId !== newState.channelId &&
        newState.channelId &&
        lobbyIds.has(String(newState.channelId));

    if (!joinedLobby) return;

    const { guild, member } = newState;
    const sessions = ensureSessions(client);
    const key = sessionKey(guild.id, member.id);
    let session = sessions.get(key);
    if (!session) {
        session = { voiceChannelId: null };
        sessions.set(key, session);
    }

    if (session.voiceChannelId) {
        const existing = await guild.channels.fetch(session.voiceChannelId).catch(() => null);
        if (existing?.isVoiceBased?.()) {
            await member.voice.setChannel(existing).catch(() => null);
            return;
        }
        session.voiceChannelId = null;
    }

    try {
        const created = await createPrivateVoice(client, member);
        if (!created?.ok && created?.error !== 'perms' && created?.error !== 'category') {
            logger.warn('[PRIVATE_ROOM] createPrivateVoice:', created?.error);
        }
    } catch (e) {
        logger.error('[PRIVATE_ROOM]', e?.message || e);
    }
}

module.exports = {
    getConfig,
    handleLobbyJoin,
    deleteIfOwnerEmpty,
    ensureSessions,
};
