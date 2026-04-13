const { createCanvas, registerFont, loadImage } = require('canvas');
const path = require('path');
const logger = require('./logger');

// Enregistrer les polices personnalisées
try {
    registerFont(path.join(__dirname, '..', 'assets', 'fonts', 'arial.ttf'), { family: 'Arial' });
} catch (e) {
    logger.debug('Police personnalisée non trouvée, utilisation de polices système');
}

async function generateNoelProfileCanvas(user, eventUser, multipliers) {
    const width = 1600;
    const height = 900;
    
    // Vérification des données
    if (!eventUser) {
        throw new Error('eventUser est vide');
    }
    
    // Initialiser les propriétés manquantes
    eventUser.rubans = eventUser.rubans ?? 0;
    eventUser.cadeaux_surprise = eventUser.cadeaux_surprise ?? 0;
    
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // --- FOND DÉGRADÉ NOËL AMÉLIORÉ ---
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#0a1f14');
    gradient.addColorStop(0.5, '#1a472a');
    gradient.addColorStop(1, '#0f3d1f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Décoration étoiles de Noël en arrière-plan
    drawBackgroundStars(ctx, width, height);

    // --- PANNEAU PRINCIPAL (proportionnel) ---
    const margin = 35;
    const panelX = margin;
    const panelY = margin;
    const panelWidth = 970;
    const panelHeight = height - (margin * 2);
    
    // Fond du panneau avec bordure dorée
    ctx.fillStyle = 'rgba(10, 25, 20, 0.85)';
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    
    // Bordure dorée épaisse
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 6;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
    
    // Bordure intérieure pour effet 3D
    ctx.strokeStyle = '#FFA500';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(panelX + 3, panelY + 3, panelWidth - 6, panelHeight - 6);

    // --- HEADER AVEC AVATAR ---
    const headerPadding = 35;
    const avatarSize = 105;
    const avatarX = panelX + headerPadding;
    const avatarY = panelY + headerPadding;

    // Cercle doré autour de l'avatar
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 3, 0, Math.PI * 2);
    ctx.stroke();
    
    // Fond blanc pour l'avatar
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.fill();

    // Avatar de l'utilisateur
    try {
        const userAvatar = await loadImage(user.displayAvatarURL({ extension: 'png', size: 128 }));
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 - 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(userAvatar, avatarX + 2, avatarY + 2, avatarSize - 4, avatarSize - 4);
        ctx.restore();
    } catch (e) {
        logger.warn('Impossible de charger l\'avatar');
    }

    // Pseudo et titre (aligné verticalement avec avatar)
    const textX = avatarX + avatarSize + 30;
    const textY = avatarY + 35;
    
    // Utiliser le displayName (nom d'affichage)
    const displayName = user.displayName || user.username;
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 38px Arial';
    ctx.fillText(displayName, textX, textY);

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 19px Arial';
    ctx.fillText('🎄 Profil de l\'Événement Noël', textX, textY + 35);

    // --- LIGNE DE SÉPARATION ---
    const separatorY = panelY + 170;
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(panelX + 30, separatorY);
    ctx.lineTo(panelX + panelWidth - 30, separatorY);
    ctx.stroke();

    // --- STATISTIQUES PRINCIPALES (3 grandes boîtes) ---
    const statsStartY = separatorY + 30;
    const statBoxWidth = panelWidth - 70;
    const statBoxHeight = 115;
    const statSpacing = 18;

    // Rubans
    drawEnhancedStatBox(ctx, panelX + 35, statsStartY, '🎀', 'Rubans', eventUser.rubans.toLocaleString('fr-FR'), '#DC143C', statBoxWidth, statBoxHeight);

    // Cadeaux
    drawEnhancedStatBox(ctx, panelX + 35, statsStartY + statBoxHeight + statSpacing, '🎁', 'Cadeaux Surprise', (eventUser.cadeaux_surprise_count || 0).toLocaleString('fr-FR'), '#FFD700', statBoxWidth, statBoxHeight);

    // Boosts actifs count
    const activeBoostsCount = [
        multipliers.xp_money_x2,
        multipliers.rank_points_x2,
        multipliers.xp_x2_calendar,
        multipliers.rank_points_x2_calendar,
        multipliers.stars_x2_calendar
    ].filter(b => b).length;
    
    drawEnhancedStatBox(ctx, panelX + 35, statsStartY + (statBoxHeight + statSpacing) * 2, '⚡', 'Boosts Actifs', activeBoostsCount.toString(), '#00CCFF', statBoxWidth, statBoxHeight);

    // --- SECTION BOOSTS DÉTAILLÉS ---
    const boostsHeaderY = statsStartY + (statBoxHeight + statSpacing) * 3 + 30;
    
    // Fond de la section boosts
    const boostSectionHeight = 165;
    ctx.fillStyle = 'rgba(255, 215, 0, 0.05)';
    ctx.fillRect(panelX + 35, boostsHeaderY - 12, statBoxWidth, boostSectionHeight);
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(panelX + 35, boostsHeaderY - 12, statBoxWidth, boostSectionHeight);
    
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('⚡ Détails des Boosts', panelX + 52, boostsHeaderY + 20);

    const boostsList = [];
    if (multipliers.xp_money_x2?.remaining) {
        boostsList.push({ emoji: '💰', name: 'Argent/Starss X2', time: multipliers.xp_money_x2.remaining });
    }
    if (multipliers.rank_points_x2?.remaining) {
        boostsList.push({ emoji: '📈', name: 'Points Rang X2', time: multipliers.rank_points_x2.remaining });
    }
    if (multipliers.xp_x2_calendar?.remaining) {
        boostsList.push({ emoji: '📅', name: 'XP Calendrier X2', time: multipliers.xp_x2_calendar.remaining });
    }
    if (multipliers.rank_points_x2_calendar?.remaining) {
        boostsList.push({ emoji: '🎯', name: 'Rang Calendrier X2', time: multipliers.rank_points_x2_calendar.remaining });
    }
    if (multipliers.stars_x2_calendar?.remaining) {
        boostsList.push({ emoji: '⭐', name: 'Starss Calendrier X2', time: multipliers.stars_x2_calendar.remaining });
    }

    if (boostsList.length === 0) {
        ctx.fillStyle = '#999999';
        ctx.font = 'italic 20px Arial';
        ctx.fillText('Aucun boost actif pour le moment', panelX + 65, boostsHeaderY + 68);
    } else {
        boostsList.slice(0, 4).forEach((boost, index) => {
            const yPos = boostsHeaderY + 56 + (index * 28);
            
            // Emoji et nom (agrandi)
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '19px Arial';
            ctx.fillText(`${boost.emoji} ${boost.name}`, panelX + 65, yPos);
            
            // Temps restant (aligné à droite, agrandi)
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 17px Arial';
            const timeText = formatTime(boost.time);
            const timeWidth = ctx.measureText(timeText).width;
            ctx.fillText(timeText, panelX + statBoxWidth + 20 - timeWidth, yPos);
        });
    }

    // --- PANNEAU CALENDRIER (à droite) ---
    drawAdventCalendarPanel(ctx, panelX + panelWidth + 25, panelY, width - panelX - panelWidth - 60, panelHeight, eventUser.claimed_calendar_rewards || []);

    return canvas.toBuffer('image/png');
}

