const { SlashCommandBuilder } = require('discord.js');
const users = require('../services/users');
const { getItem } = require('../reborn/catalog');
const meta = require('../services/meta');
const cfg = require('../config');

const DAY_MS = 24 * 60 * 60 * 1000;

function msToTime(ms) {
  const seconds = Math.floor((ms / 1000) % 60)
    .toString()
    .padStart(2, '0');
  const minutes = Math.floor((ms / (1000 * 60)) % 60)
    .toString()
    .padStart(2, '0');
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24).toString();
  if (parseInt(hours, 10) > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (parseInt(minutes, 10) > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function sameCalendarDay(d, ref) {
  return (
    d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate()
  );
}

function pruneDoubleRolls(userId) {
  const key = `ddailyroll:${userId}`;
  let arr = [];
  try {
    arr = JSON.parse(meta.get(key) || '[]');
  } catch {
    arr = [];
  }
  const now = Date.now();
  arr = arr.filter((t) => typeof t === 'number' && now - t < DAY_MS);
  meta.set(key, JSON.stringify(arr));
  return arr;
}

function pushDoubleRoll(userId) {
  const arr = pruneDoubleRolls(userId);
  arr.push(Date.now());
  meta.set(`ddailyroll:${userId}`, JSON.stringify(arr));
}

const rewards = [
  { name: '10 000 Starss', chance: 0.3, type: 'stars', amount: 10000 },
  { name: '500 EXP', chance: 0.3, type: 'xp', amount: 500 },
  { name: '500 RP', chance: 0.2, type: 'points', amount: 500 },
  { name: '25 000 Starss', chance: 0.1, type: 'stars', amount: 25000 },
  { name: 'Coffre au trésor', chance: 0.09, type: 'item', itemId: 'coffre_classique' },
  { name: 'Méga coffre au trésor', chance: 0.01, type: 'item', itemId: 'coffre_catl' },
];

function getRandomReward() {
  const rand = Math.random();
  let cumulative = 0;
  for (const reward of rewards) {
    cumulative += reward.chance;
    if (rand < cumulative) return reward;
  }
  return rewards[0];
}

function invQty(userId, itemId) {
  const rows = users.getInventory(userId);
  const row = rows.find((r) => r.item_id === itemId);
  return row ? row.qty : 0;
}

function applyRandomReward(userId) {
  const reward = getRandomReward();
  let rewardLine = { title: reward.name, emoji: '✅' };
  switch (reward.type) {
    case 'stars': {
      const base = BigInt(reward.amount);
      const amount = users.applyStarssMultiplier(userId, base);
      users.addStars(userId, amount);
      rewardLine = { title: `+**${amount.toLocaleString('fr-FR')}** starss — ${reward.name}`, emoji: '⭐' };
      break;
    }
    case 'xp':
      users.addXp(userId, reward.amount);
      rewardLine = { title: `${reward.name} gagnés`, emoji: '🚀' };
      break;
    case 'points':
      users.addPoints(userId, BigInt(reward.amount));
      rewardLine = { title: `${reward.name} gagnés`, emoji: '🏆' };
      break;
    case 'item': {
      users.addInventory(userId, reward.itemId, 1);
      const def = getItem(reward.itemId);
      rewardLine = { title: `${def?.name || reward.name} → inventaire`, emoji: '🎁' };
      break;
    }
    default:
      break;
  }
  return rewardLine;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Récompense journalière (texte, sans grosse mise en forme v2).'),

  async execute(interaction) {
    const userId = interaction.user.id;
    users.getOrCreate(userId, interaction.user.username);

    const now = new Date();
    const midnightLocal = new Date(now);
    midnightLocal.setHours(0, 0, 0, 0);

    const u = users.getUser(userId);
    const lastMs = u?.daily_last_ms || 0;
    const canClaim = !lastMs || lastMs === 0;

    let lastClaimedMidnight = null;
    if (!canClaim) {
      const lastClaimedDate = new Date(lastMs);
      lastClaimedMidnight = new Date(lastClaimedDate);
      lastClaimedMidnight.setHours(0, 0, 0, 0);
    }

    const naturalOk = canClaim || (lastClaimedMidnight && lastClaimedMidnight < midnightLocal);
    const claimedToday = Boolean(lastMs && sameCalendarDay(new Date(lastMs), now));

    const tryDouble =
      !naturalOk &&
      claimedToday &&
      invQty(userId, 'double_daily') > 0 &&
      (cfg.TEST_NO_LIMITS || pruneDoubleRolls(userId).length < 3);

    if (naturalOk || tryDouble) {
      if (tryDouble) {
        if (!users.takeInventory(userId, 'double_daily', 1)) {
          const tomorrowMidnight = new Date(midnightLocal);
          tomorrowMidnight.setDate(tomorrowMidnight.getDate() + 1);
          const remainingTime = msToTime(tomorrowMidnight.getTime() - now.getTime());
          return interaction.reply({
            content: `⏳ **Prochain daily** : **${remainingTime}** · *Double Daily* indisponible (objet / limite 24h).`,
            ephemeral: true,
          });
        }
        pushDoubleRoll(userId);
      }
      const rewardLine = applyRandomReward(userId);
      if (naturalOk) users.setDailyLastMs(userId, Date.now());
      return interaction.reply({
        content: `## ${rewardLine.emoji} Daily\n${rewardLine.title}\n\nSolde : **${users
          .getStars(userId)
          .toLocaleString('fr-FR')}** starss`,
        ephemeral: true,
      });
    }

    const tomorrowMidnight = new Date(midnightLocal);
    tomorrowMidnight.setDate(tomorrowMidnight.getDate() + 1);
    const remainingTime = msToTime(tomorrowMidnight.getTime() - now.getTime());
    const ddc = invQty(userId, 'double_daily');
    return interaction.reply({
      content: `⏳ **Prochain daily** : **${remainingTime}**${ddc > 0 ? ` · *Double daily* : **${ddc}**` : ''}`,
      ephemeral: true,
    });
  },
};
