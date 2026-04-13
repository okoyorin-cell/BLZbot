const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('banned_links.db'); // This creates or opens the database file

db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS banned_links (link TEXT)');
});

module.exports = db;
