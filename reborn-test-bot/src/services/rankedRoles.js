/**
 * Rôles Discord par tier Ranked RP.
 *
 * Les IDs sont stockés en DB (`meta`) par hub Discord ID, sous la clé
 * `ranked_role_<tier>:<hubId>`. La commande `/admin-roles creer-ranked`
 * les crée et les enregistre, puis `syncRankRoleForUser()` les applique en
 * fonction du RP courant du joueur.
 *
 * Tiers (cohérents avec `itemMatrix.rankedTier`) :
 *   bronze (0–49 999), argent (50k+), or (60k+), platine (70k+),
 *   diamond (80k+), master (90k+), apex (100k+).
 *
 * Anti-spam : un cache mémoire évite d'appeler l'API Discord à chaque message
 * (resync uniquement quand le tier change réellement).
 */

const meta = require('./meta');
const users = require('./users');

const TIERS = ['bronze', 'argent', 'or', 'platine', 'diamond', 'master', 'apex'];

const TIER_DEFS = [
  { key: 'apex', label: 'Apex', threshold: 100_000n, color: 0xff5555 },
  { key: 'master', label: 'Master', threshold: 90_000n, color: 0xb142f5 },
  { key: 'diamond', label: 'Diamond', threshold: 80_000n, color: 0x55ddff },
  { key: 'platine', label: 'Platine', threshold: 70_000n, color: 0x9adbff },
  { key: 'or', label: 'Or', threshold: 60_000n, color: 0xf1c40f },
  { key: 'argent', label: 'Argent', threshold: 50_000n, color: 0xc0c0c0 },
  { key: 'bronze', label: 'Bronze', threshold: 0n, color: 0xcd7f32 },
];

/** Renvoie la clé du tier pour un montant de RP. */
function tierForRp(rp) {
  const r = typeof rp === 'bigint' ? rp : BigInt(rp || 0);
  for (const t of TIER_DEFS) {
    if (r >= t.threshold) return t.key;
  }
  return 'bronze';
}

function metaKey(hubId, tier) {
  return `ranked_role_${tier}:${hubId}`;
}

function getRoleIdForTier(hubId, tier) {
  return meta.get(metaKey(hubId, tier));
}

function setRoleIdForTier(hubId, tier, roleId) {
  meta.set(metaKey(hubId, tier), String(roleId));
}

function listConfiguredRoles(hubId) {
  return TIER_DEFS.map((t) => ({ ...t, roleId: getRoleIdForTier(hubId, t.key) || null }));
}

/** Cache du dernier tier appliqué pour éviter le spam API. */
const lastAppliedTier = new Map(); // key: `${hubId}:${userId}` -> tier

/**
 * Synchronise le rôle Discord du joueur en fonction de son RP courant.
 * Ne fait rien si aucun rôle n'est configuré sur le hub.
 *
 * @param {import('discord.js').Client} client
 * @param {string} hubDiscordId
 * @param {string} userId
 * @returns {Promise<{ ok: boolean, tier?: string, changed?: boolean, error?: string }>}
 */
async function syncRankRoleForUser(client, hubDiscordId, userId) {
  if (!client || !hubDiscordId || !userId) return { ok: false, error: 'arguments' };
  const rp = users.getPoints(userId);
  const tier = tierForRp(rp);
  const cacheKey = `${hubDiscordId}:${userId}`;
  if (lastAppliedTier.get(cacheKey) === tier) {
    return { ok: true, tier, changed: false };
  }
  // Vérifier qu'au moins un rôle est configuré (sinon abandon silencieux).
  const cfg = listConfiguredRoles(hubDiscordId);
  if (!cfg.some((c) => c.roleId)) return { ok: true, tier, changed: false };
  let guild;
  try {
    guild = client.guilds.cache.get(hubDiscordId) || (await client.guilds.fetch(hubDiscordId));
  } catch (e) {
    return { ok: false, error: `guild fetch: ${e?.message || e}` };
  }
  if (!guild) return { ok: false, error: 'guild absente' };
  let member;
  try {
    member = guild.members.cache.get(userId) || (await guild.members.fetch(userId));
  } catch {
    // Le joueur n'est plus sur le serveur — on ne pollue pas les logs.
    return { ok: false, error: 'membre absent' };
  }
  const targetRoleId = cfg.find((c) => c.key === tier)?.roleId || null;
  const otherRoleIds = cfg.filter((c) => c.key !== tier && c.roleId).map((c) => c.roleId);
  let changed = false;
  try {
    if (targetRoleId && !member.roles.cache.has(targetRoleId)) {
      await member.roles.add(targetRoleId, 'Ranked RP tier auto');
      changed = true;
    }
    for (const rid of otherRoleIds) {
      if (member.roles.cache.has(rid)) {
        await member.roles.remove(rid, 'Ranked RP tier auto').catch(() => {});
        changed = true;
      }
    }
    lastAppliedTier.set(cacheKey, tier);
    return { ok: true, tier, changed };
  } catch (e) {
    return { ok: false, error: `roles: ${e?.message || e}` };
  }
}

/** Réinitialise le cache pour un user (utilisé par la commande `/admin-roles resync`). */
function resetCacheFor(userId) {
  for (const key of [...lastAppliedTier.keys()]) {
    if (key.endsWith(`:${userId}`)) lastAppliedTier.delete(key);
  }
}

module.exports = {
  TIERS,
  TIER_DEFS,
  tierForRp,
  getRoleIdForTier,
  setRoleIdForTier,
  listConfiguredRoles,
  syncRankRoleForUser,
  resetCacheFor,
};
