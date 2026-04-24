const path = require('path');
const Database = require('better-sqlite3');
const { migrate } = require('./migrate');

const dbPath = path.join(__dirname, '..', '..', 'data', 'reborn.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
migrate(db);

module.exports = db;
