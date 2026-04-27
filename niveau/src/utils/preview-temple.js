const fs = require('fs');
const path = require('path');
const { renderTemplePng } = require('./canvas-skill-tree-reborn');

(async () => {
  const guildIconUrl =
    'https://cdn.discordapp.com/icons/1097110036192448656/5ad8d6bdcfde5986fa9e87b6a46faf17.png?size=256';
  const buf = await renderTemplePng({
    points: 320,
    keys: ['classes', 'max_rp'],
    templeUnlocked: false,
    guildIconUrl,
  });
  const out = path.join(__dirname, '_preview_temple.png');
  fs.writeFileSync(out, buf);
  console.log('wrote', out, buf.length, 'bytes');
})().catch((e) => { console.error(e); process.exit(1); });
