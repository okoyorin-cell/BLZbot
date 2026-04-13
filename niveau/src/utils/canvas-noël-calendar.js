const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// --- Constantes de Design ---
const width = 1000;
const height = 1200;
const colors = {
    bgTop: '#0f1419',
    bgBottom: '#1a2332',
    presentColors: [
        { base: '#c41e3a', dark: '#8b0000', light: '#dc143c' }, // Rouge
        { base: '#0f4c3a', dark: '#083426', light: '#146b4a' }, // Vert
        { base: '#1e3a8a', dark: '#1e293b', light: '#3b82f6' }, // Bleu
        { base: '#7c2d12', dark: '#431407', light: '#9a3412' }, // Brun
    ],
    ribbon: { gold: '#ffd700', silver: '#e5e7eb', copper: '#b87333' },
    tagBg: '#fffef7',
    tagText: '#1a1a2e',
    title: '#ffffff',
    titleAccent: '#ffd700',
    snow: 'rgba(255, 255, 255, 0.8)',
    sparkle: 'rgba(255, 215, 0, 0.6)'
};

const CALENDAR_DAYS = {
    12: '100 000\nStarss',
    13: '20 000\nRubans',
    14: '24h XP x2',
    15: '2 Cadeaux\nSurprise',
    16: '24h Rang\nx2',
    17: '50 000\nRubans',
    18: '24h Argent\nx2',
    19: '5 Cadeaux\nSurprise',
    20: '5 Bonbons\nd\'Halloween',
    21: '50 000\nXP',
    22: '666 666\nStarss',
    23: '10 Cadeaux\nSurprise',
    24: '100 000 Rubans\n10 000 XP\n1M Starss',
    25: '🎄\nSapin de\nNoël\n🎄',
};

const totalDoors = 14;
const spacing = 25;

// --- Fonctions Utilitaires ---

function createShuffledDays() {
    // Créer une séquence déterministe basée sur la date d'aujourd'hui
    // Cela garantit que les positions des cadeaux restent identiques pendant toute la journée
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    
    let days = Array.from({ length: totalDoors }, (_, i) => i + 12);
    
    // Retirer les jours 14, 18 et 25 pour les placer manuellement
    days = days.filter(d => d !== 14 && d !== 18 && d !== 25);
    
    // Shuffle déterministe basé sur la seed pour les autres jours
    let seeded = seed;
    for (let i = days.length - 1; i > 0; i--) {
        seeded = (seeded * 9301 + 49297) % 233280;
        const j = (seeded / 233280) * (i + 1) | 0;
        [days[i], days[j]] = [days[j], days[i]];
    }
    
    // Ajouter 14, 18 et 25 à la fin (dernière rangée)
    days.push(14, 18, 25);
    return days;
}

function drawGradientBackground(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, colors.bgTop);
    gradient.addColorStop(1, colors.bgBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}

