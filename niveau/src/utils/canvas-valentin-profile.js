const { createCanvas, registerFont, loadImage } = require('canvas');
const path = require('path');
const logger = require('./logger');
const { ITEMS } = require('./items');

// Enregistrer les polices personnalisées
try {
    registerFont(path.join(__dirname, '..', 'assets', 'fonts', 'Poppins-Regular.ttf'), { family: 'Poppins' });
    registerFont(path.join(__dirname, '..', 'assets', 'fonts', 'Poppins-Bold.ttf'), { family: 'Poppins-Bold' });
} catch (e) {
    logger.warn('Police Poppins non trouvée, utilisation des polices système');
}

// Items de la Saint-Valentin pour affichage
const VALENTIN_ITEMS = [
    { id: 'bague_mariage', emoji: '💍', name: 'Bague de Mariage', desc: 'Boost 10% → 30% si marié' },
    { id: 'ami_chiant', emoji: '😠', name: 'Petit(e) ami(e) chiant(e)', desc: 'Boost 20% si 100 msg/jour' },
];

/**
 * Génère le canvas du profil Saint-Valentin
 * @param {Object} discordUser - L'objet utilisateur Discord
 * @param {Object} eventUser - Les données de l'événement
 * @param {Object} options - Options supplémentaires
 * @param {string|null} options.partnerUsername - Nom du partenaire ou null
 * @param {number|null} options.marriageTimestamp - Timestamp du mariage ou null
 * @param {Array} options.unlocks - Liste des unlocks [{unlock_id, timestamp}]
 * @param {number|string} options.rank - Rang dans le classement
 * @param {number} options.dailyMessages - Nombre de messages aujourd'hui
 */
