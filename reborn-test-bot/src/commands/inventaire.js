const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const users = require('../services/users');
const { getItem } = require('../reborn/catalog');

module.exports = {
  data: new SlashCommandBuilder().setName('inventaire').setDescription('Liste ton inventaire (items achetés).'),
  async execute(interaction) {
    const uid = interaction.user.id;
    users.getOrCreate(uid, interaction.user.username);
    const rows = users.getInventory(uid);
    if (!rows.length) {
      await interaction.reply({ content: 'Inventaire vide.', ephemeral: true });
      return;
    }
    const lines = rows.map((r) => {
      const it = getItem(r.item_id);
      const name = it?.name || r.item_id;
      return `• **${name}** ×${r.qty}`;
    });
    const embed = new EmbedBuilder()
      .setTitle('🎒 Inventaire')
      .setDescription(lines.join('\n').slice(0, 4000))
      .setColor(0x2ecc71);
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