function drawEnhancedStatBox(ctx, x, y, emoji, label, value, color, width, height) {
    // Fond avec gradient
    const statGradient = ctx.createLinearGradient(x, y, x, y + height);
    statGradient.addColorStop(0, color + '30');
    statGradient.addColorStop(1, color + '10');
    ctx.fillStyle = statGradient;
    ctx.fillRect(x, y, width, height);

    // Bordure colorée avec effet brillant
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.strokeRect(x, y, width, height);
    
    // Bordure intérieure plus claire
    ctx.strokeStyle = color + '80';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x + 2, y + 2, width - 4, height - 4);

    // Emoji (plus grand proportionnellement)
    ctx.font = '56px Arial';
    ctx.fillText(emoji, x + 18, y + height / 2 + 18);

    // Label (agrandi sans dépasser)
    ctx.fillStyle = '#CCCCCC';
    ctx.font = 'bold 21px Arial';
    ctx.fillText(label, x + 95, y + 37);

    // Valeur (alignée et plus grande proportionnellement)
    ctx.fillStyle = color;
    ctx.font = 'bold 47px Arial';
    ctx.fillText(value, x + 95, y + 82);
}

function drawAdventCalendarPanel(ctx, x, y, width, height, claimedDays = []) {
    // Convertir en Set pour recherche rapide
    const claimedSet = new Set(claimedDays);
    // Panneau avec bordure proportionnelle
    ctx.fillStyle = 'rgba(10, 25, 20, 0.85)';
    ctx.fillRect(x, y, width, height);
    
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 6;
    ctx.strokeRect(x, y, width, height);
    
    ctx.strokeStyle = '#FFA500';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x + 3, y + 3, width - 6, height - 6);

    // Titre (proportionnel)
    const titleY = y + 30;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 23px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('📅 Calendrier', x + width / 2, titleY + 18);
    ctx.textAlign = 'left';

    // Générer positions mélangées des cadeaux (identique à /calendrier)
    const presentPositions = createShuffledDays();
    
    // Configuration de la grille : 4 colonnes × 4 rangées (espacement minimal, cadeaux 115px)
    const gridCols = 4;
    const gridRows = 4;
    const cellSize = 115;
    const cellSpacing = 6;
    const rowSpacing = 12; // Espacement vertical entre les lignes (plus grand)
    const gridStartX = x + (width - (gridCols * cellSize + (gridCols - 1) * cellSpacing)) / 2;
    const gridStartY = titleY + 30;

    // Dessiner chaque cadeau
    presentPositions.forEach((day, index) => {
        const col = index % gridCols;
        const row = Math.floor(index / gridCols);
        const cellX = gridStartX + col * (cellSize + cellSpacing);
        const cellY = gridStartY + row * (cellSize + rowSpacing);
        
        // Vérifier si le jour est réclamé (dans le tableau/Set des jours réclamés)
        const isClaimed = claimedSet.has(day);
        
        drawCalendarPresent(ctx, cellX + cellSize / 2, cellY + cellSize / 2, cellSize * 0.8, day, index % 4, isClaimed);
    });
}