async function generateValentinProfileCanvas(discordUser, eventUser, options = {}) {
    const width = 1600;
    const height = 900;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const {
        partnerUsername = null,
        marriageTimestamp = null,
        unlocks = [],
        rank = 'N/A',
        dailyMessages = 0,
    } = options;

    // Set des items débloqués (utilisé dans le panneau gauche et droit)
    const unlockedIds = new Set(unlocks.map(u => u.unlock_id));

    // ═══════════════════════════════════════════
    // FOND
    // ═══════════════════════════════════════════
    try {
        const bgPath = path.join(__dirname, '../assets/valentin_bg.png');
        const bg = await loadImage(bgPath);
        ctx.drawImage(bg, 0, 0, width, height);
    } catch (e) {
        // Dégradé de secours
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#1a0011');
        grad.addColorStop(0.4, '#3d0026');
        grad.addColorStop(0.7, '#4a0030');
        grad.addColorStop(1, '#1a0011');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
    }

    // Overlay sombre pour lisibilité
    ctx.fillStyle = 'rgba(15, 0, 10, 0.45)';
    ctx.fillRect(0, 0, width, height);

    // Petits cœurs décoratifs en arrière-plan
    drawBackgroundHearts(ctx, width, height);

    // ═══════════════════════════════════════════
    // PANNEAU PRINCIPAL (gauche, ~60%)
    // ═══════════════════════════════════════════
    const margin = 35;
    const panelX = margin;
    const panelY = margin;
    const panelWidth = 970;
    const panelHeight = height - (margin * 2);

    // Fond du panneau avec transparence
    ctx.fillStyle = 'rgba(20, 0, 15, 0.82)';
    roundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 18);
    ctx.fill();

    // Bordure rose dorée épaisse
    ctx.strokeStyle = '#FF69B4';
    ctx.lineWidth = 5;
    roundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 18);
    ctx.stroke();

    // Bordure intérieure plus discrète
    ctx.strokeStyle = 'rgba(255, 182, 193, 0.4)';
    ctx.lineWidth = 2;
    roundedRect(ctx, panelX + 4, panelY + 4, panelWidth - 8, panelHeight - 8, 14);
    ctx.stroke();

    // ═══ HEADER AVEC AVATAR ═══
    const headerPadding = 35;
    const avatarSize = 110;
    const avatarX = panelX + headerPadding;
    const avatarY = panelY + headerPadding;

    // Glow rose autour de l'avatar
    ctx.shadowColor = '#FF69B4';
    ctx.shadowBlur = 25;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#FF1493';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Cercle bordure or-rose
    ctx.strokeStyle = '#FFB6C1';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 3, 0, Math.PI * 2);
    ctx.stroke();

    // Fond blanc pour l'avatar
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.fill();

    // Avatar
    try {
        const userAvatar = await loadImage(discordUser.displayAvatarURL({ extension: 'png', size: 256 }));
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 - 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(userAvatar, avatarX + 2, avatarY + 2, avatarSize - 4, avatarSize - 4);
        ctx.restore();
    } catch (e) {
        logger.warn('Impossible de charger l\'avatar pour le profil Valentine');
    }

    // Pseudo
    const textX = avatarX + avatarSize + 30;
    const textY = avatarY + 40;
    const displayName = discordUser.displayName || discordUser.username;

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 40px "Poppins-Bold", Arial';
    ctx.fillText(displayName, textX, textY);

    // Sous-titre
    ctx.fillStyle = '#FF69B4';
    ctx.font = 'bold 20px "Poppins-Bold", Arial';
    ctx.fillText('💘 Profil Saint-Valentin', textX, textY + 38);

    // ═══ SÉPARATEUR ═══
    const separatorY = panelY + 175;
    const sepGrad = ctx.createLinearGradient(panelX + 30, separatorY, panelX + panelWidth - 30, separatorY);
    sepGrad.addColorStop(0, 'rgba(255, 105, 180, 0.1)');
    sepGrad.addColorStop(0.3, '#FF69B4');
    sepGrad.addColorStop(0.7, '#FF69B4');
    sepGrad.addColorStop(1, 'rgba(255, 105, 180, 0.1)');
    ctx.strokeStyle = sepGrad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(panelX + 30, separatorY);
    ctx.lineTo(panelX + panelWidth - 30, separatorY);
    ctx.stroke();

    // ═══════════════════════════════════════════
    // STATISTIQUES PRINCIPALES (3 grandes boîtes)
    // ═══════════════════════════════════════════
    const statsStartY = separatorY + 30;
    const statBoxWidth = panelWidth - 70;
    const statBoxHeight = 115;
    const statSpacing = 18;

    // ❤️ Cœurs
    drawStatBox(ctx, panelX + 35, statsStartY,
        '❤️', 'Cœurs', eventUser.coeurs.toLocaleString('fr-FR'),
        '#FF1493', statBoxWidth, statBoxHeight);

    // 💍 Statut de Mariage
    let marriageValue, marriageSubtext;
    if (partnerUsername) {
        marriageValue = `Marié(e) avec ${partnerUsername}`;
        if (marriageTimestamp) {
            const marriageDate = new Date(marriageTimestamp);
            marriageSubtext = `depuis le ${marriageDate.toLocaleDateString('fr-FR')}`;
        }
    } else {
        marriageValue = 'Célibataire';
        marriageSubtext = 'Utilisez /marier pour vous unir !';
    }
    drawStatBox(ctx, panelX + 35, statsStartY + statBoxHeight + statSpacing,
        '💍', 'Statut', marriageValue,
        '#FFB6C1', statBoxWidth, statBoxHeight, marriageSubtext);

    // 🏆 Classement
    const rankText = typeof rank === 'number' ? `#${rank}` : rank;
    drawStatBox(ctx, panelX + 35, statsStartY + (statBoxHeight + statSpacing) * 2,
        '🏆', 'Classement Cœurs', rankText,
        '#FFD700', statBoxWidth, statBoxHeight);

    // ═══════════════════════════════════════════
    // SECTION MESSAGES DU JOUR (bas du panneau gauche)
    // ═══════════════════════════════════════════
    const msgSectionY = statsStartY + (statBoxHeight + statSpacing) * 3 + 25;
    const msgSectionHeight = 140;
    const hasAmiChiant = unlockedIds.has('ami_chiant');

    ctx.fillStyle = 'rgba(255, 105, 180, 0.06)';
    roundedRect(ctx, panelX + 35, msgSectionY, statBoxWidth, msgSectionHeight, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 105, 180, 0.35)';
    ctx.lineWidth = 2;
    roundedRect(ctx, panelX + 35, msgSectionY, statBoxWidth, msgSectionHeight, 12);
    ctx.stroke();

    if (hasAmiChiant) {
        // L'utilisateur possède l'item → afficher la barre de progression
        ctx.fillStyle = '#FF69B4';
        ctx.font = 'bold 22px "Poppins-Bold", Arial';
        ctx.fillText('📊 Activité du Jour', panelX + 55, msgSectionY + 32);

        const msgProgress = Math.min(dailyMessages / 100, 1);
        const barX = panelX + 55;
        const barY = msgSectionY + 55;
        const barWidth = statBoxWidth - 40;
        const barHeight = 28;

        // Fond de la barre
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        roundedRect(ctx, barX, barY, barWidth, barHeight, 14);
        ctx.fill();

        // Remplissage progressif avec gradient
        if (msgProgress > 0) {
            const progressGrad = ctx.createLinearGradient(barX, barY, barX + barWidth * msgProgress, barY);
            progressGrad.addColorStop(0, '#FF1493');
            progressGrad.addColorStop(1, '#FF69B4');
            ctx.fillStyle = progressGrad;
            roundedRect(ctx, barX, barY, barWidth * msgProgress, barHeight, 14);
            ctx.fill();
        }

        // Texte de la barre
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 15px "Poppins-Bold", Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${dailyMessages} / 100 messages`, barX + barWidth / 2, barY + 19);
        ctx.textAlign = 'left';

        // Légende
        ctx.fillStyle = '#AAAAAA';
        ctx.font = '14px "Poppins", Arial';
        ctx.fillText('Objectif pour le bonus Petit(e) ami(e) chiant(e)', barX, barY + barHeight + 22);
    } else {
        // L'utilisateur ne possède PAS l'item → placeholder
        ctx.fillStyle = '#666666';
        ctx.font = 'bold 20px "Poppins-Bold", Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🔒 Espace réservé', panelX + 35 + statBoxWidth / 2, msgSectionY + 50);
        ctx.fillStyle = '#555555';
        ctx.font = '16px "Poppins", Arial';
        ctx.fillText('Débloquez l\'item "Petit(e) ami(e) chiant(e)"', panelX + 35 + statBoxWidth / 2, msgSectionY + 80);
        ctx.fillText('dans la boutique pour accéder à cette zone.', panelX + 35 + statBoxWidth / 2, msgSectionY + 105);
        ctx.textAlign = 'left';
    }

    // ═══════════════════════════════════════════
    // PANNEAU DROIT (~40%)
    // ═══════════════════════════════════════════
    const rightPanelX = panelX + panelWidth + 25;
    const rightPanelWidth = width - rightPanelX - margin;
    const rightPanelY = panelY;
    const rightPanelHeight = panelHeight;

    // Fond du panneau droit
    ctx.fillStyle = 'rgba(20, 0, 15, 0.82)';
    roundedRect(ctx, rightPanelX, rightPanelY, rightPanelWidth, rightPanelHeight, 18);
    ctx.fill();

    // Bordure
    ctx.strokeStyle = '#FF69B4';
    ctx.lineWidth = 5;
    roundedRect(ctx, rightPanelX, rightPanelY, rightPanelWidth, rightPanelHeight, 18);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 182, 193, 0.4)';
    ctx.lineWidth = 2;
    roundedRect(ctx, rightPanelX + 4, rightPanelY + 4, rightPanelWidth - 8, rightPanelHeight - 8, 14);
    ctx.stroke();

    // ═══ TITRE ITEMS DÉBLOQUÉS ═══
    const rightContentX = rightPanelX + 30;
    let rightContentY = rightPanelY + 45;

    ctx.fillStyle = '#FF69B4';
    ctx.font = 'bold 26px "Poppins-Bold", Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🎁 Items Débloqués', rightPanelX + rightPanelWidth / 2, rightContentY);
    ctx.textAlign = 'left';

    rightContentY += 25;

    // Séparateur sous le titre
    const rightSepGrad = ctx.createLinearGradient(rightContentX, rightContentY, rightPanelX + rightPanelWidth - 30, rightContentY);
    rightSepGrad.addColorStop(0, 'rgba(255, 105, 180, 0.1)');
    rightSepGrad.addColorStop(0.5, '#FF69B4');
    rightSepGrad.addColorStop(1, 'rgba(255, 105, 180, 0.1)');
    ctx.strokeStyle = rightSepGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rightContentX, rightContentY);
    ctx.lineTo(rightPanelX + rightPanelWidth - 30, rightContentY);
    ctx.stroke();

    rightContentY += 30;

    // Affichage de chaque item (unlockedIds déjà défini plus haut)

    VALENTIN_ITEMS.forEach((item, index) => {
        const isUnlocked = unlockedIds.has(item.id);
        const itemY = rightContentY + index * 170;
        const itemWidth = rightPanelWidth - 60;
        const itemHeight = 145;

        // Fond de la carte item
        const itemGrad = ctx.createLinearGradient(rightContentX, itemY, rightContentX, itemY + itemHeight);
        if (isUnlocked) {
            itemGrad.addColorStop(0, 'rgba(255, 20, 147, 0.2)');
            itemGrad.addColorStop(1, 'rgba(255, 20, 147, 0.05)');
        } else {
            itemGrad.addColorStop(0, 'rgba(100, 100, 100, 0.15)');
            itemGrad.addColorStop(1, 'rgba(60, 60, 60, 0.05)');
        }
        ctx.fillStyle = itemGrad;
        roundedRect(ctx, rightContentX, itemY, itemWidth, itemHeight, 12);
        ctx.fill();

        // Bordure
        ctx.strokeStyle = isUnlocked ? '#FF1493' : 'rgba(150, 150, 150, 0.4)';
        ctx.lineWidth = 2.5;
        roundedRect(ctx, rightContentX, itemY, itemWidth, itemHeight, 12);
        ctx.stroke();

        // Emoji large
        ctx.font = '52px Arial';
        ctx.fillText(item.emoji, rightContentX + 18, itemY + 62);

        // Nom de l'item
        ctx.fillStyle = isUnlocked ? '#FFFFFF' : '#888888';
        ctx.font = `bold 22px "Poppins-Bold", Arial`;
        ctx.fillText(item.name, rightContentX + 85, itemY + 38);

        // Description
        ctx.fillStyle = isUnlocked ? '#CCCCCC' : '#666666';
        ctx.font = '16px "Poppins", Arial';
        ctx.fillText(item.desc, rightContentX + 85, itemY + 65);

        // Badge de statut
        const badgeText = isUnlocked ? '✅ ACTIF' : '🔒 NON DÉBLOQUÉ';
        const badgeColor = isUnlocked ? '#00FF7F' : '#FF4444';
        const badgeWidth = ctx.measureText(badgeText).width + 24;

        ctx.fillStyle = isUnlocked ? 'rgba(0, 255, 127, 0.15)' : 'rgba(255, 68, 68, 0.15)';
        roundedRect(ctx, rightContentX + 85, itemY + 82, badgeWidth, 30, 15);
        ctx.fill();

        ctx.strokeStyle = badgeColor;
        ctx.lineWidth = 1.5;
        roundedRect(ctx, rightContentX + 85, itemY + 82, badgeWidth, 30, 15);
        ctx.stroke();

        ctx.fillStyle = badgeColor;
        ctx.font = 'bold 15px "Poppins-Bold", Arial';
        ctx.fillText(badgeText, rightContentX + 97, itemY + 102);

        // Date de débloquage
        if (isUnlocked) {
            const unlock = unlocks.find(u => u.unlock_id === item.id);
            if (unlock) {
                const unlockDate = new Date(unlock.timestamp);
                ctx.fillStyle = '#999999';
                ctx.font = '13px "Poppins", Arial';
                ctx.fillText(`Débloqué le ${unlockDate.toLocaleDateString('fr-FR')}`, rightContentX + 85, itemY + 130);
            }
        }
    });

    // ═══ SECTION BONUS INFOS (bas du panneau droit) ═══
    const bonusY = rightContentY + VALENTIN_ITEMS.length * 170 + 30;
    const bonusHeight = rightPanelHeight - (bonusY - rightPanelY) - 30;

    if (bonusHeight > 80) {
        // Fond section bonus
        ctx.fillStyle = 'rgba(255, 215, 0, 0.05)';
        roundedRect(ctx, rightContentX, bonusY, rightPanelWidth - 60, bonusHeight, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
        ctx.lineWidth = 2;
        roundedRect(ctx, rightContentX, bonusY, rightPanelWidth - 60, bonusHeight, 12);
        ctx.stroke();

        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 22px "Poppins-Bold", Arial';
        ctx.fillText('💡 Astuces', rightContentX + 18, bonusY + 32);

        const tips = [
            '• /daily-amour → 100 cœurs/jour',
            '• /date → Mini-jeu pour gagner 200 cœurs',
            '• /boutique-valentin → Achetez des items',
            partnerUsername ? '• Vous êtes marié(e) ! Boost max 💪' : '• /marier → Unissez-vous pour le boost max',
        ];

        ctx.fillStyle = '#CCCCCC';
        ctx.font = '16px "Poppins", Arial';
        tips.forEach((tip, i) => {
            if (bonusY + 58 + (i * 26) < rightPanelY + rightPanelHeight - 20) {
                ctx.fillText(tip, rightContentX + 18, bonusY + 58 + (i * 26));
            }
        });
    }

    // ═══ WATERMARK ═══
    ctx.fillStyle = 'rgba(255, 105, 180, 0.25)';
    ctx.font = '14px "Poppins", Arial';
    ctx.textAlign = 'right';
    ctx.fillText('Saint-Valentin 2026 💘', width - margin - 10, height - margin + 5);
    ctx.textAlign = 'left';

    return canvas.toBuffer('image/png');
}

// ═══════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════

function drawStatBox(ctx, x, y, emoji, label, value, color, width, height, subtext = null) {
    // Fond avec dégradé
    const statGrad = ctx.createLinearGradient(x, y, x, y + height);
    statGrad.addColorStop(0, color + '28');
    statGrad.addColorStop(1, color + '08');
    ctx.fillStyle = statGrad;
    roundedRect(ctx, x, y, width, height, 12);
    ctx.fill();

    // Bordure colorée
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    roundedRect(ctx, x, y, width, height, 12);
    ctx.stroke();

    // Bordure intérieure
    ctx.strokeStyle = color + '50';
    ctx.lineWidth = 1;
    roundedRect(ctx, x + 3, y + 3, width - 6, height - 6, 10);
    ctx.stroke();

    // Emoji
    ctx.font = '54px Arial';
    ctx.fillText(emoji, x + 18, y + height / 2 + 18);

    // Label
    ctx.fillStyle = '#CCCCCC';
    ctx.font = 'bold 20px "Poppins-Bold", Arial';
    ctx.fillText(label, x + 95, y + 35);

    // Valeur principale
    ctx.fillStyle = color;
    ctx.font = 'bold 42px "Poppins-Bold", Arial';

    // Tronquer la valeur si trop longue
    let displayValue = value;
    if (ctx.measureText(displayValue).width > width - 130) {
        while (ctx.measureText(displayValue + '…').width > width - 130 && displayValue.length > 0) {
            displayValue = displayValue.slice(0, -1);
        }
        displayValue += '…';
    }
    ctx.fillText(displayValue, x + 95, y + 78);

    // Sous-texte optionnel
    if (subtext) {
        ctx.fillStyle = '#999999';
        ctx.font = '15px "Poppins", Arial';
        ctx.fillText(subtext, x + 95, y + 100);
    }
}

function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function drawBackgroundHearts(ctx, width, height) {
    ctx.save();
    const heartCount = 30;

    for (let i = 0; i < heartCount; i++) {
        const x = (Math.sin(i * 7.3 + 1.2) * 0.5 + 0.5) * width;
        const y = (Math.cos(i * 4.7 + 3.1) * 0.5 + 0.5) * height;
        const size = 8 + (Math.sin(i * 2.9) * 0.5 + 0.5) * 22;
        const opacity = 0.03 + (Math.sin(i * 1.7) * 0.5 + 0.5) * 0.07;

        ctx.fillStyle = `rgba(255, 105, 180, ${opacity})`;
        drawHeart(ctx, x, y, size);
    }
    ctx.restore();
}

function drawHeart(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    const topCurveHeight = size * 0.3;
    ctx.moveTo(0, topCurveHeight);

    // Côté gauche
    ctx.bezierCurveTo(
        0, 0,
        -size / 2, 0,
        -size / 2, topCurveHeight
    );

    // Pointe gauche vers bas
    ctx.bezierCurveTo(
        -size / 2, (size + topCurveHeight) / 2,
        0, (size + topCurveHeight) / 2,
        0, size
    );

    // Pointe droite vers bas
    ctx.bezierCurveTo(
        0, (size + topCurveHeight) / 2,
        size / 2, (size + topCurveHeight) / 2,
        size / 2, topCurveHeight
    );

    // Côté droit
    ctx.bezierCurveTo(
        size / 2, 0,
        0, 0,
        0, topCurveHeight
    );

    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

module.exports = { generateValentinProfileCanvas };
