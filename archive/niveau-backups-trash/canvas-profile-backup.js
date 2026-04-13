const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('node:fs');
const path = require('node:path');

try {
  const assetsPath = path.join(__dirname, '..', 'assets');
  if (fs.existsSync(path.join(assetsPath, 'Inter-Bold.ttf'))) {
      registerFont(path.join(assetsPath, 'Inter-Bold.ttf'), { family: 'InterBold' });
  }
  if (fs.existsSync(path.join(assetsPath, 'Inter-Regular.ttf'))) {
      registerFont(path.join(assetsPath, 'Inter-Regular.ttf'), { family: 'Inter' });
  }
  const fontsPath = path.join(__dirname, '..', 'assets', 'fonts');
  if (fs.existsSync(path.join(fontsPath, 'emojis.ttf'))) {
      registerFont(path.join(fontsPath, 'emojis.ttf'), { family: 'GuildEmoji' });
  }
} catch(e) {
    console.error("Could not register fonts", e)
}

const W = 1200, H = 700;
const THEME = {
  overlay: 'rgba(0,0,0,0.40)',
  panel: 'rgba(0,0,0,0.62)',
  header: 'rgba(0,0,0,0.58)',
  text: '#ffffff',
  sub: '#f2d7d3',
  accent: '#ffd166',
  outline: 'rgba(255,255,255,0.43)'
};

function rr(ctx, x, y, w, h, r){
  const R = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+R, y);
  ctx.arcTo(x+w, y, x+w, y+h, R);
  ctx.arcTo(x+w, y+h, x, y+h, R);
  ctx.arcTo(x, y+h, x, y, R);
  ctx.arcTo(x, y, x+w, y, R);
  ctx.closePath();
}

function panel(ctx, x,y,w,h,r, fill=THEME.panel){
  rr(ctx,x,y,w,h,r);
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = THEME.outline; ctx.lineWidth = 3; ctx.stroke();
}

async function loadAssets(){
  const assetsPath = path.join(__dirname, '..', 'assets');
  const bgBuffer = fs.readFileSync(path.join(assetsPath, 'blz_bg.png'));
  const dollarBuffer = fs.readFileSync(path.join(assetsPath, 'dollar.png'));
  const bg = await loadImage(bgBuffer);
  const dollar = await loadImage(dollarBuffer);
  return { bg, dollar };
}

function drawDollarWhite(ctx, img, x, y, size){
  const off = createCanvas(size, size);
  const o = off.getContext('2d');
  o.drawImage(img, 0, 0, size, size);
  o.globalCompositeOperation = 'source-in';
  o.fillStyle = '#ffffff';
  o.fillRect(0,0,size,size);
  ctx.drawImage(off, x, y);
}

async function drawRankChip(ctx, text, cx, y, iconPath) {
    let icon = null;
    const iconSize = 48;
    const iconPadding = 10;
    try {
        const iconBuffer = fs.readFileSync(iconPath);
        icon = await loadImage(iconBuffer);
    } catch (e) { console.error(`Could not load rank icon: ${iconPath}`, e); }

    const iconWidthWithPadding = icon ? iconSize + iconPadding : 0;

    let fontSize = 32;
    const face = 'InterBold';
    ctx.font = `700 ${fontSize}px ${face}, Arial`;
    const maxW = 460;
    const padX = 22, r = 26, h = 64;

    let textWidth = ctx.measureText(text).width;
    while (textWidth + iconWidthWithPadding + padX * 2 > maxW && fontSize > 18) {
        fontSize -= 1;
        ctx.font = `700 ${fontSize}px ${face}, Arial`;
        textWidth = ctx.measureText(text).width;
    }

    const panelWidth = Math.ceil(Math.min(maxW, textWidth + iconWidthWithPadding + padX * 2));
    const panelX = Math.round(cx - panelWidth / 2);

    const contentWidth = textWidth + iconWidthWithPadding;
    const contentStartX = panelX + (panelWidth - contentWidth) / 2;

    const iconX = contentStartX;
    const textX = contentStartX + iconWidthWithPadding;
    const contentY = y + h / 2;

    panel(ctx, panelX, y, panelWidth, h, r, 'rgba(0,0,0,0.70)');

    if (icon) {
        ctx.drawImage(icon, iconX, contentY - iconSize / 2, iconSize, iconSize);
    }

    ctx.fillStyle = THEME.text;
    ctx.font = `700 ${fontSize}px ${face}, Arial`;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, textX, contentY);
}

