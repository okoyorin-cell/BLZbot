const {
  BOOST_ROW_PRICE,
  CHEST_CLASSIC,
  CHEST_CATM,
  CHEST_CATL,
  CHEST_CATS,
  CATM_DAILY_LIMIT,
} = require('../reborn/constants');
const { getItem } = require('../reborn/catalog');
const { rollChest } = require('../reborn/chestLoot');
const users = require('./users');
const shop = require('./shop');
const meta = require('./meta');

const HOUR_MS = 60 * 60 * 1000;

function extendBoost(userId, field) {
  const u = users.getUser(userId);
  const now = Date.now();
  const cur = u[field] || 0;
  const base = Math.max(cur, now);
  users.setBoostField(userId, field, base + HOUR_MS);
}

/**
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {string[]} parts ['rb','s','0'] or ['rb','c','classic'] ...
 */
async function handlePurchase(interaction, parts) {
  const uid = interaction.user.id;
  users.getOrCreate(uid, interaction.user.username);
  const kind = parts[1];
  const sub = parts[2];

  if (kind === 's') {
    const slot = parseInt(sub, 10);
    if (Number.isNaN(slot) || slot < 0 || slot > 4) {
      await interaction.reply({ content: 'Slot invalide.', ephemeral: true });
      return;
    }
    shop.ensureShopSlots(uid);
    const row = shop.getSlot(uid, slot);
    if (!row) {
      await interaction.reply({ content: 'Slot introuvable.', ephemeral: true });
      return;
    }
    const item = getItem(row.item_id);
    if (!item) {
      await interaction.reply({ content: 'Item inconnu.', ephemeral: true });
      return;
    }
    const price = BigInt(row.price);
    if (users.getStars(uid) < price) {
      await interaction.reply({ content: `Pas assez de starss (besoin **${price.toLocaleString('fr-FR')}**).`, ephemeral: true });
      return;
    }
    users.addStars(uid, -price);
    if (item.id === 'diamant') {
      const h = meta.diamondHolder();
      if (h && h !== uid) {
        users.addStars(uid, price);
        await interaction.reply({ content: 'Le diamant est déjà possédé par un autre joueur.', ephemeral: true });
        return;
      }
      meta.setDiamondHolder(uid);
    }
    users.addInventory(uid, item.id, 1);
    shop.removeSlot(uid, slot);
    await interaction.reply({
      content: `Achat : **${item.name}** pour **${price.toLocaleString('fr-FR')}** starss.`,
      ephemeral: true,
    });
    return;
  }

  if (kind === 'b') {
    const price = BOOST_ROW_PRICE;
    if (users.getStars(uid) < price) {
      await interaction.reply({ content: 'Pas assez de starss pour ce boost.', ephemeral: true });
      return;
    }
    users.addStars(uid, -price);
    if (sub === 'xp') extendBoost(uid, 'xp_boost_ms');
    else if (sub === 'gxp') extendBoost(uid, 'gxp_boost_ms');
    else if (sub === 'starss') extendBoost(uid, 'starss_boost_ms');
    else {
      users.addStars(uid, price);
      await interaction.reply({ content: 'Boost inconnu.', ephemeral: true });
      return;
    }
    await interaction.reply({ content: `Boost ×2 (**${sub}**) activé +1h (cumulable).`, ephemeral: true });
    return;
  }

  if (kind === 'c') {
    let price = 0n;
    let label = '';
    if (sub === 'classic') {
      price = CHEST_CLASSIC;
      label = 'Coffre classique';
    } else if (sub === 'catm') {
      price = CHEST_CATM;
      label = 'CATM';
      const day = shop.utcDateKey();
      users.resetCatmIfNewDay(uid, day);
      const { count } = users.getCatmState(uid);
      if (count >= CATM_DAILY_LIMIT) {
        await interaction.reply({ content: `Limite journalière CATM (**${CATM_DAILY_LIMIT}**/jour).`, ephemeral: true });
        return;
      }
    } else if (sub === 'catl') {
      price = CHEST_CATL;
      label = 'CATL (légendaire)';
    } else if (sub === 'cats') {
      price = CHEST_CATS;
      label = 'CATS (star)';
    } else {
      await interaction.reply({ content: 'Coffre inconnu.', ephemeral: true });
      return;
    }
    if (users.getStars(uid) < price) {
      await interaction.reply({ content: 'Pas assez de starss.', ephemeral: true });
      return;
    }
    users.addStars(uid, -price);
    if (sub === 'catm') users.bumpCatm(uid, shop.utcDateKey());

    const lines = [];
    let totalStars = 0n;
    let totalXp = 0;
    const allItems = [];
    let loot = rollChest(sub, meta, uid);
    const maxRollAgain = 2;
    let depth = 0;
    while (loot.rollAgain && depth < maxRollAgain) {
      depth += 1;
      const extra = rollChest(sub, meta, uid);
      loot = {
        lines: [...loot.lines, ...extra.lines],
        stars: loot.stars + extra.stars,
        xp: loot.xp + extra.xp,
        items: [...loot.items, ...extra.items],
        rollAgain: extra.rollAgain,
      };
    }
    totalStars += loot.stars;
    totalXp += loot.xp;
    for (const it of loot.items) allItems.push(it);
    lines.push(...loot.lines);
    if (totalStars > 0n) users.addStars(uid, totalStars);
    if (totalXp > 0) users.addXp(uid, totalXp);
    for (const { id, qty } of allItems) {
      if (id === 'diamant') {
        const h = meta.diamondHolder();
        if (h && h !== uid) {
          users.addStars(uid, 5_000_000n);
          lines.push('*(Diamant déjà pris — 5M starss)*');
          continue;
        }
        meta.setDiamondHolder(uid);
      }
      users.addInventory(uid, id, qty);
    }

    const starLine =
      totalStars > 0n ? `+**${totalStars.toLocaleString('fr-FR')}** starss` : '';
    const xpLine = totalXp > 0 ? `+**${totalXp}** XP` : '';
    const head = [starLine, xpLine].filter(Boolean).join(' · ');
    const body = lines.length ? `\n${lines.map((l) => `• ${l}`).join('\n')}` : '';
    await interaction.reply({
      content: `**${label}** ouvert${head ? ` — ${head}` : ''}.${body}`.slice(0, 1900),
      ephemeral: true,
    });
  }
}

module.exports = { handlePurchase };