function drawSnowflakes(ctx) {
    ctx.save();
    for (let i = 0; i < 80; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = Math.random() * 3 + 1;
        const opacity = Math.random() * 0.6 + 0.2;
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        if (size > 2) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.5})`;
            ctx.lineWidth = 0.5;
            for (let j = 0; j < 6; j++) {
                const angle = (Math.PI * 2 * j) / 6;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + Math.cos(angle) * size * 2, y + Math.sin(angle) * size * 2);
                ctx.stroke();
            }
        }
    }
    ctx.restore();
}

function drawDecorativeBorder(ctx) {
    ctx.save();
    ctx.strokeStyle = colors.titleAccent;
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
    ctx.shadowBlur = 10;
    const margin = 20;
    ctx.strokeRect(margin, margin, width - margin * 2, height - margin * 2);
    const cornerSize = 30;
    [
        [margin, margin],
        [width - margin, margin],
        [margin, height - margin],
        [width - margin, height - margin]
    ].forEach(([cx, cy]) => {
        ctx.beginPath();
        ctx.arc(cx, cy, cornerSize, 0, Math.PI * 2);
        ctx.stroke();
    });
    ctx.restore();
}

function drawTitle(ctx) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 25;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = colors.title;
    ctx.font = 'bold 72px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText("Calendrier de l'Avent", width / 2, 95);
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = colors.titleAccent;
    ctx.font = 'italic 36px Georgia, serif';
    ctx.fillText("2025", width / 2, 145);
    ctx.strokeStyle = colors.titleAccent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 150, 160);
    ctx.lineTo(width / 2 + 150, 160);
    ctx.stroke();
    ctx.restore();
}

function drawPresent(ctx, centerX, centerY, size, number, colorIndex, isOpened = false) {
    ctx.save();
    ctx.translate(centerX, centerY);
    
    const x = -size / 2;
    const y = -size / 2;
    
    const presentColor = colors.presentColors[colorIndex % colors.presentColors.length];
    const ribbonColor = [colors.ribbon.gold, colors.ribbon.silver, colors.ribbon.copper][colorIndex % 3];
    
    if (isOpened) {
        // Cadeau ouvert (boîte vide)
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 10;
        const innerGradient = ctx.createLinearGradient(x, y, x, y + size);
        innerGradient.addColorStop(0, '#8b5a2b');
        innerGradient.addColorStop(1, '#5c3a1e');
        ctx.fillStyle = innerGradient;
        ctx.beginPath();
        ctx.roundRect(x, y, size, size, 8);
        ctx.fill();
        ctx.strokeStyle = '#3e2a14';
        ctx.lineWidth = 5;
        ctx.stroke();
        
        // Ajout d'une croix pour montrer qu'il est ouvert
        ctx.strokeStyle = ribbonColor + 'AA';
        ctx.lineWidth = size * 0.1;
        ctx.beginPath();
        ctx.moveTo(x + size * 0.2, y + size * 0.2);
        ctx.lineTo(x + size * 0.8, y + size * 0.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + size * 0.8, y + size * 0.2);
        ctx.lineTo(x + size * 0.2, y + size * 0.8);
        ctx.stroke();

    } else {
        // Cadeau fermé
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 8;
        const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
        gradient.addColorStop(0, presentColor.light);
        gradient.addColorStop(0.5, presentColor.base);
        gradient.addColorStop(1, presentColor.dark);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, size, size, 8);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        
        // Brillance
        const shineGradient = ctx.createLinearGradient(x, y, x + size * 0.4, y + size * 0.4);
        shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = shineGradient;
        ctx.fillRect(x, y, size * 0.4, size * 0.4);
        
        // Ruban vertical et horizontal
        ctx.strokeStyle = ribbonColor;
        ctx.lineWidth = size * 0.12;
        ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.beginPath();
        ctx.moveTo(x + size / 2, y);
        ctx.lineTo(x + size / 2, y + size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y + size / 2);
        ctx.lineTo(x + size, y + size / 2);
        ctx.stroke();
        
        // Nœud au centre
        const bowGradient = ctx.createRadialGradient(
            x + size / 2, y + size / 2, 0,
            x + size / 2, y + size / 2, size * 0.12
        );
        bowGradient.addColorStop(0, ribbonColor);
        bowGradient.addColorStop(1, presentColor.dark);
        ctx.fillStyle = bowGradient;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 3;
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size * 0.12, 0, Math.PI * 2);
        ctx.fill();
        
        // Tag avec le numéro
        const tagRadius = size * 0.22;
        const tagX = x + size - (tagRadius * 0.7);
        const tagY = y + (tagRadius * 0.7);
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
        const tagGradient = ctx.createRadialGradient(
            tagX - tagRadius * 0.3, tagY - tagRadius * 0.3, 0,
            tagX, tagY, tagRadius
        );
        tagGradient.addColorStop(0, '#ffffff');
        tagGradient.addColorStop(1, colors.tagBg);
        ctx.fillStyle = tagGradient;
        ctx.beginPath();
        ctx.arc(tagX, tagY, tagRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = ribbonColor;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 5;
        ctx.stroke();
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = colors.tagText;
        ctx.font = `bold ${tagRadius * 1.2}px Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 3;
        ctx.fillText(number.toString(), tagX, tagY);
    }
    
    ctx.restore();
}

/**
 * Génère l'image du calendrier
 * @param {Array<number>} claimedDays - Tableau des jours réclamés (ex: [12, 13, 15])
 * @returns {Buffer} Buffer PNG de l'image
 */
function generateCalendarImage(claimedDays = []) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    drawGradientBackground(ctx);
    drawSnowflakes(ctx);
    drawTitle(ctx);
    
    const days = createShuffledDays();
    
    // Structure de la pyramide
    const layout = [
        { gifts: 3, baseSize: 130 },
        { gifts: 4, baseSize: 140 },
        { gifts: 4, baseSize: 160 },
        { gifts: 3, baseSize: 220 }
    ];
    
    const titleBottomY = 160;
    const startYOffset = 25;
    let currentY = titleBottomY + startYOffset;
    
    let dayIndex = 0;
    let colorIndex = 0;

    layout.forEach(row => {
        const numGifts = row.gifts;
        const baseSize = row.baseSize;
        
        const rowWidth = (numGifts * baseSize) + ((numGifts - 1) * spacing);
        let startX = (width - rowWidth) / 2;
        
        let rowMaxHeight = 0;

        for (let c = 0; c < numGifts; c++) {
            if (dayIndex >= totalDoors) break;
            
            const dayNumber = days[dayIndex];
            
            const sizeJitter = (Math.random() - 0.5) * (baseSize * 0.1);
            let currentBoxSize = baseSize + sizeJitter;
            
            if (dayNumber === 25) {
                currentBoxSize = baseSize * 1.4;
            }
            
            const xJitter = (Math.random() - 0.5) * (spacing * 0.8);
            const yJitter = (Math.random() - 0.5) * (spacing * 0.4);
            
            const centerX = startX + (currentBoxSize / 2) + xJitter;
            const centerY = currentY + (currentBoxSize / 2) + yJitter;
            
            // Vérifier si ce jour a été réclamé (dans le tableau des jours réclamés)
            const isOpened = claimedDays.includes(dayNumber);
            
            drawPresent(
                ctx, 
                centerX, 
                centerY, 
                currentBoxSize, 
                dayNumber, 
                colorIndex, 
                isOpened
            );
            
            startX += currentBoxSize + spacing;
            dayIndex++;
            colorIndex++;
            
            if (currentBoxSize > rowMaxHeight) {
                rowMaxHeight = currentBoxSize;
            }
        }
        
        currentY += rowMaxHeight + spacing;
    });
    
    drawDecorativeBorder(ctx);
    
    return canvas.toBuffer('image/png');
}

module.exports = { generateCalendarImage };
