const {
  SlashCommandBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
  TextDisplayBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  MessageFlags,
} = require('discord.js');
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

function buildCloseRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('daily_close').setLabel('Fermer').setStyle(ButtonStyle.Secondary),
  );
}

function buildDailyContainer(opts) {
  const { success, displayName, avatarUrl, highestRoleName, rewardLine, remainingTime, doubleDailyCount, starsTotal } =
    opts;

  const gallery = new MediaGalleryBuilder().addItems({
    media: { url: avatarUrl },
  });

  const roleLine = highestRoleName && highestRoleName !== '@everyone' ? `**Rôle** ${highestRoleName}` : '**Rôle** Membre';
  const starsLine =
    starsTotal !== undefined ? `\n**Starss** ${starsTotal.toLocaleString('fr-FR')}` : '';

  let body;
  if (success && rewardLine) {
    body = `## ${rewardLine.emoji} Récompense\n**${rewardLine.title}**\n\n${roleLine}${starsLine}\n\n*Sandbox REBORN — loot aligné sur le bot principal.*`;
  } else {
    const dd =
      typeof doubleDailyCount === 'number' && doubleDailyCount > 0
        ? `\n\nTu as **${doubleDailyCount}** × **Double Daily** (max **3** bonus / 24h glissantes avec l’item).`
        : '';
    body = `## ⏳ Prochain daily\nReviens dans **${remainingTime}**.\n\n${roleLine}${starsLine}${dd}\n\n*Reset calendaire minuit local + bonus Double Daily.*`;
  }

  const mainText = new TextDisplayBuilder().setContent(`# Daily\n**${displayName}**\n\n${body}`);

  const container = new ContainerBuilder().addMediaGalleryComponents(gallery).addTextDisplayComponents(mainText);
  container.addActionRowComponents(buildCloseRow());
  return container;
}

async function sendDailyV2Reply(interaction, container) {
  const message = await interaction.editReply({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 5 * 60 * 1000,
  });

  collector.on('collect', async (i) => {
    if (i.user.id !== interaction.user.id) {
      return i.reply({ content: "Seul l'auteur de la commande peut utiliser ce bouton.", ephemeral: true });
    }
    if (i.customId === 'daily_close') {
      try {
        await i.update({ components: [] });
      } catch {
        /* ignore */
      }
      collector.stop();
    }
  });
}

/**
 * @param {string} userId
 * @returns {{ title: string, emoji: string }}
 */
function applyRandomReward(userId) {
  const reward = getRandomReward();
  let rewardEmoji = '';
  let rewardLine = { title: reward.name, emoji: '✅' };

  switch (reward.type) {
    case 'stars': {
      const base = BigInt(reward.amount);
      const amount = users.applyStarssMultiplier(userId, base);
      users.addStars(userId, amount);
      rewardEmoji = '⭐';
      rewardLine = {
        title: `**+${amount.toLocaleString('fr-FR')}** starss — ${reward.name}`,
        emoji: rewardEmoji,
      };
      break;
    }
    case 'xp':
      users.addXp(userId, reward.amount);
      rewardEmoji = '🚀';
      rewardLine = { title: `${reward.name} gagnés`, emoji: rewardEmoji };
      break;
    case 'points':
      users.addPoints(userId, BigInt(reward.amount));
      rewardEmoji = '🏆';
      rewardLine = { title: `${reward.name} gagnés`, emoji: rewardEmoji };
      break;
    case 'item': {
      users.addInventory(userId, reward.itemId, 1);
      rewardEmoji = '🎁';
      const def = getItem(reward.itemId);
      rewardLine = {
        title: `${def?.name || reward.name} ajouté à l’inventaire`,
        emoji: rewardEmoji,
      };
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
    .setDescription('Réclamez votre récompense journalière aléatoire !'),

  async execute(interaction) {
    await interaction.deferReply();

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

    const member = interaction.guild ? await interaction.guild.members.fetch(userId).catch(() => null) : null;
    const displayName = member?.displayName || interaction.user.username;
    const highestRoleName =
      member?.roles?.highest?.name && member.roles.highest.name !== '@everyone'
        ? member.roles.highest.name
        : 'Membre';
    const avatarUrl =
      member?.displayAvatarURL({ extension: 'png', size: 256 }) ||
      interaction.user.displayAvatarURL({ extension: 'png', size: 256 });

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
          const container = buildDailyContainer({
            success: false,
            displayName,
            avatarUrl,
            highestRoleName,
            remainingTime,
            doubleDailyCount: invQty(userId, 'double_daily'),
            starsTotal: users.getStars(userId),
          });
          await sendDailyV2Reply(interaction, container);
          return;
        }
        pushDoubleRoll(userId);
      }

      const rewardLine = applyRandomReward(userId);
      if (naturalOk) users.setDailyLastMs(userId, Date.now());

      const starsTotal = users.getStars(userId);
      const container = buildDailyContainer({
        success: true,
        displayName,
        avatarUrl,
        highestRoleName,
        rewardLine,
        starsTotal,
      });
      await sendDailyV2Reply(interaction, container);
      return;
    }

    const tomorrowMidnight = new Date(midnightLocal);
    tomorrowMidnight.setDate(tomorrowMidnight.getDate() + 1);
    const remainingTime = msToTime(tomorrowMidnight.getTime() - now.getTime());
    const doubleDailyCount = invQty(userId, 'double_daily');
    const starsTotal = users.getStars(userId);

    const container = buildDailyContainer({
      success: false,
      displayName,
      avatarUrl,
      highestRoleName,
      remainingTime,
      doubleDailyCount,
      starsTotal,
    });
    await sendDailyV2Reply(interaction, container);
  },
};
