const db = require('../db');
const users = require('./users');

const BRANCHES = /** @type {const} */ ([
  'quest',
  'guild',
  'shop',
  'ranked',
  'event',
]);

/** @param {string} userId */
function getTree(userId) {
  users.getOrCreate(userId, '');
  const raw = users.getUser(userId).skill_tree_json || '{}';
  try {
    const o = JSON.parse(raw);
    return typeof o === 'object' && o ? o : {};
  } catch {
    return {};
  }
}

function saveTree(userId, tree) {
  db.prepare('UPDATE users SET skill_tree_json = ? WHERE id = ?').run(JSON.stringify(tree), userId);
}

/** @param {string} userId */
function step(userId, branch) {
  const t = getTree(userId);
  const n = Math.min(5, Math.max(0, Math.floor(Number(t[branch]) || 0)));
  return n;
}

/** Coût pour passer de `currentStep` à `currentStep+1` (= numéro d’étape doc). */
function costForNext(currentStep) {
  return currentStep + 1;
}

/**
 * @param {string} userId
 * @param {string} branch
 */
function buy(userId, branch) {
  if (!BRANCHES.includes(branch)) return { ok: false, error: 'Branche inconnue.' };
  const cur = step(userId, branch);
  if (cur >= 5) return { ok: false, error: 'Branche complète.' };
  const cost = costForNext(cur);
  users.getOrCreate(userId, '');
  const sp = users.getUser(userId).skill_points || 0;
  if (sp < cost) return { ok: false, error: `Pas assez de points de compétence (besoin **${cost}**).` };
  const tree = getTree(userId);
  tree[branch] = cur + 1;
  db.prepare('UPDATE users SET skill_points = skill_points - ? WHERE id = ?').run(cost, userId);
  saveTree(userId, tree);
  syncTempleUnlock(userId);
  return { ok: true, branch, newStep: cur + 1 };
}

/** +points quand le niveau joueur augmente */
function onLevelUp(userId, deltaLevels) {
  if (deltaLevels <= 0) return;
  users.getOrCreate(userId, '');
  db.prepare('UPDATE users SET skill_points = skill_points + ? WHERE id = ?').run(deltaLevels, userId);
}

function syncTempleUnlock(userId) {
  const t = getTree(userId);
  let all5 = true;
  for (const b of BRANCHES) {
    if ((t[b] || 0) < 5) all5 = false;
  }
  db.prepare('UPDATE users SET temple_unlocked = ? WHERE id = ?').run(all5 ? 1 : 0, userId);
}

/** % bonus GXP guilde (branche guilde étape 2 : +10 %). */
function guildGxpMultBp(userId) {
  const s = step(userId, 'guild');
  let bp = 10000;
  if (s >= 2) bp += 1000;
  return bp;
}

/** % bonus GRP (branche guilde étape 4 : +10 %). */
function guildGrpMultBp(userId) {
  const s = step(userId, 'guild');
  let bp = 10000;
  if (s >= 4) bp += 1000;
  return bp;
}

/** Réduction boutique 0–30 % (étape 5 branche shop). */
function shopDiscountFrac(userId) {
  return step(userId, 'shop') >= 5 ? 0.3 : 0;
}

/** Branche ranked doc : % permanent + flats. */
function rankedRpBonuses(userId) {
  const s = step(userId, 'ranked');
  let pctBp = 10000;
  let flatMsg = 0n;
  let flatVoc = 0n;
  if (s >= 1) pctBp += 1000;
  if (s >= 2) flatMsg += 1n;
  if (s >= 3) pctBp += 1000;
  if (s >= 4) flatVoc += 2n;
  if (s >= 5) pctBp += 1000;
  return { pctBp, flatMsg, flatVoc };
}

// ─── Branche Quête ───────────────────────────────────────────────────────────
/** Multiplicateur (BigInt) sur les récompenses daily/hebdo (palier 2 = ×2). */
function questRewardMult(userId) {
  return step(userId, 'quest') >= 2 ? 2n : 1n;
}
/** Nombre total de skips quête disponibles par semaine (palier 1 = +1, palier 4 = +1). */
function questSkipsPerWeek(userId) {
  const s = step(userId, 'quest');
  let n = 0;
  if (s >= 1) n += 1;
  if (s >= 4) n += 1;
  return n;
}
/** Nombre de slots de quête à choix actifs simultanément (base 3, +1 à t3, +1 à t5). */
function questSelectionSlots(userId) {
  const s = step(userId, 'quest');
  let n = 3;
  if (s >= 3) n += 1;
  if (s >= 5) n += 1;
  return n;
}

// ─── Branche Guilde ──────────────────────────────────────────────────────────
/** Bonus de capacité de membres conféré par l'arbre du chef (palier 1 + palier 3). */
function guildMemberCapBonus(leaderId) {
  const s = step(leaderId, 'guild');
  let n = 0;
  if (s >= 1) n += 1;
  if (s >= 3) n += 1;
  return n;
}
/** Multiplicateur (bp /10000) sur le GRP du camp loyal pendant une séparation (palier 5 = +20 %). */
function loyalGrpBonusBp(leaderId) {
  return step(leaderId, 'guild') >= 5 ? 12000 : 10000;
}

// ─── Branche Boutique ────────────────────────────────────────────────────────
/** Multiplicateur (BigInt) sur le contenu des coffres (palier 2 = ×2). */
function chestLootMult(userId) {
  return step(userId, 'shop') >= 2 ? 2n : 1n;
}
/** Vrai si le joueur a 100 % CATL garanti dans la boutique (palier 5, gating temporel géré ailleurs). */
function hasCatlGuarantee(userId) {
  return step(userId, 'shop') >= 5;
}

// ─── Branche Événement ───────────────────────────────────────────────────────
/** Multiplicateur (bp /10000) sur les gains de monnaie d'event (palier 1 = +10 %). */
function eventCurrencyMultBp(userId) {
  return step(userId, 'event') >= 1 ? 11000 : 10000;
}
/** Bonus de défense d'event en bp /10000 (palier 2/3/4 = +10/+20/+30 %). */
function eventDefenseBonusBp(userId) {
  const s = step(userId, 'event');
  if (s >= 4) return 3000;
  if (s >= 3) return 2000;
  if (s >= 2) return 1000;
  return 0;
}
/** Réduction (fraction 0–1) sur les coffres d'event (palier 3 = -20 %). */
function eventChestDiscountFrac(userId) {
  return step(userId, 'event') >= 3 ? 0.2 : 0;
}
/** Vrai si le joueur peut réclamer 1× event_spawner par semaine (palier 5). */
function weeklyEventSpawnerEntitled(userId) {
  return step(userId, 'event') >= 5;
}

module.exports = {
  BRANCHES,
  getTree,
  saveTree,
  buy,
  step,
  onLevelUp,
  syncTempleUnlock,
  guildGxpMultBp,
  guildGrpMultBp,
  shopDiscountFrac,
  rankedRpBonuses,
  questRewardMult,
  questSkipsPerWeek,
  questSelectionSlots,
  guildMemberCapBonus,
  loyalGrpBonusBp,
  chestLootMult,
  hasCatlGuarantee,
  eventCurrencyMultBp,
  eventDefenseBonusBp,
  eventChestDiscountFrac,
  weeklyEventSpawnerEntitled,
};
