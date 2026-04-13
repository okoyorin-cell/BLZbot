const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const { HALLOWEEN_REWARDS } = require('./halloween-rewards');

// Enregistrer les polices
registerFont(path.join(__dirname, '../assets/fonts/Poppins-Regular.ttf'), { family: 'Poppins' });
registerFont(path.join(__dirname, '../assets/fonts/Poppins-Bold.ttf'), { family: 'Poppins-Bold' });

async function renderHalloweenProfileCard(eventUser, discordUser) {
    const width = 800;
    const height = 600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // --- Arrière-plan ---
    try {
        // Charger l'image de fond
        const backgroundPath = path.join(__dirname, '../assets/haloween.png');
        const background = await loadImage(backgroundPath);
        ctx.drawImage(background, 0, 0, width, height);
    } catch (error) {
        // Si l'image n'est pas trouvée, utiliser un fond orange
        ctx.fillStyle = '#E67E22';
        ctx.fillRect(0, 0, width, height);
    }

    // --- Superposition sombre pour la lisibilité ---
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, width, height);

    // --- En-tête de l'utilisateur ---
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '32px "Poppins-Bold"';
    ctx.fillText(discordUser.username, 200, 70);

    const avatar = await loadImage(discordUser.displayAvatarURL({ extension: 'png', size: 128 }));
    ctx.save();
    ctx.beginPath();
    ctx.arc(100, 80, 64, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 36, 16, 128, 128);
    ctx.restore();

    // --- Statistiques de l'événement ---
    ctx.font = '24px "Poppins-Bold"';
    ctx.fillText('Statistiques d\'Halloween', 50, 200);

    ctx.font = '20px "Poppins"';
    ctx.fillText(`🎃 Citrouilles : ${eventUser.citrouilles.toLocaleString('fr-FR')}`, 50, 240);
    ctx.fillText(`🍬 Bonbons : ${eventUser.bonbons.toLocaleString('fr-FR')}`, 50, 270);
    ctx.fillText(`🎁 Bonbons Surprise : ${eventUser.bonbons_surprise_count.toLocaleString('fr-FR')}`, 50, 300);

    // --- Barre de Progression ---
    const maxCitrouilles = 30000;
    const progress = Math.min(eventUser.citrouilles / maxCitrouilles, 1);
    const progressBarWidth = 700;
    const progressBarHeight = 30;

    ctx.fillStyle = '#4A4A4A';
    ctx.fillRect(50, 350, progressBarWidth, progressBarHeight);

    ctx.fillStyle = '#FFA500';
    ctx.fillRect(50, 350, progressBarWidth * progress, progressBarHeight);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '16px "Poppins-Bold"';
    ctx.textAlign = 'center';
    ctx.fillText(`${eventUser.citrouilles.toLocaleString('fr-FR')} / ${maxCitrouilles.toLocaleString('fr-FR')} Citrouilles`, width / 2, 372);
    ctx.textAlign = 'left';

    // --- Paliers de Récompenses ---
    ctx.font = '24px "Poppins-Bold"';
    ctx.fillText('Paliers de Récompenses', 50, 440);

    ctx.font = '16px "Poppins"';
    const rewardsYStart = 470;
    const rewardsXStart = 50;
    const columnWidth = 250;
    const lineHeight = 25;

    HALLOWEEN_REWARDS.forEach((tier, index) => {
        const column = Math.floor(index / 4); // 4 récompenses par colonne
        const row = index % 4;
        const x = rewardsXStart + column * columnWidth;
        const y = rewardsYStart + row * lineHeight;

        const hasClaimed = eventUser.claimed_rewards.includes(tier.id);
        ctx.fillStyle = hasClaimed ? '#00FF00' : (eventUser.citrouilles >= tier.citrouilles ? '#FFA500' : '#AAAAAA');
        
        const icon = hasClaimed ? '✅' : (eventUser.citrouilles >= tier.citrouilles ? '➡️' : '🔒');
        ctx.fillText(`${icon} ${tier.citrouilles.toLocaleString('fr-FR')} : ${tier.name}`, x, y);
    });

    return canvas.toBuffer('image/png');
}

module.exports = { renderHalloweenProfileCard };
