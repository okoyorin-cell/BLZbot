const db = require('../../database/database');
const logger = require('../logger');

/**
 * Ancienne fonction pour compatibilité
 */
function generateGuildTreasuries() {
    applyDailyIncome(null);
}

/**
 * Ajoute des starss à la trésorerie
 */
function addToTreasury(guildId, amount, bypassWarCheck = false) {
    // Bloquer les ajouts pendant les guerres de guilde (sauf revenus passifs)
    if (!bypassWarCheck) {
        const { isGuildInWar } = require('../db-guilds');
        if (isGuildInWar(guildId)) {
            throw new Error('⚔️ Impossible de modifier la trésorerie pendant une guerre de guilde !');
        }
    }

    const guild = db.prepare('SELECT treasury, treasury_capacity FROM guilds WHERE id = ?').get(guildId);

    if (!guild.treasury_capacity || guild.treasury_capacity === 0) {
        throw new Error('Trésorerie non débloquée (nécessite Upgrade 2+)');
    }

    const newAmount = guild.treasury + amount;
    if (newAmount > guild.treasury_capacity) {
        throw new Error(`Capacité de trésorerie dépassée (max: ${guild.treasury_capacity.toLocaleString('fr-FR')} starss)`);
    }

    db.prepare('UPDATE guilds SET treasury = ?, total_treasury_generated = total_treasury_generated + ? WHERE id = ?')
        .run(newAmount, amount, guildId);

    logger.info(`${amount} starss ajoutés à la trésorerie de la guilde ${guildId}`);
    return newAmount;
}

/**
 * Retire des starss de la trésorerie
 */
function removeFromTreasury(guildId, amount) {
    // Bloquer les retraits pendant les guerres de guilde
    const { isGuildInWar } = require('../db-guilds');
    if (isGuildInWar(guildId)) {
        throw new Error('⚔️ Impossible de modifier la trésorerie pendant une guerre de guilde !');
    }

    const guild = db.prepare('SELECT treasury FROM guilds WHERE id = ?').get(guildId);

    if (guild.treasury < amount) {
        throw new Error('Fonds insuffisants dans la trésorerie');
    }

    const newAmount = guild.treasury - amount;
    db.prepare('UPDATE guilds SET treasury = ? WHERE id = ?').run(newAmount, guildId);

    logger.info(`${amount} starss retirés de la trésorerie de la guilde ${guildId}`);
    return newAmount;
}

/**
 * Distribue équitablement la trésorerie aux membres
 */
function distributeTreasuryEqually(client, guildId) {
    // Bloquer la distribution pendant les guerres de guilde
    const { isGuildInWar } = require('../db-guilds');
    if (isGuildInWar(guildId)) {
        throw new Error('⚔️ Impossible de distribuer la trésorerie pendant une guerre de guilde !');
    }

    const { grantResources } = require('../db-users');

    const guild = db.prepare('SELECT treasury FROM guilds WHERE id = ?').get(guildId);
    const members = db.prepare('SELECT user_id FROM guild_members WHERE guild_id = ?').all(guildId);

    if (members.length === 0) {
        throw new Error('Aucun membre dans la guilde');
    }

    const amountPerMember = Math.floor(guild.treasury / members.length);

    if (amountPerMember === 0) {
        throw new Error('Trésorerie vide ou montant insuffisant');
    }

    // Distribuer aux membres
    for (const member of members) {
        grantResources(client, member.user_id, { stars: amountPerMember, source: 'guild_treasury' });
    }

    // Vider la trésorerie
    db.prepare('UPDATE guilds SET treasury = 0 WHERE id = ?').run(guildId);

    logger.info(`Trésorerie distribuée: ${amountPerMember} starss à ${members.length} membres de la guilde ${guildId}`);
    return { amountPerMember, memberCount: members.length, totalDistributed: amountPerMember * members.length };
}

/**
 * Calcule le revenu passif quotidien
 */
function calculateDailyIncome(guild) {
    const baseIncome = guild.level * 100;

    // Multiplicateurs basés sur les achats
    let multiplier = 1;
    if (guild.treasury_multiplier_purchased >= 2) multiplier = 100;
    if (guild.treasury_multiplier_purchased >= 3) multiplier = 200;
    if (guild.treasury_multiplier_purchased >= 4) multiplier = 400;
    if (guild.treasury_multiplier_purchased >= 5) multiplier = 800;

    return baseIncome * multiplier;
}

/**
 * Applique le revenu passif quotidien à toutes les guildes
 */
function applyDailyIncome(client) {
    const guilds = db.prepare('SELECT * FROM guilds WHERE upgrade_level >= 2').all();

    let totalApplied = 0;
    for (const guild of guilds) {
        const income = calculateDailyIncome(guild);

        try {
            // Calculer combien on peut ajouter sans dépasser la capacité
            const remainingCapacity = guild.treasury_capacity - guild.treasury;
            
            if (remainingCapacity <= 0) {
                logger.info(`Trésorerie de ${guild.name} pleine (${guild.treasury}/${guild.treasury_capacity}), revenu passif non appliqué`);
            } else {
                // Ajouter le minimum entre le revenu et la place restante
                const amountToAdd = Math.min(income, remainingCapacity);
                addToTreasury(guild.id, amountToAdd, true); // bypassWarCheck = true pour le revenu passif
                totalApplied++;
                
                if (amountToAdd < income) {
                    logger.info(`Revenu passif partiel appliqué: ${amountToAdd}/${income} starss pour ${guild.name} (capacité maximale atteinte)`);
                } else {
                    logger.info(`Revenu passif appliqué: ${income} starss pour ${guild.name}`);
                }
            }
        } catch (error) {
            logger.error(`Erreur lors de l'application du revenu passif pour ${guild.name}:`, error);
        }
    }

    logger.info(`Revenu passif appliqué à ${totalApplied} guildes`);
}

/**
 * Vérifie si une guilde peut se permettre un certain montant
 */
function canAffordFromTreasury(guildId, amount) {
    const guild = db.prepare('SELECT treasury FROM guilds WHERE id = ?').get(guildId);
    return guild && guild.treasury >= amount;
}

module.exports = {
    generateGuildTreasuries, // Pour compatibilité
    addToTreasury,
    removeFromTreasury,
    distributeTreasuryEqually,
    calculateDailyIncome,
    applyDailyIncome,
    canAffordFromTreasury
};
