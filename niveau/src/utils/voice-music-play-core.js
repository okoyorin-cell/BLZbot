const {
    getMusicSession,
    resolveYoutubeQueryToTracks,
    searchYoutubeVideos,
} = require('./voice-music-manager');
const { storePendingSearch, buildSearchSelectRow } = require('./voice-music-handler');

/**
 * Logique partagée : /musique play, modal « Ajouter », etc.
 * @param {object} opts
 * @param {string} opts.guildId
 * @param {string} opts.userId
 * @param {import('discord.js').GuildMember | null} opts.member
 * @param {import('discord.js').Client} opts.client
 * @param {string} opts.query
 * @param {(data: import('discord.js').InteractionReplyOptions) => Promise<unknown>} opts.editReply
 */
async function executeMusicPlayCore({ guildId, userId, member, client, query, editReply }) {
    const vc = member?.voice?.channel;
    if (!vc?.isVoiceBased?.()) {
        await editReply({
            content: 'Connecte-toi d’abord au **salon vocal** où la musique doit jouer.',
        });
        return;
    }

    const session = getMusicSession(guildId);
    session._client = client;

    const direct = await resolveYoutubeQueryToTracks(query, userId);
    if (direct?.length) {
        session.ensureConnection(client, vc);
        const n = session.enqueueMany(direct);
        if (n === 0) {
            await editReply({ content: 'La file est pleine.' });
            return;
        }
        await session.startOrContinue(client, vc);
        await session.refreshPanel();
        const extra = direct.length > 1 ? ` (${n} morceau(x) depuis playlist / lien)` : '';
        await editReply({ content: `Ajouté à la file${extra}.`, components: [] });
        return;
    }

    let results;
    try {
        results = await searchYoutubeVideos(query, userId);
    } catch (e) {
        await editReply({
            content: `Recherche impossible : ${e?.message || 'erreur'}. Réessaie ou colle un lien YouTube.`,
            components: [],
        });
        return;
    }

    if (!results.length) {
        await editReply({
            content: 'Aucun résultat — précise le titre ou envoie une URL YouTube.',
            components: [],
        });
        return;
    }

    storePendingSearch(guildId, userId, results);
    const row = buildSearchSelectRow(guildId, userId, results);
    await editReply({
        content: '**Choisis un résultat** (menu ci-dessous) :',
        components: [row],
    });
}

module.exports = { executeMusicPlayCore };
