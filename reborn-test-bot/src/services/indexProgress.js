const db = require('../db');

/** Paliers doc + coffres catalogue REBORN (rôle Discord 100 % : hors scope bot → message). */
const STEPS = [
  { pct: 10, stars: 10_000n, chests: [] },
  { pct: 20, stars: 50_000n, chests: [{ id: 'coffre_classique', qty: 1 }] },
  { pct: 30, stars: 100_000n, chests: [{ id: 'coffre_classique', qty: 1 }] },
  { pct: 40, stars: 200_000n, chests: [{ id: 'coffre_catm', qty: 1 }] },
  { pct: 50, stars: 300_000n, chests: [{ id: 'coffre_catm', qty: 1 }] },
  { pct: 60, stars: 500_000n, chests: [{ id: 'coffre_catl', qty: 1 }] },
  { pct: 70, stars: 750_000n, chests: [{ id: 'coffre_catl', qty: 1 }] },
  { pct: 80, stars: 1_000_000n, chests: [{ id: 'coffre_catl', qty: 2 }] },
  { pct: 90, stars: 1_500_000n, chests: [{ id: 'coffre_cats', qty: 1 }] },
  { pct: 100, stars: 2_000_000n, chests: [{ id: 'coffre_cats', qty: 1 }], roleNote: 'pipelette ultime (rôle Discord à attribuer côté serveur)' },
];

function getRow(userId) {
  let r = db.prepare('SELECT * FROM user_item_index WHERE user_id = ?').get(userId);
  if (!r) {
    db.prepare('INSERT INTO user_item_index (user_id, completion_pct, claimed_json) VALUES (?, 0, ?)').run(
      userId,
      '[]',
    );
    r = db.prepare('SELECT * FROM user_item_index WHERE user_id = ?').get(userId);
  }
  return r;
}

function parseClaimed(json) {
  try {
    const a = JSON.parse(json || '[]');
    return Array.isArray(a) ? a.map(Number) : [];
  } catch {
    return [];
  }
}

function setCompletion(userId, pct) {
  getRow(userId);
  db.prepare('UPDATE user_item_index SET completion_pct = ? WHERE user_id = ?').run(Math.min(100, Math.max(0, pct)), userId);
}

function claimNext(userId, usersSvc) {
  getRow(userId);
  const r = db.prepare('SELECT * FROM user_item_index WHERE user_id = ?').get(userId);
  const claimed = parseClaimed(r.claimed_json);
  const pct = r.completion_pct || 0;
  const next = STEPS.find((s) => !claimed.includes(s.pct) && pct >= s.pct);
  if (!next) {
    return { ok: false, error: 'Aucune étape réclamable (augmente ton % d’index ou tout est déjà pris).' };
  }
  claimed.push(next.pct);
  usersSvc.addStars(userId, next.stars);
  for (const c of next.chests || []) {
    usersSvc.addInventory(userId, c.id, c.qty || 1);
  }
  db.prepare('UPDATE user_item_index SET claimed_json = ? WHERE user_id = ?').run(JSON.stringify(claimed.sort((a, b) => a - b)), userId);
  return { ok: true, step: next };
}

module.exports = { STEPS, getRow, setCompletion, claimNext, parseClaimed };
