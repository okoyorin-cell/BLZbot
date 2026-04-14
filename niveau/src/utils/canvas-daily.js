const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('node:fs');
const path = require('node:path');

let sharpMod = null;
try {
  sharpMod = require('sharp');
} catch {
  /* optionnel */
}

const FALLBACK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhwI/pW7Y1QAAAABJRU5ErkJggg==',
  'base64'
);

let _fallbackImage = null;
async function getFallbackImage() {
  if (_fallbackImage) return _fallbackImage;
  _fallbackImage = await loadImage(FALLBACK_PNG);
  return _fallbackImage;
}

const _badImages = new Set();
async function loadImageSafe(filePath) {
  const useFallback = async () => {
    try {
      return await getFallbackImage();
    } catch {
      return null;
    }
  };

  if (!filePath || !fs.existsSync(filePath)) {
    return useFallback();
  }

  try {
    const buf = fs.readFileSync(filePath);
    if (buf.length < 24) return useFallback();
    
    if (buf.slice(0, 64).toString('utf8').includes('version https://git-lfs')) {
      if (!_badImages.has(filePath)) {
        _badImages.add(filePath);
      }
      return useFallback();
    }

    return await loadImage(buf);
  } catch {
    if (sharpMod) {
      try {
        const png = await sharpMod(buf).png().toBuffer();
        return await loadImage(png);
      } catch {
        /* ignore */
      }
    }
  }

  return useFallback();
}

try {
  const assetsPath = path.join(__dirname, '..', 'assets');
  if (fs.existsSync(path.join(assetsPath, 'Inter-Bold.ttf'))) {
    registerFont(path.join(assetsPath, 'Inter-Bold.ttf'), { family: 'InterBold' });
  }
  if (fs.existsSync(path.join(assetsPath, 'Inter-Regular.ttf'))) {
    registerFont(path.join(assetsPath, 'Inter-Regular.ttf'), { family: 'Inter' });
  }
} catch (e) {
  console.error("Could not register fonts", e)
}

const W = 1200, H = 800;
const THEME = {
  overlay: 'rgba(0,0,0,0.40)',
  panel: 'rgba(0,0,0,0.62)',
  header: 'rgba(0,0,0,0.58)',
  text: '#ffffff',
  sub: '#f2d7d3',
  accent: '#ffd166',
  outline: 'rgba(255,255,255,0.43)',
  gold: '#FFD700',
  success: '#4ade80',
  error: '#ff4444'
};

function rr(ctx, x, y, w, h, r) {
  const R = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + R, y);
  ctx.arcTo(x + w, y, x + w, y + h, R);
  ctx.arcTo(x + w, y + h, x, y + h, R);
  ctx.arcTo(x, y + h, x, y, R);
  ctx.arcTo(x, y, x + w, y, R);
  ctx.closePath();
}

