const { SlashCommandBuilder } = require('discord.js');
const quests = require('../services/quests');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quete')
    .setDescription('Quêtes journalières / hebdo / à choix (messages sur le serveur).')
    .addSubcommand((sc) => sc.setName('voir').setDescription('Progression actuelle'))
    .addSubcommand((sc) => sc.setName('quotidienne').setDescription('Réclamer la récompense du jour'))
    .addSubcommand((sc) => sc.setName('hebdo').setDescription('Réclamer la récompense hebdomadaire'))
    .addSubcommand((sc) =>
      sc
        .setName('choisir')
        .setDescription('Choisir ta quête « à choix » de la semaine (une fois / semaine)')
        .addStringOption((o) =>
          o
            .setName('type')
            .setDescription('Quête')
            .setRequired(true)
            .addChoices(
              { name: 'Chasse 20 messages', value: 'chasse_messages' },
              { name: 'Offre 1 corail (+ récompense)', value: 'offre_corail' },
            ),
        ),
    )
    .addSubcommand((sc) => sc.setName('reclamer_selection').setDescription('Réclamer la récompense de ta quête à choix'))
    .addSubcommand((sc) => sc.setName('skip_quotidienne').setDescription('Sauter la quête du jour (consomme 1 skip — `/arbre` quête).'))
    .addSubcommand((sc) => sc.setName('skip_hebdo').setDescription('Sauter la quête hebdo (consomme 1 skip — `/arbre` quête).')),
  async execute(interaction) {
    if (!interaction.guildId) return interaction.reply({ content: 'Serveur uniquement.' });
    const sub = interaction.options.getSubcommand();
    const uid = interaction.user.id;
    if (sub === 'voir') {
      const s = quests.summary(uid);
      const multLine = s.reward_mult > 1 ? ` *(×${s.reward_mult} via arbre quête)*` : '';
      const skipsLine = s.skips_total > 0
        ? `\n**Skips** : **${s.skips_left}** / ${s.skips_total} cette semaine — \`/quete skip_quotidienne\` · \`/quete skip_hebdo\``
        : '';
      return interaction.reply({
        content:
          `**Aujourd’hui** : **${s.msgs_today}** / ${s.daily_target} messages — **${s.daily_reward.toLocaleString('fr-FR')}** starss${multLine} (${s.daily_claimed ? 'déjà pris' : 'réclamable avec \`/quete quotidienne\`'})\n` +
          `**Semaine** : **${s.week_points}** / ${s.weekly_target} pts — **${s.weekly_reward.toLocaleString('fr-FR')}** starss${multLine} (${s.weekly_claimed ? 'déjà pris' : 'réclamable avec \`/quete hebdo\`'})\n` +
          `**À choix** : ${s.selection_line}` +
          (s.selection_slots > 1 ? ` *(slots dispo : ${s.selection_slots})*` : '') +
          skipsLine + `\n` +
          `Messages (total suivi) : **${s.lifetime_msgs}**`,
      });
    }
    if (sub === 'skip_quotidienne') {
      const r = quests.skipDaily(uid);
      if (!r.ok) return interaction.reply({ content: r.error });
      return interaction.reply({
        content: `Skip daily utilisé — **+${r.reward.toLocaleString('fr-FR')}** starss. *Skips restants : ${r.skipsLeft}*`,
      });
    }
    if (sub === 'skip_hebdo') {
      const r = quests.skipWeekly(uid);
      if (!r.ok) return interaction.reply({ content: r.error });
      return interaction.reply({
        content: `Skip hebdo utilisé — **+${r.reward.toLocaleString('fr-FR')}** starss. *Skips restants : ${r.skipsLeft}*`,
      });
    }
    if (sub === 'quotidienne') {
      const r = quests.claimDaily(uid);
      if (!r.ok) return interaction.reply({ content: r.error });
      return interaction.reply({
        content: `Récompense quotidienne : **+${r.reward.toLocaleString('fr-FR')}** starss.`,
      });
    }
    if (sub === 'hebdo') {
      const r = quests.claimWeekly(uid);
      if (!r.ok) return interaction.reply({ content: r.error });
      return interaction.reply({
        content: `Récompense hebdo : **+${r.reward.toLocaleString('fr-FR')}** starss.`,
      });
    }
    if (sub === 'choisir') {
      const key = interaction.options.getString('type', true);
      const r = quests.pickSelection(uid, key);
      if (!r.ok) return interaction.reply({ content: r.error });
      return interaction.reply({
        content: `Quête activée : **${r.def.label}**. Récompense **${r.def.reward.toLocaleString('fr-FR')}** starss (voir \`/quete voir\` puis \`/quete reclamer_selection\`).`,
      });
    }
    if (sub === 'reclamer_selection') {
      const r = quests.claimSelection(uid);
      if (!r.ok) return interaction.reply({ content: r.error });
      return interaction.reply({
        content: `**${r.label}** — **+${r.reward.toLocaleString('fr-FR')}** starss.`,
      });
    }
  },
};
