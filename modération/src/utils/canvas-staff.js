const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('node:fs');
const path = require('node:path');

// Tentative de chargement des polices
try {
  const assetsPath = path.join(__dirname, '..', 'assets');
  if (fs.existsSync(path.join(assetsPath, 'Inter-Bold.ttf'))) {
    registerFont(path.join(assetsPath, 'Inter-Bold.ttf'), { family: 'InterBold' });
  }
  if (fs.existsSync(path.join(assetsPath, 'Inter-Regular.ttf'))) {
    registerFont(path.join(assetsPath, 'Inter-Regular.ttf'), { family: 'Inter' });
  }
} catch (e) {
  console.error("Could not register fonts", e);
}

const W = 1200, H = 900;
const THEME = {
  overlay: 'rgba(0,0,0,0.40)',
  panel: 'rgba(0,0,0,0.62)',
  header: 'rgba(0,0,0,0.58)',
  text: '#ffffff',
  sub: '#f2d7d3',
  accent: '#ffd166', // Jaune pour Staff
  memberAccent: '#4fc3f7', // Bleu clair pour Membre
  warning: '#ff4444',
  success: '#4caf50',
  outline: 'rgba(255,255,255,0.15)',
  staffRole: '#5865F2'
};

// Utilitaires de dessin
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
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = THEME.outline; ctx.lineWidth = 2; ctx.stroke();
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
  let bg = null;
  try {
    const bgBuffer = fs.readFileSync(path.join(assetsPath, 'profile.png'));
    bg = await loadImage(bgBuffer);
  } catch (e) {
    // Pas de background, on utilisera une couleur unie
  }
  return { bg };
}

