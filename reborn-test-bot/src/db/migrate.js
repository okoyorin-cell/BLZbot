const fs = require('fs');
const path = require('path');

/**
 * @param {import('better-sqlite3').Database} db
 */
function migrate(db) {
  const dir = path.join(__dirname, '..', '..', 'data');
  fs.mkdirSync(dir, { recursive: true });

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL DEFAULT '',
      stars TEXT NOT NULL DEFAULT '0',
      points TEXT NOT NULL DEFAULT '0',
      xp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      daily_last_ms INTEGER NOT NULL DEFAULT 0,
      xp_boost_ms INTEGER NOT NULL DEFAULT 0,
      gxp_boost_ms INTEGER NOT NULL DEFAULT 0,
      starss_boost_ms INTEGER NOT NULL DEFAULT 0,
      catm_day TEXT NOT NULL DEFAULT '',
      catm_count INTEGER NOT NULL DEFAULT 0,
      catl_next_ms INTEGER NOT NULL DEFAULT 0,
      cats_next_ms INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS inventory (
      user_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      qty INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (user_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS user_shop (
      user_id TEXT NOT NULL,
      shop_date TEXT NOT NULL,
      slot INTEGER NOT NULL,
      item_id TEXT NOT NULL,
      price TEXT NOT NULL,
      PRIMARY KEY (user_id, shop_date, slot)
    );

    CREATE TABLE IF NOT EXISTS guild_member_gxp (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      gxp TEXT NOT NULL DEFAULT '0',
      grp TEXT NOT NULL DEFAULT '0',
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS guilds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      grade TEXT NOT NULL DEFAULT '',
      level INTEGER NOT NULL DEFAULT 0,
      gxp_total TEXT NOT NULL DEFAULT '0',
      created_ms INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS meta (
      k TEXT PRIMARY KEY,
      v TEXT NOT NULL
    );
  `);
}

module.exports = { migrate };