function panel(ctx, x, y, w, h, r, fill = THEME.panel) {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = THEME.outline;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function truncateText(ctx, text, maxWidth) {
  let width = ctx.measureText(text).width;
  if (width <= maxWidth) return text;
  const ellipsis = '...';
  const ellipsisWidth = ctx.measureText(ellipsis).width;
  while (width > maxWidth - ellipsisWidth && text.length > 0) {
    text = text.substring(0, text.length - 1);
    width = ctx.measureText(text).width;
  }
  return text + ellipsis;
}

async function loadAssets() {
  const assetsPath = path.join(__dirname, '..', 'assets');
  const bgBuffer = fs.readFileSync(path.join(assetsPath, 'blz_bg.png'));
  const bg = await loadImage(bgBuffer);
  return { bg };
}

async function renderDailyCard({
  username = 'Utilisateur',
  displayName = 'Utilisateur',
  highestRoleName = 'Membre',
  avatarURL = null,
  rewardName = '',
  rewardType = '',
  rewardAmount = null,
  rewardEmoji = '🎁',
  remainingTime = '',
  doubleDailyCount = 0,
  isSuccess = true
}) {
  const { bg } = await loadAssets();
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(bg, 0, 0, W, H);
  ctx.fillStyle = THEME.overlay;
  ctx.fillRect(0, 0, W, H);

  const titleFace = 'InterBold';
  const textFace = 'Inter';

  // ============================================
  // HEADER PANEL (style profile)
  // ============================================
  panel(ctx, 24, 24, W - 48, 160, 36, THEME.header);

  // Avatar
  let avImg = null;
  if (avatarURL) {
    try {
      avImg = await loadImage(avatarURL);
    } catch {
      /* ignore */
    }
  }

  const avX = 50, avY = 44, avS = 96;
  ctx.save();
  rr(ctx, avX, avY, avS, avS, avS / 2);
  ctx.clip();
  if (avImg) {
    ctx.drawImage(avImg, avX, avY, avS, avS);
  } else {
    ctx.fillStyle = THEME.accent;
    ctx.fillRect(avX, avY, avS, avS);
    ctx.font = '50px Arial';
    ctx.fillStyle = THEME.header;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👤', avX + avS / 2, avY + avS / 2);
  }
  ctx.restore();

  // Display name
  ctx.fillStyle = THEME.text;
  ctx.font = `700 42px ${titleFace}, Arial`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const displayNameTrunc = truncateText(ctx, displayName, 600);
  ctx.fillText(displayNameTrunc, 170, 92);

  // Rôle
  ctx.fillStyle = THEME.sub;
  ctx.font = `400 22px ${textFace}, Arial`;
  ctx.fillText(highestRoleName, 170, 128);

  // ============================================
  // MAIN CONTENT PANEL
  // ============================================
  panel(ctx, 50, 220, W - 100, 550, 36, THEME.panel);

  if (isSuccess) {
    // SUCCESS CONTENT
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Grand emoji
    ctx.font = '140px Arial';
    ctx.fillText(THEME.gold, rewardEmoji, W / 2, 360);

    // Nom de la récompense
    ctx.font = `700 48px ${titleFace}, Arial`;
    ctx.fillStyle = THEME.accent;
    const rewardNameTrunc = truncateText(ctx, rewardName, 750);
    ctx.fillText(rewardNameTrunc, W / 2, 450);

    // Montant
    if (rewardAmount !== null && rewardType !== 'item') {
      ctx.font = `600 40px ${titleFace}, Arial`;
      ctx.fillStyle = THEME.gold;
      
      let amountText = '';
      switch (rewardType) {
        case 'stars':
          amountText = `+ ${rewardAmount.toLocaleString('fr-FR')} ⭐`;
          break;
        case 'xp':
          amountText = `+ ${rewardAmount.toLocaleString('fr-FR')} 🚀`;
          break;
        case 'points':
          amountText = `+ ${rewardAmount.toLocaleString('fr-FR')} 🏆`;
          break;
      }
      ctx.fillText(amountText, W / 2, 520);
    }

    // Statut
    ctx.font = `600 24px ${titleFace}, Arial`;
    ctx.fillStyle = THEME.success;
    ctx.fillText('✅ Récompense Obtenue !', W / 2, 600);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

  } else {
    // COOLDOWN CONTENT

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Temps restant - GRAND
    ctx.font = `700 72px ${titleFace}, Arial`;
    ctx.fillStyle = THEME.error;
    ctx.fillText(remainingTime, W / 2, 360);

    ctx.font = `500 24px ${textFace}, Arial`;
    ctx.fillStyle = THEME.sub;
    ctx.fillText('Temps restant avant la prochaine récompense', W / 2, 430);

    // Double Daily info
    if (doubleDailyCount > 0) {
      ctx.font = `600 20px ${titleFace}, Arial`;
      ctx.fillStyle = THEME.gold;
      ctx.fillText(`💡 Vous avez ${doubleDailyCount} Double Daily`, W / 2, 500);
      
      ctx.font = `400 16px ${textFace}, Arial`;
      ctx.fillStyle = THEME.sub;
      ctx.fillText('Utilisez /inventaire pour réclamer une deuxième récompense', W / 2, 535);
    } else {
      ctx.font = `500 18px ${textFace}, Arial`;
      ctx.fillStyle = THEME.sub;
      ctx.fillText('Obtenez des Double Daily via les quêtes et événements', W / 2, 500);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  return canvas.toBuffer('image/png');
}

module.exports = { renderDailyCard };