function formatDate(timestamp) {
  if (!timestamp) return 'Non défini';
  const date = new Date(timestamp);
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(timestamp) {
  if (!timestamp) return 'Non défini';
  const date = new Date(timestamp);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getTimeRemaining(endTimestamp) {
  const now = Date.now();
  const diff = endTimestamp - now;
  if (diff <= 0) return 'Terminé';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}j ${hours}h restant(s)`;
  return `${hours}h restant(s)`;
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0];
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

// ==========================================
// RENDER STAFF PROFILE (Fonction existante)
// ==========================================
async function renderStaffProfileCard(data) {
  const { bg } = await loadAssets();
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background
  if (bg) {
    ctx.drawImage(bg, 0, 0, W, H);
  } else {
    ctx.fillStyle = '#23272A';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.fillStyle = THEME.overlay; ctx.fillRect(0, 0, W, H);

  const titleFace = 'InterBold';
  const textFace = 'Inter';

  // ... (Le reste de la logique Staff reste identique, je réintègre le code pour ne rien casser)
  // HEADER
  panel(ctx, 24, 24, W - 48, 140, 36, THEME.header);
  const avatarURL = data.member?.displayAvatarURL({ extension: 'png', size: 256 });
  let avImg = null; try { avImg = avatarURL ? await loadImage(avatarURL) : null; } catch { }
  const avX = 50, avY = 44, avS = 96;
  ctx.save(); rr(ctx, avX, avY, avS, avS, avS / 2); ctx.clip();
  if (avImg) ctx.drawImage(avImg, avX, avY, avS, avS);
  else { ctx.fillStyle = '#99aab5'; ctx.fillRect(avX, avY, avS, avS); }
  ctx.restore();

  ctx.fillStyle = THEME.text; ctx.font = `700 42px ${titleFace}, Arial`;
  ctx.fillText(data.member?.displayName ?? 'Utilisateur', 170, 80);
  ctx.fillStyle = THEME.staffRole; ctx.font = `600 24px ${textFace}, Arial`;
  ctx.fillText(data.staffRole, 170, 110);

  // Sensitivity
  ctx.textAlign = 'right'; ctx.font = `600 20px ${titleFace}, Arial`;
  if (data.inSensitivity) {
    ctx.fillStyle = THEME.warning; ctx.fillText('Sensibilité: OUI', W - 50, 80);
    ctx.fillStyle = THEME.sub; ctx.font = `400 16px ${textFace}, Arial`;
    ctx.fillText(`Jusqu'au ${formatDate(data.sensitivityEnd)}`, W - 50, 105);
  } else {
    ctx.fillStyle = '#888888'; ctx.fillText('Sensibilité: NON', W - 50, 80);
  }
  ctx.textAlign = 'left';

  // Stats Générales
  const statsY = 190;
  panel(ctx, 24, statsY, W - 48, 160, 36, THEME.panel);
  ctx.fillStyle = THEME.accent; ctx.font = `700 28px ${titleFace}, Arial`;
  ctx.fillText('📊 Statistiques', 60, statsY + 45);

  const statX1 = 60, statX2 = W / 2 + 20;
  const candAccepted = data.candidatures.filter(c => c.status === 'accepte').length;
  const candRejected = data.candidatures.filter(c => c.status === 'refuse').length;

  ctx.fillStyle = THEME.text; ctx.font = `600 20px ${textFace}, Arial`;
  ctx.fillText(`📝 Historique Candidatures: ${data.candidatures.length} (${candAccepted} ✅ / ${candRejected} ❌)`, statX1, statsY + 85);
  ctx.fillStyle = THEME.accent; ctx.font = `600 18px ${textFace}, Arial`;
  ctx.fillText(`   ➡️ Chances actuelles: ${data.candidatureChances}/2`, statX1, statsY + 107);

  const modoTestAccepted = data.modoTestPeriods.filter(p => p.result === 'accepte').length;
  const modoTestRejected = data.modoTestPeriods.filter(p => p.result === 'refuse').length;

  ctx.fillStyle = THEME.text; ctx.font = `600 20px ${textFace}, Arial`;
  ctx.fillText(`🎓 Historique Modo Tests: ${data.modoTestPeriods.length} (${modoTestAccepted} ✅ / ${modoTestRejected} ❌)`, statX1, statsY + 142);
  ctx.fillStyle = THEME.accent; ctx.font = `600 18px ${textFace}, Arial`;
  ctx.fillText(`   ➡️ Chances actuelles: ${data.modoTestChances}/1`, statX1, statsY + 164);

  ctx.fillStyle = THEME.text; ctx.font = `600 20px ${textFace}, Arial`;
  ctx.fillText(`⚖️ Sanctions émises: ${data.sanctions}`, statX2, statsY + 85);
  ctx.fillStyle = data.staffWarns > 0 ? THEME.warning : THEME.text;
  ctx.fillText(`⚠️ Warns Staff: ${data.staffWarns}`, statX2, statsY + 120);

  // Modo Test en cours
  const modoTestY = 390;
  const currentModoTest = data.modoTestPeriods.find(p => p.status === 'en_cours' || p.status === 'vote_en_cours');
  if (currentModoTest) {
    const isVoting = currentModoTest.status === 'vote_en_cours';
    panel(ctx, 24, modoTestY, W - 48, 100, 36, isVoting ? 'rgba(255, 170, 0, 0.2)' : 'rgba(94, 129, 244, 0.2)');
    ctx.fillStyle = isVoting ? '#FFAA00' : '#5E81F4'; ctx.font = `700 26px ${titleFace}, Arial`;
    ctx.fillText(isVoting ? '🗳️ Vote de Promotion en Cours' : '🎓 Modo Test en Cours', 60, modoTestY + 40);
    ctx.fillStyle = THEME.text; ctx.font = `400 18px ${textFace}, Arial`;
    ctx.fillText(`Début: ${formatDate(currentModoTest.start_date)}`, 60, modoTestY + 70);
    ctx.fillText(`Fin: ${formatDate(currentModoTest.end_date)}`, 350, modoTestY + 70);
    ctx.fillStyle = THEME.accent; ctx.font = `600 18px ${titleFace}, Arial`;
    ctx.fillText(isVoting ? 'Vote ouvert' : getTimeRemaining(currentModoTest.end_date), 640, modoTestY + 70);
  }

  // Promotions et Appréciations
  const promoY = currentModoTest ? 520 : 390;
  const promoH = currentModoTest ? 340 : 470;

  // Historique Postes
  panel(ctx, 24, promoY, (W - 72) / 2, promoH, 36, THEME.panel);
  ctx.fillStyle = THEME.accent; ctx.font = `700 26px ${titleFace}, Arial`;
  ctx.fillText('📅 Historique des Postes', 60, promoY + 45);
  if (data.promotions.length === 0) {
    ctx.fillStyle = THEME.sub; ctx.font = `400 18px ${textFace}, Arial`;
    ctx.fillText('Aucune promotion enregistrée', 60, promoY + 85);
  } else {
    const promoLineH = 32;
    data.promotions.slice(0, 10).forEach((promo, i) => {
      const y = promoY + 85 + (i * promoLineH);
      ctx.fillStyle = THEME.text; ctx.font = `600 18px ${textFace}, Arial`;
      ctx.fillText(truncateText(ctx, promo.role_name, 300), 60, y);
      ctx.fillStyle = THEME.sub; ctx.font = `400 16px ${textFace}, Arial`;
      ctx.fillText(formatDate(promo.date), 380, y);
    });
  }

  // Appréciations
  const apprX = 24 + (W - 72) / 2 + 24;
  panel(ctx, apprX, promoY, (W - 72) / 2, promoH, 36, THEME.panel);
  ctx.fillStyle = THEME.accent; ctx.font = `700 26px ${titleFace}, Arial`;
  ctx.fillText('💬 Appréciations', apprX + 36, promoY + 45);
  if (data.appreciations.length === 0) {
    ctx.fillStyle = THEME.sub; ctx.font = `400 18px ${textFace}, Arial`;
    ctx.fillText('Aucune appréciation', apprX + 36, promoY + 85);
  } else {
    const apprLineH = 90;
    data.appreciations.slice(0, 5).forEach((appr, i) => {
      const y = promoY + 85 + (i * apprLineH);
      ctx.fillStyle = THEME.text; ctx.font = `600 16px ${textFace}, Arial`;
      ctx.fillText(formatDate(appr.date), apprX + 36, y);
      ctx.fillStyle = THEME.sub; ctx.font = `400 15px ${textFace}, Arial`;
      const lines = wrapText(ctx, appr.appreciation, ((W - 72) / 2) - 72);
      lines.slice(0, 3).forEach((line, li) => ctx.fillText(line, apprX + 36, y + 22 + (li * 18)));
    });
  }

  return canvas.toBuffer('image/png');
}

