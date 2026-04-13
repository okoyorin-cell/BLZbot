const db = require('../../database/database');
const logger = require('../logger');

/**
 * Système unifié de boosters de guilde (Guild Tools)
 * Commande: /guilde-tools
 * Colonnes DB: xp_boost_purchased, points_boost_purchased, treasury_multiplier_purchased
 * 
 * Boosters disponibles par upgrade level
 */
const BOOSTERS = {
    U4: [
        { id: 'xp_boost_01', name: 'Boost XP 0.05% → 0.1%', cost: 2000000, type: 'xp', level: 1 },
        { id: 'xp_boost_02', name: 'Boost XP 0.1% → 0.2%', cost: 7000000, type: 'xp', level: 2 },
        { id: 'treasury_mult_100', name: 'Trésorerie x1 → x100', cost: 1000000, type: 'treasury', level: 1 },
        { id: 'treasury_mult_200', name: 'Trésorerie x100 → x200', cost: 3000000, type: 'treasury', level: 2 }
    ],
    U8: [
        { id: 'xp_boost_03', name: 'Boost XP 0.2% → 0.4%', cost: 15000000, type: 'xp', level: 3 },
        { id: 'treasury_mult_400', name: 'Trésorerie x200 → x400', cost: 8000000, type: 'treasury', level: 3 },
        { id: 'points_boost_01', name: 'Boost RP +10%', cost: 10000000, type: 'points', level: 1 },
        { id: 'points_boost_02', name: 'Boost RP +20%', cost: 15000000, type: 'points', level: 2 }
    ]
};

/**
 * Récupère les boosters disponibles pour une guilde
 */
function getAvailableBoosters(guild) {
    const available = [];

    if (guild.upgrade_level >= 4) {
        available.push(...BOOSTERS.U4);
    }
    if (guild.upgrade_level >= 8) {
        available.push(...BOOSTERS.U8);
    }

    return available;
}

/**
 * Achète un booster pour la guilde
 */
function purchaseBooster(guildId, boosterId) {
    const guild = db.prepare('SELECT * FROM guilds WHERE id = ?').get(guildId);
    const booster = [...BOOSTERS.U4, ...BOOSTERS.U8].find(b => b.id === boosterId);

    if (!booster) {
        throw new Error('Booster introuvable');
    }

    // Bloquer les achats pendant les guerres de guilde
    const { isGuildInWar } = require('../db-guilds');
    if (isGuildInWar(guildId)) {
        throw new Error('⚔️ Impossible d\'acheter des boosters pendant une guerre de guilde !');
    }

    // Vérifier l'upgrade level
    if (booster.level <= 2 && guild.upgrade_level < 4) {
        throw new Error('Nécessite Upgrade 4');
    }
    if (booster.level >= 3 && guild.upgrade_level < 8) {
        throw new Error('Nécessite Upgrade 8');
    }

    // Vérifier les fonds
    if (guild.treasury < booster.cost) {
        throw new Error(`Fonds insuffisants (${booster.cost.toLocaleString('fr-FR')} starss requis)`);
    }

    // Vérifier si déjà acheté
    const currentLevel = guild[`${booster.type}_boost_purchased`] || 0;

    if (booster.type === 'xp') {
        if (currentLevel >= booster.level) {
            throw new Error('Ce booster est déjà acheté');
        }
        // Vérifier que le niveau précédent est acheté
        if (booster.level > 1 && currentLevel < booster.level - 1) {
            throw new Error('Vous devez d\'abord acheter le booster de niveau précédent');
        }
    } else if (booster.type === 'points') {
        if (currentLevel >= booster.level) {
            throw new Error('Ce booster est déjà acheté');
        }
        // Vérifier que le niveau précédent est acheté
        if (booster.level > 1 && currentLevel < booster.level - 1) {
            throw new Error('Vous devez d\'abord acheter le booster de niveau précédent');
        }
    } else if (booster.type === 'treasury') {
        const currentTreasuryLevel = guild.treasury_multiplier_purchased || 0;
        const targetLevel = booster.level + 1; // x100 = stored as 2, x200 = stored as 3, etc.

        if (currentTreasuryLevel >= targetLevel) {
            throw new Error('Ce booster est déjà acheté');
        }
        // Vérifier que le niveau précédent est acheté (ex: pour x200, il faut avoir x100 = level 2)
        const requiredLevel = booster.level; // Level 2 (x200) requires level 1 (x100) = stored as 2
        if (booster.level > 1 && currentTreasuryLevel < requiredLevel) {
            throw new Error('Vous devez d\'abord acheter le booster de multiplicateur précédent');
        }
    }

    // Acheter le booster
    const transaction = db.transaction(() => {
        db.prepare('UPDATE guilds SET treasury = treasury - ? WHERE id = ?').run(booster.cost, guildId);

        if (booster.type === 'xp') {
            db.prepare('UPDATE guilds SET xp_boost_purchased = ? WHERE id = ?').run(booster.level, guildId);
        } else if (booster.type === 'points') {
            db.prepare('UPDATE guilds SET points_boost_purchased = ? WHERE id = ?').run(booster.level, guildId);
        } else if (booster.type === 'treasury') {
            const newLevel = booster.level + 1; // x100 = level 2, x200 = level 3, etc.
            db.prepare('UPDATE guilds SET treasury_multiplier_purchased = ? WHERE id = ?').run(newLevel, guildId);
        }
    });

    transaction();
    logger.info(`Booster ${booster.id} acheté pour la guilde ${guildId}`);
    return booster;
}

/**
 * Calcule les boosts actifs pour un membre de guilde
 */
function calculateGuildBoosts(guild) {
    // Boost de base: 0.05% par niveau de guilde
    const baseBoostPercent = guild.level * 0.05;

    // Boosts XP
    let xpBoostPercent = baseBoostPercent;
    if (guild.xp_boost_purchased >= 1) xpBoostPercent = guild.level * 0.1;
    if (guild.xp_boost_purchased >= 2) xpBoostPercent = guild.level * 0.2;
    if (guild.xp_boost_purchased >= 3) xpBoostPercent = guild.level * 0.4;

    // Boosts Points
    let pointsBoostPercent = baseBoostPercent;
    if (guild.points_boost_purchased >= 1) pointsBoostPercent += 10;
    if (guild.points_boost_purchased >= 2) pointsBoostPercent += 20;

    // Boosts Stars (même que XP de base)
    let starsBoostPercent = baseBoostPercent;
    if (guild.xp_boost_purchased >= 1) starsBoostPercent = guild.level * 0.1;
    if (guild.xp_boost_purchased >= 2) starsBoostPercent = guild.level * 0.2;
    if (guild.xp_boost_purchased >= 3) starsBoostPercent = guild.level * 0.4;

    return {
        xp: xpBoostPercent / 100, // Convertir en multiplicateur (ex: 5% = 0.05)
        points: pointsBoostPercent / 100,
        stars: starsBoostPercent / 100
    };
}

/**
 * Récupère les boosts actifs pour un utilisateur
 */
function getGuildBoostsForUser(userId) {
    const { getGuildOfUser } = require('../db-guilds');
    const guild = getGuildOfUser(userId);

    if (!guild) {
        return { xp: 0, points: 0, stars: 0 };
    }

    return calculateGuildBoosts(guild);
}

module.exports = {
    BOOSTERS,
    getAvailableBoosters,
    purchaseBooster,
    calculateGuildBoosts,
    getGuildBoostsForUser
};
