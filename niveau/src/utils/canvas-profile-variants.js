/**
 * Aperçus /testprofil — famille **Carmin** uniquement (vignette cramoisie, or / bordeaux).
 * 5 mises en page distinctes (la 1re = ancienne grille « carmin »).
 */
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
} catch {
    /* ignore */
}

const W = 1200;
const H = 700;

const PROFILE_PREVIEW_VARIANTS = [
    { id: 'carmin', label: 'Carmin', hint: 'Vignette cramoisie, contraste fort — grille classique' },
    { id: 'carmin_atlas', label: 'Carmin · Atlas', hint: 'Portrait large à gauche, stats en colonne' },
    { id: 'carmin_naos', label: 'Carmin · Naos', hint: 'Bandeau titre + 2 blocs + rang pleine largeur' },
    { id: 'carmin_medalion', label: 'Carmin · Médaillon', hint: 'Format plus compact, avatar central XXL' },
    { id: 'carmin_tribunal', label: 'Carmin · Tribunal', hint: 'Avatar en coin, trois estrades en bas' },
];

const T = {
    header: 'rgba(36, 6, 14, 0.88)',
    panel: 'rgba(12, 2, 6, 0.78)',
    stroke: 'rgba(255, 120, 100, 0.45)',
    text: '#ffffff',
    sub: '#f5b8c0',
    accent: '#ffcc4d',
    xpFill: '#dc2626',
    xpTrack: 'rgba(255, 255, 255, 0.1)',
};

const LEGACY_PROFILE_VARIANT = Object.freeze({
    aurora: 'carmin',
    nocturne: 'carmin_atlas',
    parchment: 'carmin_naos',
    rubis: 'carmin',
    forge: 'carmin_tribunal',
    banniere: 'carmin_naos',
    monolithe: 'carmin_medalion',
    vitres: 'carmin_medalion',
    braise: 'carmin_tribunal',
});

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

async function tryLoadBlzBg() {
    const p = path.join(__dirname, '..', 'assets', 'blz_bg.png');
    if (!fs.existsSync(p)) return null;
    try {
        return await loadImage(fs.readFileSync(p));
    } catch {
        return null;
    }
}

function drawXpBar(ctx, x, y, w, h, ratio, fill, track) {
    rr(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = track;
    ctx.fill();
    const r = Math.max(0, Math.min(1, ratio));
    if (r > 0) {
        const fw = Math.max(h, Math.round(w * r));
        rr(ctx, x, y, fw, h, h / 2);
        ctx.fillStyle = fill;
        ctx.fill();
    }
}

async function loadAvatar(member) {
    const url = member?.displayAvatarURL({ extension: 'png', size: 256 });
    if (!url) return null;
    try {
        return await loadImage(url);
    } catch {
        return null;
    }
}

async function drawCarminBackdrop(ctx, cw, ch) {
    const g = ctx.createLinearGradient(0, 0, cw, ch);
    g.addColorStop(0, '#080204');
    g.addColorStop(1, '#280610');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);
    const bgImg = await tryLoadBlzBg();
    if (bgImg) {
        ctx.save();
        ctx.globalAlpha = 0.38;
        ctx.drawImage(bgImg, 0, 0, cw, ch);
        ctx.restore();
    }
    const v = ctx.createRadialGradient(cw, 0, 0, cw, ch * 0.2, Math.max(cw, ch) * 0.85);
    v.addColorStop(0, 'rgba(160, 10, 40, 0.45)');
    v.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, cw, ch);
}