// ==========================================
// RENDER MEMBER PROFILE (Nouvelle Fonction)
// ==========================================
async function renderMemberProfileCard({ user, member, stats, lastSanction, moderatorName }) {
  const { bg } = await loadAssets();
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const titleFace = 'InterBold';
  const textFace = 'Inter';

  // 1. Background
  if (bg) {
    ctx.drawImage(bg, 0, 0, W, H);
  } else {
    ctx.fillStyle = '#1a1c1e'; // Plus sombre que staff
    ctx.fillRect(0, 0, W, H);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; // Overlay plus sombre
  ctx.fillRect(0, 0, W, H);

  // 2. Header (Identité)
  panel(ctx, 24, 24, W - 48, 150, 36, 'rgba(255,255,255,0.05)');

  // Avatar
  const avatarURL = member?.displayAvatarURL({ extension: 'png', size: 256 }) || user.displayAvatarURL({ extension: 'png', size: 256 });
  let avImg = null; try { avImg = await loadImage(avatarURL); } catch { }

  const avX = 50, avY = 49, avS = 100;
  ctx.save(); rr(ctx, avX, avY, avS, avS, avS / 2); ctx.clip();
  if (avImg) ctx.drawImage(avImg, avX, avY, avS, avS);
  else { ctx.fillStyle = '#7289da'; ctx.fillRect(avX, avY, avS, avS); };
  ctx.restore();

  // Infos User
  ctx.fillStyle = THEME.text;
  ctx.font = `700 46px ${titleFace}, Arial`;
  ctx.fillText(user.username, 180, 90);

  ctx.fillStyle = THEME.sub;
  ctx.font = `400 20px ${textFace}, Arial`;
  ctx.fillText(`ID: ${user.id}`, 180, 125);

  // Badge "Membre" ou Role principal
  const mainRole = member ? member.roles.highest.name : 'Utilisateur';
  const roleColor = member ? member.roles.highest.hexColor : '#99aab5';

  ctx.textAlign = 'right';
  ctx.fillStyle = roleColor === '#000000' ? THEME.memberAccent : roleColor;
  ctx.font = `600 28px ${titleFace}, Arial`;
  ctx.fillText(mainRole.toUpperCase(), W - 50, 90);
  ctx.textAlign = 'left';

  // 3. Colonne Gauche : Infos & Rôles
  const col1X = 24;
  const col1W = 400;
  const contentY = 200;

  // Dates Panel
  panel(ctx, col1X, contentY, col1W, 200, 24, THEME.panel);
  ctx.fillStyle = THEME.memberAccent;
  ctx.font = `700 24px ${titleFace}, Arial`;
  ctx.fillText('📅 Dates Clefs', col1X + 30, contentY + 45);

  ctx.fillStyle = '#aaaaaa';
  ctx.font = `400 18px ${textFace}, Arial`;
  ctx.fillText('Compte créé le :', col1X + 30, contentY + 90);
  ctx.fillStyle = THEME.text;
  ctx.font = `600 20px ${textFace}, Arial`;
  ctx.fillText(formatDate(user.createdTimestamp), col1X + 30, contentY + 115);

  if (member) {
    ctx.fillStyle = '#aaaaaa';
    ctx.font = `400 18px ${textFace}, Arial`;
    ctx.fillText('Rejoint le :', col1X + 210, contentY + 90);
    ctx.fillStyle = THEME.text;
    ctx.font = `600 20px ${textFace}, Arial`;
    ctx.fillText(formatDate(member.joinedTimestamp), col1X + 210, contentY + 115);
  }

  // Roles Panel
  const rolesY = contentY + 224;
  panel(ctx, col1X, rolesY, col1W, 452, 24, THEME.panel);
  ctx.fillStyle = THEME.memberAccent;
  ctx.font = `700 24px ${titleFace}, Arial`;
  ctx.fillText('🎭 Rôles', col1X + 30, rolesY + 45);

  if (member) {
    const roles = member.roles.cache
      .filter(r => r.name !== '@everyone')
      .sort((a, b) => b.position - a.position)
      .first(12); // Top 12 roles

    roles.forEach((role, i) => {
      const ry = rolesY + 90 + (i * 30);
      ctx.fillStyle = role.hexColor === '#000000' ? '#ffffff' : role.hexColor;
      ctx.font = `500 18px ${textFace}, Arial`;
      ctx.fillText(truncateText(ctx, role.name, 340), col1X + 30, ry);
    });

    if (member.roles.cache.size > 12) {
      ctx.fillStyle = '#888888';
      ctx.fillText(`... et ${member.roles.cache.size - 13} autres`, col1X + 30, rolesY + 90 + (12 * 30));
    }
  }

  // 4. Colonne Droite : Statistiques
  const col2X = 448;
  const col2W = W - col2X - 24;

  // Stats Grid
  // On divise en 4 boites : Warns, Mutes, Bans, Notes
  const boxW = (col2W - 24) / 2;
  const boxH = 180;

  // Helper pour boite de stat
  const drawStatBox = (x, y, label, count, color, icon) => {
    panel(ctx, x, y, boxW, boxH, 24, 'rgba(255,255,255,0.03)');

    // Indicateur couleur à gauche
    ctx.fillStyle = color;
    rr(ctx, x + 10, y + 20, 6, boxH - 40, 3);
    ctx.fill();

    ctx.fillStyle = '#cccccc';
    ctx.font = `600 22px ${titleFace}, Arial`;
    ctx.fillText(label, x + 30, y + 50);

    ctx.fillStyle = THEME.text;
    ctx.font = `700 64px ${titleFace}, Arial`;
    ctx.fillText(count.toString(), x + 30, y + 130);

    // Icone (simulée par texte ou emoji)
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.font = `100px Arial`;
    ctx.textAlign = 'right';
    ctx.fillText(icon, x + boxW - 20, y + 130);
    ctx.textAlign = 'left';
  };

  drawStatBox(col2X, contentY, 'Avertissements', stats.warns, '#FFAA00', '⚠️');
  drawStatBox(col2X + boxW + 24, contentY, 'Mutes', stats.mutes, '#888888', '🔇');

  drawStatBox(col2X, contentY + boxH + 24, 'Bannissements', stats.bans, '#FF4444', '🔨');
  drawStatBox(col2X + boxW + 24, contentY + boxH + 24, 'Notes', stats.notes, '#5E81F4', '📝');

  // 5. Dernière Sanction
  const lastY = contentY + (boxH * 2) + 48;
  const lastH = H - lastY - 24;

  panel(ctx, col2X, lastY, col2W, lastH, 24, lastSanction ? 'rgba(255, 68, 68, 0.1)' : THEME.panel);

  ctx.fillStyle = lastSanction ? '#ff6666' : THEME.text;
  ctx.font = `700 24px ${titleFace}, Arial`;
  ctx.fillText('⏱️ Dernière Sanction', col2X + 30, lastY + 45);

  if (lastSanction) {
    ctx.fillStyle = THEME.text;
    ctx.font = `600 22px ${titleFace}, Arial`;
    ctx.fillText(`${lastSanction.type} - ${formatDate(lastSanction.date)}`, col2X + 30, lastY + 90);

    ctx.fillStyle = '#dddddd';
    ctx.font = `400 18px ${textFace}, Arial`;
    const reason = lastSanction.reason || 'Aucune raison spécifiée';
    // Wrap reason text
    const lines = wrapText(ctx, `Raison: ${reason}`, col2W - 60);
    lines.slice(0, 3).forEach((line, i) => {
      ctx.fillText(line, col2X + 30, lastY + 125 + (i * 25));
    });

    // Modérateur
    if (moderatorName) {
      ctx.fillStyle = '#888888';
      ctx.font = `italic 16px ${textFace}, Arial`;
      ctx.fillText(`Par ${moderatorName}`, col2X + 30, lastY + lastH - 30);
    }

  } else {
    ctx.fillStyle = '#888888';
    ctx.font = `italic 20px ${textFace}, Arial`;
    ctx.fillText("Casier vierge (ou aucune donnée récente)", col2X + 30, lastY + 100);
  }

  return canvas.toBuffer('image/png');
}

module.exports = { renderStaffProfileCard, renderMemberProfileCard };