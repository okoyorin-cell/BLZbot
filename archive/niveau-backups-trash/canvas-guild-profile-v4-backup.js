const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('node:fs');
const path = require('node:path');

// Font registration (for 'canvas' package)
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

function truncateText(ctx, text, maxWidth) {
    let width = ctx.measureText(text).width;
    if (width <= maxWidth) {
        return text;
    }
    const ellipsis = '...';
    const ellipsisWidth = ctx.measureText(ellipsis).width;
    while (width > maxWidth - ellipsisWidth && text.length > 0) {
        text = text.substring(0, text.length - 1);
        width = ctx.measureText(text).width;
    }
    return text + ellipsis;
}

async function loadBackgroundAsset(){
  const assetsPath = path.join(__dirname, '..', 'assets');
  const bgBuffer = fs.readFileSync(path.join(assetsPath, 'blz_bg.png'));
  return await loadImage(bgBuffer);
}

async function renderGuildProfileCard({ guild, members, owner, slotCost }){
  const bg = await loadBackgroundAsset();
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(bg, 0, 0, W, H);
  ctx.fillStyle = THEME.overlay; ctx.fillRect(0, 0, W, H);

  const titleFace = 'InterBold';
  const textFace = 'Inter';

  // --- Header Panel (Guild Name & Emoji) ---
  panel(ctx, 24, 24, W - 48, 120, 36, THEME.header);

  // Define fonts and spacing
  const emojiFont = `48px GuildEmoji`;
  const nameFont = `700 48px ${titleFace}, Arial`;
  const spacing = 20;

  // Measure widths
  ctx.font = emojiFont;
  const emojiWidth = ctx.measureText(guild.emoji).width;
  ctx.font = nameFont;
  const nameWidth = ctx.measureText(guild.name).width;

  // Calculate centered positions
  const totalWidth = emojiWidth + spacing + nameWidth;
  const startX = (W - totalWidth) / 2;
  const yPos = 90; // Keep original vertical position

  // Draw Emoji
  ctx.font = emojiFont;
  ctx.fillStyle = THEME.text;
  ctx.fillText(guild.emoji, startX, yPos);

  // Draw Name
  ctx.font = nameFont;
  ctx.fillStyle = THEME.text;
  ctx.fillText(guild.name, startX + emojiWidth + spacing, yPos);

  // --- Info Panels (Cost, Members, Level, Boost) ---
  const infoPanelY = 160;
  const infoPanelHeight = 100;
  const infoPanelPadding = 24; // Increased padding

  // Cost & Members Panel (Left)
  panel(ctx, 24, infoPanelY, (W / 2) - 36, infoPanelHeight, 28, THEME.panel);
  ctx.fillStyle = THEME.sub; ctx.font = `400 24px ${textFace}, Arial`;
  ctx.fillText(`prix par places: ${slotCost.toLocaleString('fr-FR')} Starss`, 24 + infoPanelPadding, infoPanelY + 36);
  ctx.fillStyle = THEME.text; ctx.font = `700 28px ${titleFace}, Arial`;
  ctx.fillText(`Membres: ${members.length} / ${guild.member_slots}`, 24 + infoPanelPadding, infoPanelY + 76);

  // Level & Boost Panel (Right)
  panel(ctx, (W / 2) + 12, infoPanelY, (W / 2) - 36, infoPanelHeight, 28, THEME.panel);
  const boost = (guild.level * 0.05).toFixed(2);
  ctx.fillStyle = THEME.text; ctx.font = `700 36px ${titleFace}, Arial`;
  ctx.fillText(`Niveau: ${guild.level}`, (W / 2) + 12 + infoPanelPadding, infoPanelY + 42);
  ctx.fillStyle = THEME.sub; ctx.font = `400 24px ${textFace}, Arial`;
  ctx.fillText(`Boost XP: +${boost}%`, (W / 2) + 12 + infoPanelPadding, infoPanelY + 76);

  // --- Member Table Panel ---
  const tablePanelY = infoPanelY + infoPanelHeight + 24;
  const tablePanelHeight = H - tablePanelY - 24;
  panel(ctx, 24, tablePanelY, W - 48, tablePanelHeight, 36, THEME.panel);

  const tableStartX = 40;
  const tableStartY = tablePanelY + 50;
  const colRankNumWidth = 80;
  const colNameWidth = 400;
  const colGuildRankWidth = 250;
  const rowHeight = 35;

  // Table Header
  ctx.fillStyle = THEME.accent; ctx.font = `700 24px ${titleFace}, GuildEmoji, Arial`;
  let currentX = tableStartX;
  ctx.fillText('#', currentX, tableStartY);
  currentX += colRankNumWidth;
  ctx.fillText('Nom', currentX, tableStartY);
  currentX += colNameWidth;
  ctx.fillText('Rang Guilde', currentX, tableStartY);
  currentX += colGuildRankWidth;
  ctx.fillText('Niveau', currentX, tableStartY);

  // Draw Separator Line
  ctx.strokeStyle = THEME.outline; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tableStartX, tableStartY + 12);
  ctx.lineTo(W - 40, tableStartY + 12);
  ctx.stroke();

  // Table Rows
  ctx.fillStyle = THEME.text; ctx.font = `400 22px ${textFace}, GuildEmoji, Arial`;
  const roleMap = {
      owner: 'Chef',
      sub_chief: 'Sous-Chef',
      member: 'Membre'
  };

  const sortedMembers = [...members].sort((a, b) => b.level - a.level);

  sortedMembers.slice(0, 8).forEach((m, index) => {
    const y = tableStartY + 40 + (index * rowHeight);
    const truncatedUsername = truncateText(ctx, m.username, colNameWidth - 20);
    const roleText = roleMap[m.role] || 'Membre';

    let currentX = tableStartX;
    ctx.fillText(`#${index + 1}`, currentX, y);
    currentX += colRankNumWidth;
    ctx.fillText(truncatedUsername, currentX, y);
    currentX += colNameWidth;
    ctx.fillText(roleText, currentX, y);
    currentX += colGuildRankWidth;
    ctx.fillText(`${m.level}`, currentX, y);
  });

  // Footer (Owner)
  ctx.fillStyle = THEME.sub; ctx.font = `400 18px ${textFace}, Arial`;
  ctx.fillText(`Chef de guilde: ${owner?.displayName || 'Inconnu'}`, 50, H - 50);

  return canvas.toBuffer('image/png');
}

module.exports = { renderGuildProfileCard };