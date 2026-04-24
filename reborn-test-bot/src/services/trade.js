const db = require('../db');
const users = require('./users');

const RARITY_VALUE = {
  Commun: 10_000n,
  Rare: 50_000n,
  Epique: 100_000n,
  Légendaire: 500_000n,
  Mythique: 1_000_000n,
  Goatesque: 3_000_000n,
  Staresque: 10_000_000n,
};

function valueFromInventoryRows(rows) {
  const { getItem } = require('../reborn/catalog');
  let v = 0n;
  for (const r of rows) {
    const it = getItem(r.item_id);
    if (!it) continue;
    v += (RARITY_VALUE[it.rarity] || 0n) * BigInt(r.qty);
  }
  return v;
}

function totalOfferValue(stars, invRows) {
  return BigInt(stars || '0') + valueFromInventoryRows(invRows);
}

/** Écart max 40 % (doc). */
function tradeAllowed(aStars, aInv, bStars, bInv) {
  const va = totalOfferValue(aStars, aInv);
  const vb = totalOfferValue(bStars, bInv);
  if (va === 0n && vb === 0n) return { ok: false, error: 'Offres vides.' };
  const hi = va > vb ? va : vb;
  const lo = va > vb ? vb : va;
  if (hi === 0n) return { ok: true };
  const diff = hi - lo;
  if (diff * 100n > hi * 40n) return { ok: false, error: 'Écart de valeur > 40 % (règle REBORN).' };
  return { ok: true };
}

function genId() {
  return `tr${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
}

function createTrade(hubDiscordId, fromUser, toUser, fromStars, toStars) {
  users.getOrCreate(fromUser, '');
  users.getOrCreate(toUser, '');
  const chk = tradeAllowed(fromStars, [], toStars, []);
  if (!chk.ok) return chk;
  const id = genId();
  db.prepare(
    `INSERT INTO trades (id, hub_discord_id, from_user, to_user, from_stars, to_stars, status, created_ms) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
  ).run(id, hubDiscordId, fromUser, toUser, String(fromStars), String(toStars), Date.now());
  return { ok: true, tradeId: id };
}

function acceptTrade(tradeId, userId) {
  const t = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
  if (!t || t.status !== 'pending') return { ok: false, error: 'Trade introuvable.' };
  if (t.to_user !== userId) return { ok: false, error: 'Pas le destinataire.' };
  const fs = BigInt(t.from_stars || '0');
  const ts = BigInt(t.to_stars || '0');
  const chk = tradeAllowed(fs, [], ts, []);
  if (!chk.ok) return chk;
  if (users.getStars(t.from_user) < fs || users.getStars(t.to_user) < ts) {
    return { ok: false, error: 'Solde insuffisant.' };
  }
  users.addStars(t.from_user, -fs);
  users.addStars(t.to_user, fs);
  users.addStars(t.to_user, -ts);
  users.addStars(t.from_user, ts);
  db.prepare('UPDATE trades SET status = ? WHERE id = ?').run('accepted', tradeId);
  return { ok: true };
}

module.exports = { tradeAllowed, createTrade, acceptTrade, totalOfferValue, RARITY_VALUE };
