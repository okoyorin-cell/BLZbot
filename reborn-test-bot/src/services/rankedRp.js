const db = require('../db');
const users = require('./users');

const POOL_CAP = 300_000n;
const BAND_LOW = 50_000n;
const BAND_HIGH = 100_000n;
const DAY_MS = 24 * 60 * 60 * 1000;

/** RP / message et / min voc selon tranche de RP total (doc ranked). */
function ratesForPoints(rp) {
  const p = rp < 0n ? 0n : rp;
  if (p < 50_000n) return { msg: 10n, vocMin: 30n };
  if (p < 60_000n) return { msg: 8n, vocMin: 20n };
  if (p < 70_000n) return { msg: 6n, vocMin: 15n };
  if (p < 80_000n) return { msg: 5n, vocMin: 10n };
  if (p < 90_000n) return { msg: 4n, vocMin: 7n };
  if (p < 100_000n) return { msg: 3n, vocMin: 4n };
  return { msg: 2n, vocMin: 2n };
}

function bandExcess(rp) {
  if (rp <= BAND_LOW) return 0n;
  if (rp >= BAND_HIGH) return BAND_HIGH - BAND_LOW;
  return rp - BAND_LOW;
}

/** Somme des « excès » [50k,100k] pour tous les joueurs (pool zéro-sum). */
function sumBandExcess() {
  const rows = db.prepare('SELECT points FROM users').all();
  let s = 0n;
  for (const r of rows) {
    s += bandExcess(users.B(r.points));
  }
  return s;
}

/**
 * Retire `amount` de RP aux joueurs dans la bande (hors `exceptUserId`), en priorité les plus hauts.
 * @returns {bigint} réellement retiré
 */
function stealRpFromBracket(exceptUserId, amount) {
  let left = amount;
  if (left <= 0n) return 0n;
  const rows = db
    .prepare(
      `SELECT id, points FROM users
       WHERE id != ? AND CAST(points AS INTEGER) > ? AND CAST(points AS INTEGER) < ?
       ORDER BY CAST(points AS INTEGER) DESC`,
    )
    .all(exceptUserId, Number(BAND_LOW), Number(BAND_HIGH));
  for (const r of rows) {
    if (left <= 0n) break;
    let p = users.B(r.points);
    const ex = bandExcess(p);
    if (ex <= 0n) continue;
    const take = left > ex ? ex : left;
    p -= take;
    if (p < BAND_LOW) p = BAND_LOW;
    users.setPoints(r.id, p);
    left -= take;
  }
  return amount - left;
}

/**
 * @param {string} userId
 * @param {'msg'|'voc'} kind
 * @param {bigint} [units] voc = minutes
 */
function grantFromActivity(userId, kind, units = 1n) {
  users.getOrCreate(userId, '');
  const now = Date.now();
  db.prepare('UPDATE users SET rp_last_activity_ms = ? WHERE id = ?').run(now, userId);

  const p = users.getPoints(userId);
  const r = ratesForPoints(p);
  let gain = kind === 'msg' ? r.msg : r.vocMin * units;
  if (gain <= 0n) return;

  const newP = p + gain;
  const excessBefore = sumBandExcess();
  const simRows = db.prepare('SELECT id, points FROM users').all();
  let simSum = 0n;
  for (const row of simRows) {
    let rp = users.B(row.points);
    if (row.id === userId) rp = newP;
    simSum += bandExcess(rp);
  }

  if (simSum > POOL_CAP) {
    const over = simSum - POOL_CAP;
    stealRpFromBracket(userId, over);
  }
  users.addPoints(userId, gain);
}

function decayForUserIfIdle(userId) {
  const u = users.getUser(userId);
  if (!u) return 0n;
  const last = u.rp_last_activity_ms || 0;
  if (!last || Date.now() - last < DAY_MS) return 0n;
  const p = users.getPoints(userId);
  let loss = 0n;
  if (p < 50_000n) loss = 0n;
  else if (p < 60_000n) loss = 500n;
  else if (p < 70_000n) loss = 1000n;
  else if (p < 80_000n) loss = 2000n;
  else if (p < 90_000n) loss = 3000n;
  else if (p < 100_000n) loss = 4000n;
  else loss = 5000n;
  if (loss <= 0n) {
    db.prepare('UPDATE users SET rp_last_activity_ms = ? WHERE id = ?').run(Date.now(), userId);
    return 0n;
  }
  const np = p > loss ? p - loss : 0n;
  users.setPoints(userId, np);
  db.prepare('UPDATE users SET rp_last_activity_ms = ? WHERE id = ?').run(Date.now(), userId);
  return loss;
}

module.exports = {
  ratesForPoints,
  grantFromActivity,
  decayForUserIfIdle,
  sumBandExcess,
  POOL_CAP,
  BAND_LOW,
  BAND_HIGH,
};
