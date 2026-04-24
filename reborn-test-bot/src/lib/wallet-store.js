const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', '..', 'data', 'wallet.json');

function readAll() {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const o = JSON.parse(raw);
    return typeof o === 'object' && o ? o : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

/** @returns {string} entier décimal sans limite pratique */
function getBalance(userId) {
  const all = readAll();
  const s = all[userId];
  if (s === undefined || s === null || s === '') return '0';
  try {
    return BigInt(String(s).replace(/\s/g, '')).toString(10);
  } catch {
    return '0';
  }
}

function setBalance(userId, amount) {
  const all = readAll();
  const v = BigInt(typeof amount === 'bigint' ? amount : String(amount).replace(/\s/g, ''));
  all[userId] = v.toString(10);
  writeAll(all);
  return getBalance(userId);
}

function addBalance(userId, delta) {
  const cur = BigInt(getBalance(userId));
  const d = BigInt(typeof delta === 'bigint' ? delta : String(delta).replace(/\s/g, ''));
  return setBalance(userId, cur + d);
}

module.exports = { getBalance, setBalance, addBalance };
