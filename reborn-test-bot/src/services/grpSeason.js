const db = require('../db');
const { GRP_RANK_KEYS, GRP_THRESHOLDS, grpRankFromTotal } = require('../reborn/grades');
const meta = require('./meta');
const users = require('./users');
const playerGuilds = require('./playerGuilds');

/**
 * Récompense de palier de guilde (saison courante) :
 * quand un membre fait franchir un nouveau rang à la guilde, tous ses membres
 * touchent la récompense correspondante. Une seule fois par saison.
 */
const GUILD_RANK_REWARDS = {
  bronze: { stars: 50_000n, items: [] },
  argent: { stars: 100_000n, items: [] },
  or: { stars: 250_000n, items: [{ id: 'planete', qty: 1 }] },
  platine: { stars: 500_000n, items: [{ id: 'corail', qty: 1 }] },
  diamant: { stars: 1_000_000n, items: [{ id: 'requin', qty: 1 }] },
  goat: { stars: 2_000_000n, items: [{ id: 'galaxie', qty: 1 }] },
  star: { stars: 5_000_000n, items: [{ id: 'crystal', qty: 1 }] },
};

function currentSeasonKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function maybeResetMonthlyGrp(hubDiscordId) {
  const key = `grp_reset:${hubDiscordId}`;
  const sk = currentSeasonKey();
  const last = meta.get(key);
  if (last === sk) return false;
  db.prepare('UPDATE guild_member_gxp SET grp = ? WHERE guild_id = ?').run('0', hubDiscordId);
  meta.set(key, sk);
  return true;
}

function recordGrpPeaksIfNeeded(hubDiscordId, userId, grpTotal) {
  const rank = grpRankFromTotal(grpTotal);
  if (!rank) return;
  const idx = GRP_RANK_KEYS.indexOf(rank);
  if (idx < 0) return;
  const season = currentSeasonKey();
  for (let i = 0; i <= idx; i++) {
    const rk = GRP_RANK_KEYS[i];
    const th = GRP_THRESHOLDS[i];
    if (grpTotal >= th) {
      db.prepare(
        'INSERT OR IGNORE INTO user_grp_peaks (hub_discord_id, user_id, rank_key, season_key) VALUES (?, ?, ?, ?)',
      ).run(hubDiscordId, userId, rk, season);
    }
  }
}

/** Reset GRP tous les hubs le 1er du mois UTC (doc : saison mensuelle). */
function tickCalendarFirstOfMonthUTC() {
  const d = new Date();
  if (d.getUTCDate() !== 1) return;
  const tag = `grp_cal_zero_${d.getUTCFullYear()}_${d.getUTCMonth()}`;
  if (meta.get(tag)) return;
  const hubs = db.prepare('SELECT DISTINCT guild_id FROM guild_member_gxp').all();
  for (const { guild_id } of hubs) {
    db.prepare('UPDATE guild_member_gxp SET grp = ? WHERE guild_id = ?').run('0', guild_id);
  }
  meta.set(tag, '1');
}

module.exports = { currentSeasonKey, maybeResetMonthlyGrp, recordGrpPeaksIfNeeded, grpRankFromTotal, tickCalendarFirstOfMonthUTC };
