const map = new Map();
const TTL = 30 * 60 * 1000;

function key(userId, messageId) {
  return `${userId}:${messageId}`;
}

/**
 * Mémorise le dernier choix d’un menu (shop, arbre) pour lier le bouton « Acheter / Débloquer ».
 * @param {string} userId
 * @param {string} messageId
 * @param {string} value ex. s:0 ou quest
 */
function set(userId, messageId, value) {
  map.set(key(userId, messageId), { v: value, t: Date.now() });
}

/**
 * @returns {string | null}
 */
function get(userId, messageId) {
  const o = map.get(key(userId, messageId));
  if (!o) return null;
  if (Date.now() - o.t > TTL) {
    map.delete(key(userId, messageId));
    return null;
  }
  return o.v;
}

function prune() {
  const t = Date.now();
  for (const [k, o] of map) {
    if (t - o.t > TTL) map.delete(k);
  }
}
setInterval(prune, 5 * 60_000);

module.exports = { set, get };
