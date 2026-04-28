/**
 * REST Discord (Bot) — attribuer / retirer un rôle directement (sans collection cache).
 */

async function addGuildMemberRole(botToken, guildId, userId, roleId) {
    const url = `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`;
    const res = await fetch(url, {
        method: 'PUT',
        headers: { Authorization: `Bot ${botToken}` },
    });
    if (!res.ok && res.status !== 204) {
        const text = await res.text().catch(() => '');
        throw new Error(`Discord API ${res.status}: ${text || res.statusText}`);
    }
}

async function removeGuildMemberRole(botToken, guildId, userId, roleId) {
    const url = `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`;
    const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bot ${botToken}` },
    });
    if (!res.ok && res.status !== 204) {
        const text = await res.text().catch(() => '');
        throw new Error(`Discord API ${res.status}: ${text || res.statusText}`);
    }
}

/**
 * Attribue le rôle vérifié et, si fourni, retire le rôle "non vérifié" / "Compte Suspect".
 * Le retrait du rôle non-vérifié est best-effort : on log l'erreur mais on ne fait pas
 * échouer la vérification si Discord refuse (rôle déjà absent, hiérarchie, etc.).
 *
 * @param {string} botToken
 * @param {string} guildId
 * @param {string} userId
 * @param {string} verifiedRoleId
 * @param {string|null} [unverifiedRoleId]
 */
async function grantVerifiedRole(botToken, guildId, userId, verifiedRoleId, unverifiedRoleId = null) {
    await addGuildMemberRole(botToken, guildId, userId, verifiedRoleId);
    if (unverifiedRoleId) {
        try {
            await removeGuildMemberRole(botToken, guildId, userId, unverifiedRoleId);
        } catch (e) {
            console.warn(
                `[verif] retrait rôle non-vérifié ${unverifiedRoleId} sur ${userId} échoué : ${e.message || e}`,
            );
        }
    }
}

module.exports = { addGuildMemberRole, removeGuildMemberRole, grantVerifiedRole };
