/* eslint-disable */
const fs = require('node:fs');
const path = require('node:path');
const { renderSkillTreePng } = require('./niveau/src/utils/canvas-skill-tree-reborn');

(async () => {
  const steps = { quest: 3, guild: 5, shop: 1, ranked: 2, event: 0 };
  const noir = await renderSkillTreePng({ displayName: 'Koyorin', points: 7, steps, bg: 'noir' });
  fs.writeFileSync(path.join(__dirname, '__preview_arbre_noir.png'), noir);
  const profil = await renderSkillTreePng({ displayName: 'Koyorin', points: 7, steps, bg: 'profil' });
  fs.writeFileSync(path.join(__dirname, '__preview_arbre_profil.png'), profil);
  console.log('OK');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
