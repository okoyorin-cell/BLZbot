
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

// Register fonts
registerFont(path.join(__dirname, '../assets/fonts/Poppins-Bold.ttf'), { family: 'Poppins-Bold' });
registerFont(path.join(__dirname, '../assets/fonts/Poppins-Regular.ttf'), { family: 'Poppins-Regular' });

const fs = require('fs');

async function renderBattlePassCard(user, battlePassData, currentTier, isVip) {
    const CANVAS_WIDTH = 1400;
    const CANVAS_HEIGHT = 500;
    const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d');

    // Charger le fond d'écran
    const bgPath = path.join(__dirname, '../assets/blz_bg.png');
    let bgImage = null;
    if (fs.existsSync(bgPath)) {
        try {
            bgImage = await loadImage(bgPath);
            ctx.drawImage(bgImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        } catch (e) {
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }
    } else {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // Ajouter une transparence sombre
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Titre en haut
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 42px Poppins-Bold';
    ctx.textAlign = 'center';
    ctx.fillText(`BATTLE PASS - TIER ${currentTier} / 50`, CANVAS_WIDTH / 2, 45);

    // Constantes Battle Pass
    const TOTAL_TIERS = 50;

    // Paramètres de la barre de progression
    const BAR_HEIGHT = 35;
    const BAR_Y = CANVAS_HEIGHT / 2 - BAR_HEIGHT / 2;
    const VISIBLE_TIERS_COUNT = 5; // 5 tiers visibles à l'écran (mais avec 25% d'espacement)
    const BAR_POSITION_RATIO = 0.25; // La barre est toujours à 25% de l'écran
    
    // Largeur des tiers sur l'écran avec 25% d'espacement (pas 20%)
    const tierWidthOnScreen = CANVAS_WIDTH * BAR_POSITION_RATIO; // 25% du canvas par tier
    
    // Calculer la progression XP du tier actuel (0 à 1)
    const { getTierFromXp, getBattlePassReward } = require('./battle-pass');
    let tierProgress = 0;
    if (currentTier < TOTAL_TIERS) {
        // Calculer l'XP cumulé jusqu'au tier actuel (inclus)
        let xpForCurrentTier = 0;
        
        for (let i = 1; i <= currentTier; i++) {
            const reward = getBattlePassReward(i);
            if (reward) xpForCurrentTier += reward.xp;
        }
        
        // XP nécessaire pour atteindre le prochain palier
        const nextReward = getBattlePassReward(currentTier + 1);
        const xpForNextTier = nextReward ? nextReward.xp : 0;
        
        // Progression dans le tier actuel (0 à 1)
        if (xpForNextTier > 0) {
            const xpInCurrentTier = user.seasonal_xp - xpForCurrentTier;
            tierProgress = Math.max(0, Math.min(1, xpInCurrentTier / xpForNextTier));
        }
    }

    // La barre physique est PLUS GRANDE que le canvas
    // Elle s'étend de tier 1 à tier 50
    const BAR_FULL_WIDTH = CANVAS_WIDTH * (TOTAL_TIERS * BAR_POSITION_RATIO);
    const TIER_WIDTH_ON_FULL_BAR = BAR_FULL_WIDTH / TOTAL_TIERS;
    
    // Appliquer le décalage selon la progression XP
    const progressOffset = tierProgress * tierWidthOnScreen;

    // La barre jaune reste TOUJOURS à 25% (c'est l'arrière-plan qui bouge, pas la barre)
    const barFilledWidth = tierWidthOnScreen * BAR_POSITION_RATIO;

    // Dessiner la barre de progression
    ctx.save();
    
    // Fond de la barre (plus grande que le canvas)
    // La barre grise doit être positionnée de sorte que le palier actuel soit à 25%
    // Position du palier 1 sur la barre grise = début de la barre
    // Au palier N, le palier N doit être à 25% du canvas
    const barGrayStartX = (CANVAS_WIDTH * BAR_POSITION_RATIO) - ((currentTier - 1) * tierWidthOnScreen) - progressOffset;
    ctx.fillStyle = '#2c3e50';
    roundRect(ctx, barGrayStartX, BAR_Y, BAR_FULL_WIDTH, BAR_HEIGHT, 20);
    ctx.fill();
    
    // Partie remplie (barre jaune)
    const gradient = ctx.createLinearGradient(0, BAR_Y, 0, BAR_Y + BAR_HEIGHT);
    gradient.addColorStop(0, '#FFD700');
    gradient.addColorStop(0.5, '#FFA500');
    gradient.addColorStop(1, '#FF8C00');
    
    ctx.fillStyle = gradient;
    
    // Calculer la position de départ de la barre jaune
    // Si le palier 1 est visible, la barre commence au palier 1
    // Sinon, elle commence à -10%
    const tier1Position = barGrayStartX;
    const tier1IsVisible = tier1Position >= CANVAS_WIDTH * -0.1; // Si le palier 1 est après -10%
    const barYellowStartX = tier1IsVisible ? tier1Position : CANVAS_WIDTH * -0.1;
    const barYellowEndX = CANVAS_WIDTH * BAR_POSITION_RATIO; // Toujours à 25%
    const barYellowWidth = barYellowEndX - barYellowStartX;
    
    roundRect(ctx, barYellowStartX, BAR_Y, barYellowWidth, BAR_HEIGHT, 20);
    ctx.fill();
    
    // Bordure de la barre
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    roundRect(ctx, barGrayStartX, BAR_Y, BAR_FULL_WIDTH, BAR_HEIGHT, 20);
    ctx.stroke();
    
    ctx.restore();

    // Charger les assets
    const lockImage = await loadImage(path.join(__dirname, '../assets/battlepass/lock.png')).catch(() => null);
    
    // Les 5 tiers visibles: du tier actuel au tier actuel+4
    const visibleTiers = [];
    for (let i = 0; i < VISIBLE_TIERS_COUNT; i++) {
        const tier = currentTier + i;
        if (tier > 0 && tier <= TOTAL_TIERS) {
            visibleTiers.push(tier);
        } else if (tier > TOTAL_TIERS) {
            break;
        }
    }

    // Dessiner les tiers
    for (const tier of visibleTiers) {
        const reward = battlePassData[tier];
        if (!reward) continue;

        // Position des tiers:
        // Le palier actuel (currentTier) est TOUJOURS à 25% (où est la barre jaune)
        // Les autres paliers sont espacés de 25% autour
        // Avec la progression XP, tout recule progressivement
        const tierIndex = tier - currentTier; // 0 pour le palier actuel, 1 pour le suivant, -1 pour le précédent
        const x = (CANVAS_WIDTH * BAR_POSITION_RATIO) + (tierIndex * tierWidthOnScreen) - progressOffset;
        
        const rewardSize = 70;
        const vipY = BAR_Y - 120; // Récompenses VIP au-dessus
        const freeY = BAR_Y + BAR_HEIGHT + 50; // Récompenses gratuites en dessous

        // Numéro du tier sur la barre
        ctx.fillStyle = tier === currentTier ? '#FFD700' : '#fff';
        ctx.font = 'bold 18px Poppins-Bold';
        ctx.textAlign = 'center';
        ctx.fillText(tier.toString(), x, BAR_Y + BAR_HEIGHT / 2 + 7);

        // === RÉCOMPENSE VIP (au-dessus) ===
        const isLegendaryVip = typeof reward.vip === 'string' && reward.vip.includes('legendaire');
        
        // Lueur jaune pour légendaire
        if (isLegendaryVip) {
            ctx.save();
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 20;
            ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
            ctx.beginPath();
            ctx.arc(x, vipY, rewardSize / 2 + 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Si pas VIP, afficher cadenas
        if (!isVip && lockImage) {
            ctx.drawImage(lockImage, x - rewardSize / 2, vipY - rewardSize / 2, rewardSize, rewardSize);
        } else {
            // Afficher la récompense VIP
            await drawReward(ctx, reward.vip, x, vipY, rewardSize, '#9b59b6');
        }

        // Label VIP
        ctx.fillStyle = '#9b59b6';
        ctx.font = 'bold 14px Poppins-Bold';
        ctx.textAlign = 'center';
        ctx.fillText('VIP', x, vipY - rewardSize / 2 - 10);

        // === RÉCOMPENSE GRATUITE (en dessous) ===
        const isLegendaryFree = typeof reward.free === 'string' && reward.free.includes('legendaire');
        
        // Lueur jaune pour légendaire
        if (isLegendaryFree) {
            ctx.save();
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 20;
            ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
            ctx.beginPath();
            ctx.arc(x, freeY, rewardSize / 2 + 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Afficher la récompense gratuite
        await drawReward(ctx, reward.free, x, freeY, rewardSize, '#2ecc71');

        // Label GRATUIT
        ctx.fillStyle = '#2ecc71';
        ctx.font = 'bold 14px Poppins-Bold';
        ctx.textAlign = 'center';
        ctx.fillText('GRATUIT', x, freeY + rewardSize / 2 + 25);
    }

    return canvas.toBuffer('image/png');
}

// Fonction pour dessiner une récompense
async function drawReward(ctx, reward, x, y, size, color) {
    let iconPath = null;
    let rewardText = '';

    // Déterminer le type de récompense et l'icône
    if (typeof reward === 'string') {
        rewardText = formatRewardName(reward);
        if (reward.includes('coffre')) {
            iconPath = path.join(__dirname, '../assets/battlepass/chest.png');
        } else if (reward.includes('xp')) {
            iconPath = path.join(__dirname, '../assets/battlepass/xp.png');
        } else if (reward.includes('starss')) {
            iconPath = path.join(__dirname, '../assets/battlepass/star.png');
        }
    } else if (reward && reward.type) {
        rewardText = `${reward.amount}\n${formatRewardName(reward.type)}`;
        if (reward.type.includes('xp')) {
            iconPath = path.join(__dirname, '../assets/battlepass/xp.png');
        } else if (reward.type.includes('starss')) {
            iconPath = path.join(__dirname, '../assets/battlepass/star.png');
        }
    }

    // Charger et afficher l'image si elle existe
    let rewardImage = null;
    if (iconPath && fs.existsSync(iconPath)) {
        try {
            rewardImage = await loadImage(iconPath);
        } catch (e) {
            console.error(`Erreur lors du chargement de ${iconPath}:`, e.message);
        }
    }

    // Fond arrondi pour la récompense
    ctx.save();
    ctx.fillStyle = 'rgba(44, 62, 80, 0.8)';
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Bordure
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Afficher l'image si disponible
    if (rewardImage) {
        const imageSize = size * 0.5;
        ctx.drawImage(rewardImage, x - imageSize / 2, y - imageSize / 2, imageSize, imageSize);
    }

    // Texte de la récompense
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Poppins-Bold';
    ctx.textAlign = 'center';
    
    // Afficher le texte (gérer les sauts de ligne)
    const lines = rewardText.split('\n');
    const lineHeight = 14;
    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    
    // Si image présente, décaler le texte en bas
    const textY = rewardImage ? y + size / 2 - 15 : startY;
    
    lines.forEach((line, index) => {
        ctx.fillText(line, x, rewardImage ? textY + (index * lineHeight) : startY + (index * lineHeight));
    });
}

// Formater le nom de la récompense
function formatRewardName(name) {
    const names = {
        'coffre_normal': 'Coffre',
        'coffre_mega': 'Méga',
        'coffre_legendaire': 'Légendaire',
        'xp_boost': 'XP x2',
        'points_boost': 'Points x2',
        'starss_boost': 'Starss x2',
        'starss': 'Starss',
        'double_daily': '2x Daily',
        'streak_keeper': 'Streak',
        'mega_boost': 'Mega',
        'remboursement': 'Rembours.',
        'joker_guilde': 'Joker',
        'coup_detat': 'Coup État',
        'reset_boutique': 'Reset',
        'guild_upgrader': 'G. Up'
    };
    return names[name] || name;
}

// Fonction pour dessiner des rectangles arrondis
function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

module.exports = { renderBattlePassCard };
