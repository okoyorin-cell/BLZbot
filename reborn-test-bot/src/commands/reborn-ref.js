const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reborn-ref')
    .setDescription('Récap modules REBORN sur ce bot de test (pas BLZbot prod).'),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('REBORN — bot de test')
      .setColor(0x9b59b6)
      .setDescription(
        [
          '**Économie** — `/solde`, `/payer`, `/daily`, `/money` ; gains msg + vocal ; boosts.',
          '**Boutique** — `/boutique` (slots, coffres CAT*, boosts).',
          '**Guilde joueur** — `/guilde` (créer, trésor, perms, focus, expulsion, transfert, dissolution…) + **`/profil-guilde`** (fiche embed, nom ou ID optionnel).',
          '**Miroir slash BLZbot** — avec `REBORN_MIRROR_NIVEAU_SLASH=1` (défaut), les slash **niveau** (core/guilde/admin/misc) sont aussi déployés ici ; sans code local → message pour utiliser BLZbot (plafond **100** commandes Discord).',
          '**GRP** — `/grp voir` + `/grp classement` ; reset mensuel auto + pics (grades guilde).',
          '**Séparation** — `/separation` + tick 60s.',
          '**Échanges** — `/echange` règle 40 % (starss + objets `item:qty`).',
          '**Index** — `/itemindex`.',
          '**Quêtes** — `/quete` voir, quotidienne, hebdo, **choisir**, **reclamer_selection**.',
          '**Trophées** — `/trophees`. **Hacker** — `/hacker`.',
          '**Staff** — `/passeport`, `/warn`, `/purge`.',
          '',
          '_Données : `reborn-test-bot` + SQLite `data/reborn.sqlite`._',
        ].join('\n'),
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
