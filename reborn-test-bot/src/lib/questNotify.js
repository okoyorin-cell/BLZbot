const QUESTS_LOG_CHANNEL_ID = String(process.env.BLZ_QUESTS_LOG_CHANNEL_ID || '1454479460798566410').trim();

/**
 * Poste un message de complétion de quête dans le salon de log dédié.
 * @param {import('discord.js').Client} client
 * @param {string} userId
 * @param {{ daily?: any, weekly?: any, selection?: any }} unlocked
 */
async function notifyQuestUnlocks(client, userId, unlocked) {
  if (!unlocked) return;
  const lines = [];
  if (unlocked.daily) {
    lines.push(`🌅 **Quête quotidienne** validée — **+${unlocked.daily.reward.toLocaleString('fr-FR')}** starss`);
  }
  if (unlocked.weekly) {
    lines.push(`📅 **Quête hebdomadaire** validée — **+${unlocked.weekly.reward.toLocaleString('fr-FR')}** starss`);
  }
  if (unlocked.selection) {
    lines.push(
      `🎲 **${unlocked.selection.label}** — **+${unlocked.selection.reward.toLocaleString('fr-FR')}** starss`,
    );
  }
  if (!lines.length) return;
  try {
    const ch = await client.channels.fetch(QUESTS_LOG_CHANNEL_ID).catch(() => null);
    if (!ch || typeof ch.send !== 'function') return;
    await ch.send({
      content: `🎯 <@${userId}>\n${lines.join('\n')}`,
      allowedMentions: { users: [userId] },
    });
  } catch (e) {
    console.warn('[questNotify] envoi KO', e?.message || e);
  }
}

module.exports = { notifyQuestUnlocks };