function createShuffledDays() {
    // Séquence déterministe basée sur la date (identique à /calendrier)
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    
    let days = Array.from({ length: 14 }, (_, i) => i + 12);
    
    // Retirer les jours 14, 18 et 25 pour les placer manuellement à la fin
    days = days.filter(d => d !== 14 && d !== 18 && d !== 25);
    
    // Mélange déterministe
    function seededRandom(s) {
        const x = Math.sin(s++) * 10000;
        return x - Math.floor(x);
    }
    
    for (let i = days.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom(seed + i) * (i + 1));
        [days[i], days[j]] = [days[j], days[i]];
    }
    
    // Ajouter 14, 18 et 25 à la fin (dernière rangée)
    days.push(14, 18, 25);
    
    return days;
}

function drawStar(ctx, cx, cy, outerRadius, innerRadius, points) {
    ctx.save();
    ctx.beginPath();
    ctx.translate(cx, cy);
    ctx.moveTo(0, 0 - outerRadius);
    for (let i = 0; i < points; i++) {
        ctx.rotate(Math.PI / points);
        ctx.lineTo(0, 0 - (innerRadius * outerRadius));
        ctx.rotate(Math.PI / points);
        ctx.lineTo(0, 0 - outerRadius);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function drawCalendarPresent(ctx, x, y, size, number, colorIndex, isOpened) {
    const colors = [
        { base: '#c41e3a', dark: '#8b0000', light: '#dc143c' },
        { base: '#0f4c3a', dark: '#083426', light: '#146b4a' },
        { base: '#1e3a8a', dark: '#1e293b', light: '#3b82f6' },
        { base: '#7c2d12', dark: '#431407', light: '#9a3412' }
    ];
    
    const color = colors[colorIndex];
    
    if (isOpened === true) {
        // Cadeau ouvert - boîte vide avec étoiles
        const boxSize = size;
        
        // Corps du cadeau (plus sombre pour montrer qu'il est vide)
        const innerGradient = ctx.createLinearGradient(x - boxSize / 2, y - boxSize / 2, x + boxSize / 2, y + boxSize / 2);
        innerGradient.addColorStop(0, '#8b5a2b');
        innerGradient.addColorStop(1, '#5c3a1e');
        ctx.fillStyle = innerGradient;
        ctx.fillRect(x - boxSize / 2, y - boxSize / 2, boxSize, boxSize);
        
        // Bordure foncée
        ctx.strokeStyle = '#3e2a14';
        ctx.lineWidth = 3;
        ctx.strokeRect(x - boxSize / 2, y - boxSize / 2, boxSize, boxSize);
        
        // Couvercle ouvert (en haut à côté)
        ctx.fillStyle = color.base;
        ctx.save();
        ctx.translate(x + boxSize / 2 + 5, y - boxSize / 2);
        ctx.rotate(Math.PI / 6);
        ctx.fillRect(-10, -5, boxSize * 0.4, 10);
        ctx.strokeStyle = color.dark;
        ctx.lineWidth = 2;
        ctx.strokeRect(-10, -5, boxSize * 0.4, 10);
        ctx.restore();
        
        // Étoiles dorées qui sortent de la boîte
        ctx.fillStyle = '#FFD700';
        
        // Étoile 1 (grande au centre)
        drawStar(ctx, x, y - boxSize / 4, 8, 5, 0.5);
        
        // Étoile 2 (petite à gauche)
        drawStar(ctx, x - 12, y - 8, 5, 5, 0.5);
        
        // Étoile 3 (petite à droite)
        drawStar(ctx, x + 12, y - 8, 5, 5, 0.5);
        
        // Particules brillantes
        ctx.fillStyle = 'rgba(255, 215, 0, 0.6)';
        for (let i = 0; i < 5; i++) {
            const angle = (Math.PI * 2 * i) / 5;
            const px = x + Math.cos(angle) * (boxSize / 3);
            const py = y + Math.sin(angle) * (boxSize / 3) - 5;
            ctx.beginPath();
            ctx.arc(px, py, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Numéro en petit doré en dessous
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(number, x, y + boxSize / 2 + 15);
    } else {
        // Cadeau fermé avec ruban
        const boxSize = size;
        
        // Corps du cadeau
        ctx.fillStyle = color.base;
        ctx.fillRect(x - boxSize / 2, y - boxSize / 2, boxSize, boxSize);
        
        // Ombres pour effet 3D (plus épaisses)
        ctx.fillStyle = color.dark;
        ctx.fillRect(x + boxSize / 2 - 7, y - boxSize / 2, 7, boxSize);
        ctx.fillRect(x - boxSize / 2, y + boxSize / 2 - 7, boxSize, 7);
        
        // Ruban horizontal doré (encore plus épais)
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(x - boxSize / 2, y - 4, boxSize, 8);
        
        // Ruban vertical doré (encore plus épais)
        ctx.fillRect(x - 4, y - boxSize / 2, 8, boxSize);
        
        // Noeud en haut (plus gros)
        ctx.beginPath();
        ctx.arc(x - 8, y - boxSize / 2 - 5, 5, 0, Math.PI * 2);
        ctx.arc(x + 8, y - boxSize / 2 - 5, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Étiquette avec numéro (encore plus grande)
        const tagWidth = 32;
        const tagHeight = 18;
        
        // Fond de l'étiquette (blanc cassé)
        ctx.fillStyle = '#fffef7';
        ctx.fillRect(x - tagWidth / 2, y + boxSize / 2 + 3, tagWidth, tagHeight);
        
        // Bordure de l'étiquette (plus épaisse)
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - tagWidth / 2, y + boxSize / 2 + 3, tagWidth, tagHeight);
        
        // Numéro sur l'étiquette (plus gros)
        ctx.fillStyle = '#1a1a2e';
        ctx.font = 'bold 15px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(number, x, y + boxSize / 2 + 12);
    }
    
    // Reset text align
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
}

function drawBackgroundStars(ctx, width, height) {
    ctx.fillStyle = 'rgba(255, 215, 0, 0.08)';
    
    for (let i = 0; i < 50; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = Math.random() * 4 + 2;
        
        drawStar(ctx, x, y, size);
    }
}

function drawStar(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    
    for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const px = Math.cos(angle) * size;
        const py = Math.sin(angle) * size;
        
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function formatTime(ms) {
    if (!ms || ms <= 0) return 'Expiré';
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) {
        if (minutes > 0) {
            return `${hours}h${minutes}m`;
        }
        return `${hours}h`;
    }
    return `${minutes}m`;
}

module.exports = { generateNoelProfileCanvas };
