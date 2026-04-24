const db = require('../db');
const users = require('./users');

function read(guildId, userId) {
  const row = db.prepare('SELECT gxp, grp FROM guild_member_gxp WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
  return {
    gxp: row ? users.B(row.gxp) : 0n,
    grp: row ? users.B(row.grp) : 0n,
  };
}

function write(guildId, userId, gxp, grp) {
  db.prepare(
    `INSERT INTO guild_member_gxp (guild_id, user_id, gxp, grp) VALUES (?, ?, ?, ?)
     ON CONFLICT(guild_id, user_id) DO UPDATE SET gxp = excluded.gxp, grp = excluded.grp`,
  ).run(guildId, userId, gxp.toString(), grp.toString());
}

function addGxp(guildId, userId, delta) {
  const d = typeof delta === 'bigint' ? delta : users.B(delta);
  const { gxp, grp } = read(guildId, userId);
  write(guildId, userId, gxp + d, grp);
}

function addGrp(guildId, userId, delta) {
  const d = typeof delta === 'bigint' ? delta : users.B(delta);
  const { gxp, grp } = read(guildId, userId);
  write(guildId, userId, gxp, grp + d);
}

function getMemberRow(guildId, userId) {
  return read(guildId, userId);
}

module.exports = { addGxp, addGrp, getMemberRow };