function panel(ctx, x, y, w, h, r, fill = T.panel) {
    rr(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = T.stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
}

function drawCarminFooter(ctx, label, cw, ch) {
    ctx.fillStyle = 'rgba(255, 200, 140, 0.85)';
    ctx.font = 'italic 12px Inter, Arial';
    ctx.textAlign = 'right';
    ctx.fillText(label, cw - 20, ch - 14);
    ctx.textAlign = 'left';
}

async function drawRankIcon(ctx, rankIconPath, x, y, size) {
    if (!rankIconPath || !fs.existsSync(rankIconPath)) return;
    try {
        const ic = await loadImage(fs.readFileSync(rankIconPath));
        ctx.drawImage(ic, x, y, size, size);
    } catch {
        /* ignore */
    }
}

function drawDebtVocal(ctx, pad, innerW, startY, totalDebt, debtTimeRemaining, vocalNerfStatus, textFace) {
    let y = startY;
    if (totalDebt > 0) {
        ctx.fillStyle = 'rgba(248, 113, 113, 0.95)';
        ctx.font = `600 13px ${textFace}, Arial`;
        ctx.fillText(
            `Dette : ${totalDebt.toLocaleString('fr-FR')} ⭐${debtTimeRemaining ? ` — ${debtTimeRemaining}` : ''}`,
            pad,
            y
        );
        y += 18;
    }
    if (vocalNerfStatus) {
        ctx.fillStyle = 'rgba(251, 191, 36, 0.95)';
        ctx.font = `500 12px ${textFace}, Arial`;
        ctx.fillText(truncateText(ctx, vocalNerfStatus, innerW), pad, y);
    }
}

/** Grille classique (ex-carmin BLZ) — 1200×700 */
async function renderCarminGrille(data, titleFace, textFace) {
    const { user, member, rank, nextRank, highestRoleName, rankIconPath, totalDebt, debtTimeRemaining, vocalNerfStatus } =
        data;
    const displayName = member?.displayName ?? 'Utilisateur';
    const ratioXp = user.xp_needed > 0 ? user.xp / user.xp_needed : 0;

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    await drawCarminBackdrop(ctx, W, H);

    const pad = 22;
    const gap = 14;
    const innerW = W - pad * 2;
    const y0 = 18;
    const headerH = 124;

    panel(ctx, pad, y0, innerW, headerH, 26, T.header);

    const avImg = await loadAvatar(member);
    const avS = 84;
    const avX = pad + 20;
    const avY = y0 + 22;
    ctx.save();
    rr(ctx, avX, avY, avS, avS, avS / 2);
    ctx.clip();
    if (avImg) ctx.drawImage(avImg, avX, avY, avS, avS);
    else {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(avX, avY, avS, avS);
    }
    ctx.restore();
    rr(ctx, avX, avY, avS, avS, avS / 2);
    ctx.strokeStyle = T.stroke;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = T.text;
    ctx.font = `800 34px ${titleFace}, Arial`;
    ctx.fillText(truncateText(ctx, displayName, innerW - avS - 160), avX + avS + 18, y0 + 56);
    ctx.font = `600 17px ${textFace}, Arial`;
    ctx.fillStyle = T.sub;
    ctx.fillText(truncateText(ctx, highestRoleName, innerW - avS - 160), avX + avS + 18, y0 + 86);

    ctx.textAlign = 'right';
    ctx.fillStyle = T.accent;
    ctx.font = `800 26px ${titleFace}, Arial`;
    ctx.fillText(`⭐ ${(user.stars ?? 0).toLocaleString('fr-FR')}`, pad + innerW - 16, y0 + 52);
    ctx.fillStyle = T.text;
    ctx.font = `600 16px ${textFace}, Arial`;
    ctx.fillText(`🏆 ${(user.points ?? 0).toLocaleString('fr-FR')} RP`, pad + innerW - 16, y0 + 82);
    ctx.textAlign = 'left';

    const yXp = y0 + headerH + gap;
    const xpH = 36;
    panel(ctx, pad, yXp, innerW, xpH + 44, 18);
    ctx.fillStyle = T.text;
    ctx.font = `700 18px ${titleFace}, Arial`;
    ctx.fillText(`Niveau ${user.level ?? 1}`, pad + 18, yXp + 26);
    drawXpBar(ctx, pad + 18, yXp + 36, innerW - 36, 14, ratioXp, T.xpFill, T.xpTrack);
    ctx.font = `600 14px ${textFace}, Arial`;
    ctx.fillStyle = T.sub;
    ctx.fillText(
        `${(user.xp ?? 0).toLocaleString('fr-FR')} / ${(user.xp_needed ?? 0).toLocaleString('fr-FR')} XP`,
        pad + 18,
        yXp + 62
    );

    const yCards = yXp + xpH + 44 + gap;
    const cardH = H - yCards - pad - 26;
    const cw = (innerW - gap * 2) / 3;

    const drawCard = (ix, title, fn) => {
        const x = pad + ix * (cw + gap);
        panel(ctx, x, yCards, cw, cardH, 16);
        ctx.fillStyle = T.accent;
        ctx.font = `700 18px ${titleFace}, Arial`;
        ctx.fillText(title, x + 16, yCards + 30);
        fn(x + 16, yCards + 52, cw - 32);
    };

    drawCard(0, 'Progression', (x, yy) => {
        ctx.fillStyle = T.text;
        ctx.font = `600 16px ${textFace}, Arial`;
        ctx.fillText('XP & niveau', x, yy);
        ctx.fillStyle = T.sub;
        ctx.font = `500 14px ${textFace}, Arial`;
        ctx.fillText(`Rang actuel : ${rank?.name ?? '—'}`, x, yy + 28);
    });
    drawCard(1, 'Économie', (x, yy) => {
        ctx.fillStyle = T.text;
        ctx.font = `600 17px ${textFace}, Arial`;
        ctx.fillText('Starss & points', x, yy);
        ctx.font = `600 15px ${textFace}, Arial`;
        ctx.fillText(`⭐ ${(user.stars ?? 0).toLocaleString('fr-FR')}`, x, yy + 30);
        ctx.fillText(`🏆 ${(user.points ?? 0).toLocaleString('fr-FR')} RP`, x, yy + 54);
    });
    drawCard(2, 'Rang suivant', (x, yy) => {
        ctx.fillStyle = T.sub;
        ctx.font = `500 14px ${textFace}, Arial`;
        if (nextRank) {
            const need = Math.max(0, (nextRank.points ?? 0) - (user.points ?? 0));
            ctx.fillText(`${nextRank.name}`, x, yy);
            ctx.fillText(`${need.toLocaleString('fr-FR')} RP restants`, x, yy + 24);
        } else {
            ctx.fillText('Rang max atteint', x, yy);
        }
    });

    const card3Left = pad + 2 * (cw + gap);
    await drawRankIcon(ctx, rankIconPath, card3Left + cw - 68, yCards + 38, 52);

    drawDebtVocal(ctx, pad + 16, innerW, yCards + cardH - 28, totalDebt, debtTimeRemaining, vocalNerfStatus, textFace);
    drawCarminFooter(ctx, 'Carmin — grille — /testprofil', W, H);
    return canvas.toBuffer('image/png');
}

/** Portrait large gauche + pile de panneaux à droite */
async function renderCarminAtlas(data, titleFace, textFace) {
    const { user, member, rank, nextRank, highestRoleName, rankIconPath, totalDebt, debtTimeRemaining, vocalNerfStatus } =
        data;
    const displayName = member?.displayName ?? 'Utilisateur';
    const ratioXp = user.xp_needed > 0 ? user.xp / user.xp_needed : 0;

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    await drawCarminBackdrop(ctx, W, H);

    const pad = 20;
    const gap = 16;
    const leftW = 320;
    const rx = pad + leftW + gap;
    const rw = W - rx - pad;

    panel(ctx, pad, pad, leftW, H - pad * 2, 28, T.header);
    const avImg = await loadAvatar(member);
    const avS = 220;
    const avX = pad + (leftW - avS) / 2;
    const avY = pad + 28;
    ctx.save();
    rr(ctx, avX, avY, avS, avS, avS / 2);
    ctx.clip();
    if (avImg) ctx.drawImage(avImg, avX, avY, avS, avS);
    else {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(avX, avY, avS, avS);
    }
    ctx.restore();
    rr(ctx, avX, avY, avS, avS, avS / 2);
    ctx.strokeStyle = T.stroke;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = T.text;
    ctx.font = `800 22px ${titleFace}, Arial`;
    ctx.fillText(truncateText(ctx, displayName, leftW - 24), pad + leftW / 2, avY + avS + 32);
    ctx.font = `600 14px ${textFace}, Arial`;
    ctx.fillStyle = T.sub;
    ctx.fillText(truncateText(ctx, highestRoleName, leftW - 24), pad + leftW / 2, avY + avS + 58);
    ctx.textAlign = 'left';

    let y = pad;
    const h1 = 168;
    const h2 = 158;
    const h3 = H - pad - y - h1 - h2 - gap * 2;

    panel(ctx, rx, y, rw, h1, 18);
    ctx.fillStyle = T.accent;
    ctx.font = `700 20px ${titleFace}, Arial`;
    ctx.fillText('Progression', rx + 18, y + 32);
    ctx.fillStyle = T.text;
    ctx.font = `700 22px ${textFace}, Arial`;
    ctx.fillText(`Niveau ${user.level ?? 1}`, rx + 18, y + 68);
    drawXpBar(ctx, rx + 18, y + 92, rw - 36, 16, ratioXp, T.xpFill, T.xpTrack);
    ctx.font = `600 13px ${textFace}, Arial`;
    ctx.fillStyle = T.sub;
    ctx.fillText(
        `${(user.xp ?? 0).toLocaleString('fr-FR')} / ${(user.xp_needed ?? 0).toLocaleString('fr-FR')} XP`,
        rx + 18,
        y + 128
    );
    y += h1 + gap;

    panel(ctx, rx, y, rw, h2, 18);
    ctx.fillStyle = T.accent;
    ctx.font = `700 20px ${titleFace}, Arial`;
    ctx.fillText('Fortune & honneur', rx + 18, y + 30);
    ctx.fillStyle = T.text;
    ctx.font = `600 17px ${textFace}, Arial`;
    ctx.fillText(`⭐ ${(user.stars ?? 0).toLocaleString('fr-FR')}`, rx + 18, y + 64);
    ctx.fillText(`🏆 ${(user.points ?? 0).toLocaleString('fr-FR')} RP — ${rank?.name ?? ''}`, rx + 18, y + 94);
    ctx.fillStyle = T.sub;
    ctx.font = `500 14px ${textFace}, Arial`;
    if (nextRank) {
        const need = Math.max(0, (nextRank.points ?? 0) - (user.points ?? 0));
        ctx.fillText(`→ ${nextRank.name} (${need.toLocaleString('fr-FR')} RP)`, rx + 18, y + 124);
    }
    y += h2 + gap;

    panel(ctx, rx, y, rw, h3, 18);
    ctx.fillStyle = T.accent;
    ctx.font = `700 20px ${titleFace}, Arial`;
    ctx.fillText('Rang & objectif', rx + 18, y + 30);
    ctx.fillStyle = T.sub;
    ctx.font = `500 15px ${textFace}, Arial`;
    if (nextRank) {
        const need = Math.max(0, (nextRank.points ?? 0) - (user.points ?? 0));
        ctx.fillText(`Prochain palier : ${nextRank.name}`, rx + 18, y + 64);
        ctx.fillText(`${need.toLocaleString('fr-FR')} RP à grappiller`, rx + 18, y + 90);
    } else {
        ctx.fillText('Rang maximal', rx + 18, y + 64);
    }
    await drawRankIcon(ctx, rankIconPath, rx + rw - 88, y + 48, 64);

    drawDebtVocal(ctx, rx + 18, rw - 36, y + h3 - 36, totalDebt, debtTimeRemaining, vocalNerfStatus, textFace);
    drawCarminFooter(ctx, 'Carmin · Atlas — /testprofil', W, H);
    return canvas.toBuffer('image/png');
}

/** Bandeau titre + 2 colonnes + bande rang */
async function renderCarminNaos(data, titleFace, textFace) {
    const { user, member, rank, nextRank, highestRoleName, rankIconPath, totalDebt, debtTimeRemaining, vocalNerfStatus } =
        data;
    const displayName = member?.displayName ?? 'Utilisateur';
    const ratioXp = user.xp_needed > 0 ? user.xp / user.xp_needed : 0;

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    await drawCarminBackdrop(ctx, W, H);

    const pad = 22;
    const gap = 14;
    const innerW = W - pad * 2;
    const bandH = 88;
    panel(ctx, pad, pad, innerW, bandH, 20, T.header);
    ctx.fillStyle = T.text;
    ctx.font = `800 36px ${titleFace}, Arial`;
    ctx.fillText(truncateText(ctx, displayName, innerW - 200), pad + 24, pad + 52);
    ctx.font = `600 16px ${textFace}, Arial`;
    ctx.fillStyle = T.sub;
    ctx.fillText(truncateText(ctx, highestRoleName, innerW - 200), pad + 24, pad + 76);
    ctx.textAlign = 'right';
    ctx.fillStyle = T.accent;
    ctx.font = `800 22px ${titleFace}, Arial`;
    ctx.fillText(`⭐ ${(user.stars ?? 0).toLocaleString('fr-FR')}`, pad + innerW - 8, pad + 44);
    ctx.fillStyle = T.text;
    ctx.font = `600 15px ${textFace}, Arial`;
    ctx.fillText(`🏆 ${(user.points ?? 0).toLocaleString('fr-FR')} RP`, pad + innerW - 8, pad + 72);
    ctx.textAlign = 'left';

    const avImg = await loadAvatar(member);
    const avS = 64;
    const avX = pad + innerW - 92;
    const avY = pad + 14;
    ctx.save();
    rr(ctx, avX, avY, avS, avS, avS / 2);
    ctx.clip();
    if (avImg) ctx.drawImage(avImg, avX, avY, avS, avS);
    else ctx.fillRect(avX, avY, avS, avS);
    ctx.restore();
    rr(ctx, avX, avY, avS, avS, avS / 2);
    ctx.strokeStyle = T.stroke;
    ctx.lineWidth = 2;
    ctx.stroke();

    const y0 = pad + bandH + gap;
    const midH = 260;
    const colW = (innerW - gap) / 2;

    panel(ctx, pad, y0, colW, midH, 18);
    ctx.fillStyle = T.accent;
    ctx.font = `700 20px ${titleFace}, Arial`;
    ctx.fillText('Niveau & XP', pad + 18, y0 + 34);
    ctx.fillStyle = T.text;
    ctx.font = `800 28px ${textFace}, Arial`;
    ctx.fillText(`${user.level ?? 1}`, pad + 18, y0 + 78);
    drawXpBar(ctx, pad + 18, y0 + 108, colW - 36, 16, ratioXp, T.xpFill, T.xpTrack);
    ctx.font = `600 13px ${textFace}, Arial`;
    ctx.fillStyle = T.sub;
    ctx.fillText(
        `${(user.xp ?? 0).toLocaleString('fr-FR')} / ${(user.xp_needed ?? 0).toLocaleString('fr-FR')} XP`,
        pad + 18,
        y0 + 148
    );

    const x2 = pad + colW + gap;
    panel(ctx, x2, y0, colW, midH, 18);
    ctx.fillStyle = T.accent;
    ctx.font = `700 20px ${titleFace}, Arial`;
    ctx.fillText('Rang actuel', x2 + 18, y0 + 34);
    ctx.fillStyle = T.text;
    ctx.font = `700 24px ${textFace}, Arial`;
    ctx.fillText(rank?.name ?? '—', x2 + 18, y0 + 78);
    ctx.font = `600 15px ${textFace}, Arial`;
    ctx.fillStyle = T.sub;
    if (nextRank) {
        const need = Math.max(0, (nextRank.points ?? 0) - (user.points ?? 0));
        ctx.fillText(`Suivant : ${nextRank.name}`, x2 + 18, y0 + 118);
        ctx.fillText(`${need.toLocaleString('fr-FR')} RP`, x2 + 18, y0 + 144);
    }
    await drawRankIcon(ctx, rankIconPath, x2 + colW - 80, y0 + 88, 56);

    const yBot = y0 + midH + gap;
    const botH = H - yBot - pad - 22;
    panel(ctx, pad, yBot, innerW, botH, 18);
    ctx.fillStyle = T.accent;
    ctx.font = `700 18px ${titleFace}, Arial`;
    ctx.fillText('Synthèse', pad + 18, yBot + 30);
    ctx.fillStyle = T.text;
    ctx.font = `600 15px ${textFace}, Arial`;
    ctx.fillText(`⭐ Starss · 🏆 Points · 📈 XP — tout sur une ligne lisible.`, pad + 18, yBot + 62);
    ctx.fillText(
        `⭐ ${(user.stars ?? 0).toLocaleString('fr-FR')}    🏆 ${(user.points ?? 0).toLocaleString('fr-FR')} RP    Niv.${user.level ?? 1}`,
        pad + 18,
        yBot + 92
    );
    drawDebtVocal(ctx, pad + 18, innerW - 36, yBot + botH - 36, totalDebt, debtTimeRemaining, vocalNerfStatus, textFace);
    drawCarminFooter(ctx, 'Carmin · Naos — /testprofil', W, H);
    return canvas.toBuffer('image/png');
}

/** 1000×640 — avatar central XXL, stats resserrées */
async function renderCarminMedalion(data, titleFace, textFace) {
    const { user, member, rank, nextRank, highestRoleName, rankIconPath, totalDebt, debtTimeRemaining, vocalNerfStatus } =
        data;
    const displayName = member?.displayName ?? 'Utilisateur';
    const ratioXp = user.xp_needed > 0 ? user.xp / user.xp_needed : 0;

    const cW = 1000;
    const cH = 640;
    const canvas = createCanvas(cW, cH);
    const ctx = canvas.getContext('2d');
    await drawCarminBackdrop(ctx, cW, cH);

    const pad = 24;
    const avS = 200;
    const avX = (cW - avS) / 2;
    const avY = pad + 8;
    const avImg = await loadAvatar(member);
    ctx.save();
    rr(ctx, avX, avY, avS, avS, avS / 2);
    ctx.clip();
    if (avImg) ctx.drawImage(avImg, avX, avY, avS, avS);
    else {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(avX, avY, avS, avS);
    }
    ctx.restore();
    rr(ctx, avX, avY, avS, avS, avS / 2);
    ctx.strokeStyle = T.stroke;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = T.text;
    ctx.font = `800 28px ${titleFace}, Arial`;
    ctx.fillText(truncateText(ctx, displayName, cW - 40), cW / 2, avY + avS + 32);
    ctx.font = `600 15px ${textFace}, Arial`;
    ctx.fillStyle = T.sub;
    ctx.fillText(truncateText(ctx, highestRoleName, cW - 80), cW / 2, avY + avS + 58);
    ctx.textAlign = 'left';

    const yBar = avY + avS + 78;
    const barW = cW - pad * 2;
    panel(ctx, pad, yBar, barW, 52, 16);
    ctx.fillStyle = T.text;
    ctx.font = `700 16px ${titleFace}, Arial`;
    ctx.fillText(`Niveau ${user.level ?? 1}`, pad + 16, yBar + 22);
    drawXpBar(ctx, pad + 16, yBar + 32, barW - 32, 12, ratioXp, T.xpFill, T.xpTrack);

    const yRow = yBar + 52 + 14;
    const cellW = (barW - 16) / 3;
    for (let i = 0; i < 3; i++) {
        const x = pad + i * (cellW + 8);
        panel(ctx, x, yRow, cellW, cH - yRow - pad - 20, 14);
    }
    ctx.fillStyle = T.accent;
    ctx.font = `700 14px ${titleFace}, Arial`;
    ctx.fillText('⭐ Starss', pad + 20, yRow + 28);
    ctx.fillText('🏆 RP', pad + cellW + 8 + 20, yRow + 28);
    ctx.fillText('Rang', pad + 2 * (cellW + 8) + 20, yRow + 28);
    ctx.fillStyle = T.text;
    ctx.font = `600 20px ${textFace}, Arial`;
    ctx.fillText(`${(user.stars ?? 0).toLocaleString('fr-FR')}`, pad + 20, yRow + 64);
    ctx.fillText(`${(user.points ?? 0).toLocaleString('fr-FR')}`, pad + cellW + 8 + 20, yRow + 64);
    ctx.fillText(`${rank?.name ?? '—'}`, pad + 2 * (cellW + 8) + 20, yRow + 64);
    ctx.font = `500 12px ${textFace}, Arial`;
    ctx.fillStyle = T.sub;
    if (nextRank) {
        const need = Math.max(0, (nextRank.points ?? 0) - (user.points ?? 0));
        ctx.fillText(
            truncateText(ctx, `→ ${nextRank.name} (${need.toLocaleString('fr-FR')} RP)`, cellW - 28),
            pad + 2 * (cellW + 8) + 20,
            yRow + 96
        );
    }
    await drawRankIcon(ctx, rankIconPath, pad + 2 * (cellW + 8) + cellW - 72, yRow + 110, 48);

    drawDebtVocal(ctx, pad + 16, barW - 32, yRow + 130, totalDebt, debtTimeRemaining, vocalNerfStatus, textFace);
    drawCarminFooter(ctx, 'Carmin · Médaillon — /testprofil', cW, cH);
    return canvas.toBuffer('image/png');
}

/** Avatar haut droite + 3 « estrades » en bas */
async function renderCarminTribunal(data, titleFace, textFace) {
    const { user, member, rank, nextRank, highestRoleName, rankIconPath, totalDebt, debtTimeRemaining, vocalNerfStatus } =
        data;
    const displayName = member?.displayName ?? 'Utilisateur';
    const ratioXp = user.xp_needed > 0 ? user.xp / user.xp_needed : 0;

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    await drawCarminBackdrop(ctx, W, H);

    const pad = 22;
    const innerW = W - pad * 2;
    const topH = 200;

    panel(ctx, pad, pad, innerW - 200, topH, 22, T.header);
    ctx.fillStyle = T.text;
    ctx.font = `800 40px ${titleFace}, Arial`;
    ctx.fillText(truncateText(ctx, displayName, innerW - 240), pad + 24, pad + 72);
    ctx.font = `600 18px ${textFace}, Arial`;
    ctx.fillStyle = T.sub;
    ctx.fillText(truncateText(ctx, highestRoleName, innerW - 240), pad + 24, pad + 108);
    ctx.fillStyle = T.accent;
    ctx.font = `700 20px ${titleFace}, Arial`;
    ctx.fillText(`⭐ ${(user.stars ?? 0).toLocaleString('fr-FR')}  ·  🏆 ${(user.points ?? 0).toLocaleString('fr-FR')} RP`, pad + 24, pad + 154);

    const avS = 168;
    const avX = W - pad - avS - 8;
    const avY = pad + 16;
    const avImg = await loadAvatar(member);
    ctx.save();
    rr(ctx, avX, avY, avS, avS, avS / 2);
    ctx.clip();
    if (avImg) ctx.drawImage(avImg, avX, avY, avS, avS);
    else ctx.fillRect(avX, avY, avS, avS);
    ctx.restore();
    rr(ctx, avX, avY, avS, avS, avS / 2);
    ctx.strokeStyle = T.stroke;
    ctx.lineWidth = 3;
    ctx.stroke();

    const yBase = pad + topH + 20;
    const cw = (innerW - 28) / 3;
    const heights = [200, 240, 200];
    for (let i = 0; i < 3; i++) {
        const x = pad + i * (cw + 14);
        const h = heights[i];
        const y = yBase + (260 - h);
        panel(ctx, x, y, cw, h, 16);
        ctx.fillStyle = T.accent;
        ctx.font = `700 17px ${titleFace}, Arial`;
        const titles = ['XP', 'Économie', 'Rang'];
        ctx.fillText(titles[i], x + 14, y + 28);
        ctx.fillStyle = T.text;
        ctx.font = `600 15px ${textFace}, Arial`;
        if (i === 0) {
            ctx.fillText(`Niv. ${user.level ?? 1}`, x + 14, y + 58);
            drawXpBar(ctx, x + 14, y + 78, cw - 28, 12, ratioXp, T.xpFill, T.xpTrack);
            ctx.fillStyle = T.sub;
            ctx.font = `500 12px ${textFace}, Arial`;
            ctx.fillText(
                `${(user.xp ?? 0).toLocaleString('fr-FR')} / ${(user.xp_needed ?? 0).toLocaleString('fr-FR')}`,
                x + 14,
                y + 108
            );
        } else if (i === 1) {
            ctx.fillText(`⭐ ${(user.stars ?? 0).toLocaleString('fr-FR')}`, x + 14, y + 60);
            ctx.fillText(`🏆 ${(user.points ?? 0).toLocaleString('fr-FR')} RP`, x + 14, y + 88);
        } else {
            ctx.fillText(rank?.name ?? '—', x + 14, y + 58);
            if (nextRank) {
                const need = Math.max(0, (nextRank.points ?? 0) - (user.points ?? 0));
                ctx.fillStyle = T.sub;
                ctx.font = `500 13px ${textFace}, Arial`;
                ctx.fillText(truncateText(ctx, `→ ${nextRank.name}`, cw - 28), x + 14, y + 88);
                ctx.fillText(`${need.toLocaleString('fr-FR')} RP`, x + 14, y + 110);
            }
            await drawRankIcon(ctx, rankIconPath, x + cw - 66, y + 130, 48);
        }
    }

    drawDebtVocal(ctx, pad + 12, innerW - 24, H - pad - 36, totalDebt, debtTimeRemaining, vocalNerfStatus, textFace);
    drawCarminFooter(ctx, 'Carmin · Tribunal — /testprofil', W, H);
    return canvas.toBuffer('image/png');
}

async function renderProfilePreviewVariant(data, variant) {
    const titleFace = 'InterBold';
    const textFace = 'Inter';

    switch (variant) {
        case 'carmin':
            return renderCarminGrille(data, titleFace, textFace);
        case 'carmin_atlas':
            return renderCarminAtlas(data, titleFace, textFace);
        case 'carmin_naos':
            return renderCarminNaos(data, titleFace, textFace);
        case 'carmin_medalion':
            return renderCarminMedalion(data, titleFace, textFace);
        case 'carmin_tribunal':
            return renderCarminTribunal(data, titleFace, textFace);
        default:
            return renderCarminGrille(data, titleFace, textFace);
    }
}

function normalizeProfileVariant(v) {
    const resolved = LEGACY_PROFILE_VARIANT[v] || v;
    const allowed = PROFILE_PREVIEW_VARIANTS.map((x) => x.id);
    if (allowed.includes(resolved)) return resolved;
    return 'carmin';
}

module.exports = {
    PROFILE_PREVIEW_VARIANTS,
    renderProfilePreviewVariant,
    normalizeProfileVariant,
};
