const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const LINES = [
  '**Économie** — starss : 15/msg, 40/min voc (doc). Prix raretés 10k→10M.',
  '**Boutique** — reset minuit ; ligne1 proba raretés ; CAT/CATM/CATL/CATS ; boosts 30k.',
  '**Guildes** — créa nv15, 5 slots, GXP selon nv joueur, grades Bronze→Star (starss+GR+items).',
  '**GRP ranked** — 1/msg, 3/min voc ; seuils 1k→200k ; reset 1er du mois ; pas de perte.',
  '**Séparation** — 12h recrut (&lt;25% = fail) ; 48h guerre GRP ; Star = anti-séparation.',
  '**Staff** — /passeport, points sécu 10, warns −1/−2/−5, +2 pts / 30j.',
  '**Index items** — paliers 10%→100% récompenses + coffres + rôle pipelette.',
  '**Échanges** — valeur starss & items ; bloqué si écart &gt; 40%.',
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reborn-ref')
    .setDescription('Rappel condensé des specs MAJ (lecture seule).'),
  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('MAJ REBORN — mémo')
      .setDescription(LINES.join('\n\n'))
      .setFooter({ text: 'Bot sandbox séparé de BLZbot · pas de cooldown sur ces commandes' });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
