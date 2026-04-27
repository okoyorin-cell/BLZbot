const {
  ContainerBuilder,
  MediaGalleryBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const { getBlzAttachment } = require('./blzBackground');

/**
 * @param {import('discord.js').User} target
 * @param {object} u -- row users
 * @param {string} hub
 * @param {string[]} wlines -- warn text lines
 */
function buildPassportTextV2({ target, u, hub, wlines, blzFiles }) {
  const blz = getBlzAttachment();
  const container = new ContainerBuilder();
  if (blz) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems({ media: { url: blz.mediaUrl } }),
    );
  }
  const W = wlines.length ? wlines.map((l) => `• ${l}`).join('\n') : 'Aucun avertissement sur **ce** serveur.';
  const t = new TextDisplayBuilder().setContent(
    [
      `# 🪪 Passeport : **${target.username}**`,
      'Le **passeport** sert de **dossier staff** : on y voit le **niveau de compte « sécurité** » (points, warns), le **score tests mod** et l’**état de candidature** staff, pour décider d’un recrutement ou d’un ajustement d’accès de façon cohérente (sandbox REBORN).',
      '',
      `**Points de sécurité** : \`${u.secu_points ?? 10}\` · **Tests mod** : \`${u.mod_tests_score ?? 0} / 100\` · **Candidature** : \`${u.candidature_status ?? 'aucune'}\``,
      '',
      '**Aperçu warns (ce serveur)**',
      W.slice(0, 3000),
      '',
      '*+2 points / 30 j* si baisse liée à des warns, calcul au prochain affichage `voir`.',
    ].join('\n'),
  );
  container.addTextDisplayComponents(t);
  const cardId = `rb:ps:card:${target.id}`;
  const txtId = `rb:ps:txt:${target.id}`;
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(cardId)
        .setLabel('Carte (canvas)')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🪪'),
      new ButtonBuilder()
        .setCustomId(txtId)
        .setLabel('Cette fiche (texte)')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📄'),
    ),
  );
  const files = [];
  if (blz) files.push(blz.file);
  return { files, components: [container], flags: MessageFlags.IsComponentsV2 };
}

module.exports = { buildPassportTextV2 };
