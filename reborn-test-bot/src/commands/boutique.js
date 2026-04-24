const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const users = require('../services/users');
const shop = require('../services/shop');
const { getItem } = require('../reborn/catalog');
const { BOOST_ROW_PRICE, CHEST_CLASSIC, CHEST_CATM, CHEST_CATL, CHEST_CATS, CATM_DAILY_LIMIT } = require('../reborn/constants');

module.exports = {
  data: new SlashCommandBuilder().setName('boutique').setDescription('Boutique REBORN (Paris + branche shop doc).'),
  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const uid = interaction.user.id;
    users.getOrCreate(uid, interaction.user.username);
    shop.ensureShopSlots(uid);
    const slots = shop.getTodaySlots(uid);
    const bal = users.getStars(uid).toLocaleString('fr-FR');
    const day = shop.utcDateKey();
    users.resetCatmIfNewDay(uid, day);
    const { count: catmCount } = users.getCatmState(uid);

    let desc = `Solde : **${bal}** starss · jour boutique **${day}** (UTC)\n\n**Ligne 1 — items du jour**\n`;
    for (const s of slots) {
      const it = getItem(s.item_id);
      const name = it?.name || s.item_id;
      desc += `• **${name}** — ${BigInt(s.price).toLocaleString('fr-FR')} starss\n`;
    }
    desc += `\n**Ligne 2 — coffres** (CATM : **${catmCount}/${CATM_DAILY_LIMIT}** aujourd’hui)\n`;
    desc += `Classique **${CHEST_CLASSIC.toLocaleString('fr-FR')}** · CATM **${CHEST_CATM.toLocaleString('fr-FR')}** · CATL **${CHEST_CATL.toLocaleString('fr-FR')}** · CATS **${CHEST_CATS.toLocaleString('fr-FR')}**\n`;
    desc += `\n**Ligne 3 — boosts 1h** (**${BOOST_ROW_PRICE.toLocaleString('fr-FR')}** chacun)\n×2 XP · ×2 GXP · ×2 Starss`;

    const embed = new EmbedBuilder().setTitle('🛒 Boutique REBORN (test)').setColor(0x5865f2).setDescription(desc);

    const rowSlots = new ActionRowBuilder().addComponents(
      ...slots.map((s) =>
        new ButtonBuilder()
          .setCustomId(`rb:s:${s.slot}`)
          .setLabel(`Slot ${s.slot + 1}`)
          .setStyle(ButtonStyle.Primary),
      ),
    );
    const rowChest = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rb:c:classic').setLabel('Coffre classique').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('rb:c:catm').setLabel('CATM').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('rb:c:catl').setLabel('CATL').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('rb:c:cats').setLabel('CATS').setStyle(ButtonStyle.Danger),
    );
    const rowBoost = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rb:b:xp').setLabel('×2 XP').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('rb:b:gxp').setLabel('×2 GXP').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('rb:b:starss').setLabel('×2 Starss').setStyle(ButtonStyle.Success),
    );

    await interaction.reply({ embeds: [embed], components: [rowSlots, rowChest, rowBoost] });
  },
};
