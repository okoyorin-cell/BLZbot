const { SlashCommandBuilder } = require('discord.js');
const users = require('../services/users');

const DAY_MS = 24 * 60 * 60 * 1000;
const REWARD = 5000n;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Récompense journalière de test (placeholder MAJ daily).'),
  async execute(interaction) {
    const uid = interaction.user.id;
    const u = users.getOrCreate(uid, interaction.user.username);
    const now = Date.now();
    const last = u.daily_last_ms || 0;
    if (now - last < DAY_MS) {
      const left = DAY_MS - (now - last);
      const h = Math.ceil(left / 3600000);
      await interaction.reply({ content: `Prochain daily dans ~**${h}** h.`, ephemeral: true });
      return;
    }
    users.addStars(uid, REWARD);
    users.setDailyLastMs(uid, now);
    await interaction.reply({
      content: `**+${REWARD.toLocaleString('fr-FR')}** starss (daily test).`,
      ephemeral: true,
    });
  },
};
