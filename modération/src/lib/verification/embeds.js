/**
 * Builders des 3 embeds de log de vérification (matchent les screens fournis) :
 *  - succès vert       : ✅ Vérification Réussie
 *  - alt orange        : 🟠 Compte Alternatif Détecté — Vérifié avec Alerte
 *  - échec rouge       : ❌ Vérification Échouée
 *
 * Pour les DM owners on appelle ensuite `withSensitiveFields()` sur l'embed pour
 * y greffer IP brute / email Discord / User-Agent.
 */
const { EmbedBuilder } = require('discord.js');

function formatConnexion(geo) {
    if (!geo) return '🌐 Localisation indisponible';
    const flag = geo.flag || '🌐';
    const country = geo.country || 'Inconnu';
    const isp = geo.isp || geo.org || '';
    return isp ? `${flag} ${country} • ${isp}` : `${flag} ${country}`;
}

function userField(user, fallbackId) {
    if (!user) return fallbackId ? `<@${fallbackId}>` : '*(inconnu)*';
    const tag = user.username ? `*(${user.username})*` : '';
    return `<@${user.id}>${tag ? `\n${tag}` : ''}`;
}

/** Plus il y a de comptes liés, plus la confiance est haute (= plus probable que ce soit un alt). */
function computeAltConfidence(altCount) {
    if (altCount >= 5) return { level: 'Haute', emoji: '🔴', risk: 5, bar: 9 };
    if (altCount >= 2) return { level: 'Moyenne', emoji: '🟡', risk: 15, bar: 6 };
    return { level: 'Faible', emoji: '🟢', risk: 30, bar: 3 };
}

function progressBar(filled, total = 10) {
    const f = Math.max(0, Math.min(total, filled));
    return `\`[${'░'.repeat(f)}${' '.repeat(total - f)}]\``;
}

async function buildSuccessEmbed(client, p) {
    const user = await client.users.fetch(p.userId).catch(() => null);
    return new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('✅ Vérification Réussie')
        .setDescription(
            "L'utilisateur a passé tous les contrôles de sécurité avec succès. " +
                'Le rôle vérifié lui a été attribué automatiquement.',
        )
        .addFields(
            { name: '👤 Utilisateur', value: userField(user, p.userId), inline: true },
            { name: '🌐 Connexion', value: formatConnexion(p.geo), inline: true },
        )
        .setTimestamp(new Date());
}

async function buildAltEmbed(client, p) {
    const user = await client.users.fetch(p.userId).catch(() => null);
    const altCount = (p.alts || []).length;
    const conf = computeAltConfidence(altCount);
    const altMentions =
        (p.alts || [])
            .slice(0, 20)
            .map((a) => `<@${a.discord_user_id}>`)
            .join(', ') || '*(aucun)*';

    return new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle('🟠 Compte Alternatif Détecté — Vérifié avec Alerte')
        .setDescription(
            '⚠️ **Vérification accordée** — le rôle a été attribué malgré l’alerte.\n' +
                '🚨 Un compte alternatif probable a été détecté sur ce serveur.',
        )
        .addFields(
            {
                name: 'Niveau de confiance',
                value: `${conf.emoji} **${conf.level} confiance**`,
                inline: false,
            },
            {
                name: 'Risque de faux positif',
                value: `Très faible (~${conf.risk}%)\n${progressBar(conf.bar)}\n*Faux positif possible : membres du même foyer ou appareil partagé.*`,
                inline: false,
            },
            {
                name: 'Action recommandée',
                value:
                    'Vérifiez les comptes listés ci-dessous. Si vous confirmez qu’il s’agit d’un alt, ' +
                    'sanctionnez selon votre politique habituelle.',
                inline: false,
            },
            { name: '👤 Utilisateur', value: userField(user, p.userId), inline: true },
            { name: '🌐 Connexion', value: formatConnexion(p.geo), inline: true },
            { name: '🔗 Comptes liés', value: altMentions, inline: false },
        )
        .setTimestamp(new Date());
}

async function buildFailEmbed(client, p) {
    const user = await client.users.fetch(p.userId).catch(() => null);
    const reason = p.reason || 'Raison non précisée.';
    const fields = [
        { name: '👤 Utilisateur', value: userField(user, p.userId), inline: true },
        { name: '🌐 Connexion', value: formatConnexion(p.geo), inline: true },
        { name: 'Détail', value: String(reason).slice(0, 1024), inline: false },
    ];
    if (p.existingUserId) {
        fields.push({
            name: 'Compte déjà lié à cet email',
            value: `<@${p.existingUserId}> (\`${p.existingUserId}\`)`,
            inline: false,
        });
    }
    return new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('❌ Vérification Échouée')
        .setDescription(
            "L'utilisateur n'a pas pu valider son compte. Le rôle n'a **pas** été attribué.",
        )
        .addFields(fields)
        .setTimestamp(new Date());
}

/** Greffe IP brute / email / User-Agent pour la version DM owner uniquement. */
function withSensitiveFields(embed, p) {
    const sensitive = [];
    sensitive.push({ name: '🛰️ IP', value: `\`${p.ip || 'inconnue'}\``, inline: true });
    if (p.email) sensitive.push({ name: '📧 Email Discord', value: `\`${p.email}\``, inline: true });
    if (p.userAgent) sensitive.push({ name: '🖥️ User-Agent', value: `\`${String(p.userAgent).slice(0, 200)}\`` });
    embed.addFields(...sensitive);
    return embed;
}

module.exports = {
    buildSuccessEmbed,
    buildAltEmbed,
    buildFailEmbed,
    withSensitiveFields,
};