async function renderProfileCard({ user, member, achievements, quests, rank, nextRank, highestRoleName, rankIconPath }){
  const { bg, dollar } = await loadAssets();
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(bg, 0, 0, W, H);
  ctx.fillStyle = THEME.overlay; ctx.fillRect(0,0,W,H);

  const titleFace = 'InterBold';
  const textFace  = 'Inter';

  panel(ctx, 24, 24, W-48, 160, 36, THEME.header);

  const avatarURL = member?.displayAvatarURL({ extension: 'png', size: 256 });
  let avImg = null; try { avImg = avatarURL ? await loadImage(avatarURL) : null; } catch {}
  const avX=50,avY=44,avS=96;
  ctx.save(); rr(ctx,avX,avY,avS,avS,avS/2); ctx.clip();
  if (avImg) ctx.drawImage(avImg,avX,avY,avS,avS); else { ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.fillRect(avX,avY,avS,avS); }
  ctx.restore();

  ctx.fillStyle = THEME.text; ctx.font = `700 42px ${titleFace}, Arial`;
  ctx.fillText(member?.displayName ?? 'Utilisateur', 170, 86);

  ctx.fillStyle = THEME.sub; ctx.font = `400 22px ${textFace}, Arial`;
  ctx.fillText(highestRoleName, 170, 114);

  const starsY = 94;
  const starsText = `${user.stars.toLocaleString('fr-FR')} Starss`;
  const starsRightAnchor = W - 50; // Anchor the right edge 50px from the canvas edge
  const iconSpacing = 10;
  const iconSize = 28;

  // Set text alignment to right
  ctx.textAlign = 'right';
  ctx.fillStyle = THEME.text;
  ctx.font = `700 30px ${titleFace}, Arial`;

  // Draw the text
  ctx.fillText(starsText, starsRightAnchor, starsY);

  // Measure the text to position the icon to its left
  const textWidth = ctx.measureText(starsText).width;
  const iconX = starsRightAnchor - textWidth - iconSpacing - iconSize;

  // Draw the icon
  drawDollarWhite(ctx, dollar, iconX, starsY - iconSize, iconSize);

  // Reset text alignment
  ctx.textAlign = 'left';

  const progressRatio = Math.max(0, Math.min(1, user.xp / Math.max(1, user.xp_needed)));
  const x0=50,y0=198,w=W-100,h=32; // Adjusted for better presence
  rr(ctx,x0,y0,w,h,16); ctx.fillStyle='rgba(255,255,255,0.43)'; ctx.fill();
  rr(ctx,x0,y0,Math.max(h,Math.round(w*progressRatio)),h,16); ctx.fillStyle=THEME.accent; ctx.fill();

  // Level Text
  ctx.fillStyle = THEME.text; ctx.font = `700 20px ${titleFace}, Arial`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(`Niveau ${user.level}`, x0 + 20, y0 + h / 2);

  // XP Text
  const xpText = `${user.xp.toLocaleString('fr-FR')} / ${user.xp_needed.toLocaleString('fr-FR')}`;
  ctx.font = `700 20px ${titleFace}, Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillText(xpText, x0 + w / 2, y0 + h / 2 + 1); // Shadow
  ctx.fillStyle = THEME.text;
  ctx.fillText(xpText, x0 + w / 2, y0 + h / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  await drawRankChip(ctx, `Rang: ${rank.name}`, W/2, 238, rankIconPath);

  // Points text
  const pointsText = nextRank
      ? `${user.points.toLocaleString('fr-FR')} / ${nextRank.points.toLocaleString('fr-FR')} Points`
      : `${user.points.toLocaleString('fr-FR')} Points (Max)`;

  ctx.font = `400 18px ${textFace}, Arial`;
  ctx.fillStyle = THEME.sub;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(pointsText, W / 2, 238 + 64 + 8); // chipY + chipH + padding
  ctx.textBaseline = 'alphabetic'; // reset
  ctx.textAlign = 'left'; // reset

  panel(ctx, 36, 330, 324, 330, 30, THEME.panel);
  ctx.fillStyle = THEME.text; ctx.font = `700 30px ${titleFace}, Arial`; ctx.fillText('Succès', 56, 360);
  ctx.fillStyle = THEME.text; ctx.font = `400 22px ${textFace}, Arial`;
  achievements.slice(0,5).forEach((a,i)=> ctx.fillText(`- ${a}`, 56, 398 + i*56));

  panel(ctx, W-360, 330, 324, 330, 30, THEME.panel);
  ctx.fillStyle = THEME.text; ctx.font = `700 30px ${titleFace}, Arial`; ctx.fillText('Quêtes', W-340, 360);
  ctx.fillStyle = THEME.text; ctx.font = `400 22px ${textFace}, Arial`;
  quests.slice(0,5).forEach((q,i)=> ctx.fillText(`- ${q}`, W-340, 398 + i*52));

  // Guilde
  const guildName = user.guild_name || 'Aucune Guilde';
  const guildLevel = user.guild_level || 1;
  const guildEmoji = user.guild_emoji || '🛡️';
  panel(ctx, 420, 420, 360, 240, 34, THEME.panel);
  ctx.textAlign = 'center';
  ctx.fillStyle = THEME.text; ctx.font = `700 30px ${titleFace}, Arial`; ctx.fillText(guildName, 600, 460);
  ctx.fillStyle = THEME.text; ctx.font = `400 22px ${textFace}, Arial`; ctx.fillText(`Niveau de guilde : ${guildLevel}`, 600, 494);
  
  // Draw emoji instead of 'G'
  ctx.font = `90px GuildEmoji`; // Use a generic font that supports emojis
  ctx.fillText(guildEmoji, 600, 585);
  ctx.textAlign = 'left'; // Reset alignment

  return canvas.toBuffer('image/png');
}

module.exports = { renderProfileCard };
