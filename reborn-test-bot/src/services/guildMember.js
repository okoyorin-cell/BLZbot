const db = require('../db');
const users = require('./users');

function addGxp(guildId, userId, delta) {
  const d = typeof delta === 'bigint' ? delta : users.B(delta);
  const row = db.prepare('SELECT gxp FROM guild_member_gxp WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
  const cur = row ? users.B(row.gxp) : 0n;
  const next = cur + d;
  db.prepare(
    `INSERT INTO guild_member_gxp (guild_id, user_id, gxp, grp) VALUES (?, ?, ?, '0')
     ON CONFLICT(guild_id, user_id) DO UPDATE SET gxp = excluded.gxp`,
  ).run(guildId, userId, next.toString());
}

function addGrp(guildId, userId, delta) {
  const d = typeof delta === 'bigint' ? delta : users.B(delta);
  const row = db.prepare('SELECT grp FROM guild_member_gxp WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
  const cur = row ? users.B(row.grp) : 0n;
  const next = cur + d;
  db.prepare(
    `INSERT INTO guild_member_gxp (guild_id, user_id, gxp, grp) VALUES (?, ?, '0', ?)
     ON CONFLICT(guild_id, user_id) DO UPDATE SET grp = excluded.grp`,
  ).run(guildId, userId, next.toString());
}

function getMemberRow(guildId, userId) {
  return db.prepare('SELECT gxp, grp FROM guild_member_gxp WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}

module.exports = { addGxp, addGrp, getMemberRow };
