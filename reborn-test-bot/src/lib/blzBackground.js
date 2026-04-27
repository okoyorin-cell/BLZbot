const fs = require('node:fs');
const path = require('node:path');
const { AttachmentBuilder } = require('discord.js');

const REPO = path.join(__dirname, '..', '..', '..');
const BLZ = path.join(REPO, 'niveau', 'src', 'assets', 'blz_bg.png');
const BOUTIQUE = path.join(REPO, 'niveau', 'src', 'assets', 'boutique_bg.png');
const AT_NAME = 'reborn_blz_bg.png';
const AT_NAME_BOUTIQUE = 'reborn_boutique_bg.png';

/**
 * Bannière identique au profil (`niveau/src/assets/blz_bg.png`).
 * @returns {{ file: import('discord.js').AttachmentBuilder, name: string, mediaUrl: string } | null}
 */
function getBlzAttachment() {
  if (!fs.existsSync(BLZ)) return null;
  const file = new AttachmentBuilder(fs.readFileSync(BLZ), { name: AT_NAME });
  return { file, name: AT_NAME, mediaUrl: `attachment://${AT_NAME}` };
}

/**
 * Bannière dédiée à la boutique (`niveau/src/assets/boutique_bg.png`).
 * Fallback sur la bannière BLZ si jamais le fichier dédié manque.
 * @returns {{ file: import('discord.js').AttachmentBuilder, name: string, mediaUrl: string } | null}
 */
function getBoutiqueAttachment() {
  if (fs.existsSync(BOUTIQUE)) {
    const file = new AttachmentBuilder(fs.readFileSync(BOUTIQUE), { name: AT_NAME_BOUTIQUE });
    return { file, name: AT_NAME_BOUTIQUE, mediaUrl: `attachment://${AT_NAME_BOUTIQUE}` };
  }
  return getBlzAttachment();
}

module.exports = { getBlzAttachment, getBoutiqueAttachment, BLZ, BOUTIQUE };
