const { grantResources, addXp } = require('./db-users');
const { grantEventCurrency } = require('./db-halloween');
const mainDb = require('../database/database');
const { QUESTS, checkQuestProgress } = require('./quests');
const logger = require('./logger');
const roleConfig = require('../config/role.config.json');

const BONBON_ROLES = roleConfig.eventRoles.halloween.bonbonRewards;

// --- Table des Récompenses du Bonbon Surprise ---
// La somme des "weight" doit faire 100
const SURPRISE_REWARDS = [
    { type: 'stars', amount: 2500, weight: 20 },  // Divisé par 4 : 10000 → 2500
    { type: 'xp', amount: 500, weight: 22.5 },  // Divisé par 4 : 2000 → 500
    { type: 'citrouilles', amount: 100, weight: 10 },  // Réduit : 500 → 100
    { type: 'bonbons', amount: 10000, weight: 10 },
    { type: 'stars', amount: 12500, weight: 8 },  // Divisé par 4 : 50000 → 12500
    { type: 'xp', amount: 2000, weight: 8 },  // Divisé par 4 : 8000 → 2000
    { type: 'bonbons', amount: 8000, weight: 6 },  // Réduit : 30000 → 8000
    { type: 'citrouilles', amount: 1000, weight: 5 },  // Réduit : 10000 → 1000
    { type: 'role', name: BONBON_ROLES.bonbonDore.name, weight: 4.8 },  // Réduit : 5% → 4.8%
    { type: 'auto_quest', weight: 4 }, // Ajusté pour que le total fasse 100
    { type: 'jackpot', weight: 0.5 },
    { type: 'role', name: BONBON_ROLES.bonbonLegendaire.name, weight: 1 },
    { type: 'role', name: BONBON_ROLES.masterBonbon.name, weight: 0.2 },  // Nouveau rôle exceptionnel
];

const JACKPOT_REWARDS = {
    stars: 250000,  // Divisé par 4 : 1000000 → 250000
    xp: 2500,  // Divisé par 4 : 10000 → 2500
    bonbons: 50000,
    citrouilles: 2000  // Réduit : 15000 → 2000
};

// --- Fonction de Sélection Pondérée ---
function openBonbonSurprise() {
    const totalWeight = SURPRISE_REWARDS.reduce((acc, reward) => acc + reward.weight, 0);
    let random = Math.random() * totalWeight;

    for (const reward of SURPRISE_REWARDS) {
        if (random < reward.weight) {
            return reward;
        }
        random -= reward.weight;
    }
}

// --- Fonction pour Appliquer les Récompenses ---
async function applyReward(client, userId, reward) {
    const user = await client.users.fetch(userId);

    switch (reward.type) {
        case 'stars':
            grantResources(client, userId, { stars: reward.amount, source: 'halloween' });
            return `${reward.amount.toLocaleString('fr-FR')} Starss`;
        case 'xp':
            grantResources(client, userId, { xp: reward.amount, source: 'halloween' });
            return `${reward.amount.toLocaleString('fr-FR')} XP`;
        case 'citrouilles':
        case 'bonbons':
            grantEventCurrency(userId, { [reward.type]: reward.amount });
            return `${reward.amount.toLocaleString('fr-FR')} ${reward.type}`;
        case 'role':
            const guild = await client.guilds.fetch(process.env.GUILD_ID);
            let role = guild.roles.cache.find(r => r.name === reward.name);
            if (!role) {
                const roleColors = {
                    [BONBON_ROLES.bonbonDore.name]: BONBON_ROLES.bonbonDore.color,
                    [BONBON_ROLES.bonbonLegendaire.name]: BONBON_ROLES.bonbonLegendaire.color,
                    [BONBON_ROLES.masterBonbon.name]: BONBON_ROLES.masterBonbon.color,
                };
                const color = roleColors[reward.name] || '#9932CC';
                role = await guild.roles.create({ name: reward.name, color: color, reason: 'Récompense Bonbon Surprise' });
            }
            const member = await guild.members.fetch(userId);
            if (member && !member.roles.cache.has(role.id)) {
                await member.roles.add(role);
                return `Rôle "${reward.name}"`;
            } else if (member && member.roles.cache.has(role.id)) {
                // Le membre a déjà le rôle, donner des Starss à la place
                grantResources(client, userId, { stars: 25000, source: 'halloween' });  // Divisé par 4 : 100000 → 25000
                return `25 000 Starss (vous aviez déjà "${reward.name}")`;
            }
            return `Rôle "${reward.name}"`;
        case 'auto_quest':
            const dbQuests = require('./db-quests');
            // Récupérer toutes les quêtes déjà complétées par l'utilisateur
            const completedQuests = mainDb.prepare('SELECT quest_id FROM quest_progress WHERE user_id = ? AND completed != 0').all(userId).map(q => q.quest_id);
            // Filtrer pour ne garder que les quêtes non complétées (et pas Goatesque)
            const availableQuests = Object.values(QUESTS).filter(q =>
                q.rarity !== 'Goatesque' && !completedQuests.includes(q.id)
            );

            if (availableQuests.length > 0) {
                const randomQuest = availableQuests[Math.floor(Math.random() * availableQuests.length)];

                // Vérifier encore une fois que la quête n'est pas déjà complétée (sécurité)
                const existingProgress = mainDb.prepare('SELECT completed FROM quest_progress WHERE user_id = ? AND quest_id = ?').get(userId, randomQuest.id);
                if (existingProgress && existingProgress.completed !== 0) {
                    // La quête est déjà complétée, donner des Starss à la place
                    grantResources(client, userId, { stars: 125000, source: 'halloween' });
                    return `Quête déjà complétée ! +125 000 Starss`;
                }

                // Compléter directement la quête
                const goal = typeof randomQuest.goal === 'number' ? randomQuest.goal : 1;
                dbQuests.updateQuestProgress(userId, randomQuest.id, goal);
                dbQuests.completeQuest(userId, randomQuest.id);

                // Accorder les récompenses
                if (randomQuest.reward.stars) {
                    grantResources(client, userId, { stars: randomQuest.reward.stars, source: 'halloween' });
                }
                if (randomQuest.reward.bonbons) {
                    grantEventCurrency(userId, { bonbons: randomQuest.reward.bonbons });
                }
                if (randomQuest.reward.role) {
                    const guild = await client.guilds.fetch(process.env.GUILD_ID);
                    let role = guild.roles.cache.find(r => r.name === randomQuest.reward.role);
                    if (!role) {
                        role = await guild.roles.create({ name: randomQuest.reward.role, reason: 'Récompense de quête (Bonbon Surprise)' });
                    }
                    const member = await guild.members.fetch(userId);
                    // ✅ VÉRIFIER si le membre a déjà le rôle
                    if (member && !member.roles.cache.has(role.id)) {
                        await member.roles.add(role);
                    } else if (member && member.roles.cache.has(role.id)) {
                        // Le membre a déjà le rôle, donner des Starss supplémentaires
                        grantResources(client, userId, { stars: 25000, source: 'halloween' });
                    }
                }

                return `Quête auto-complétée : "${randomQuest.name}"`;
            } else {
                grantResources(client, userId, { stars: 125000, source: 'halloween' });  // Divisé par 4 : 500000 → 125000
                return `Toutes les quêtes sont déjà finies ! +125 000 Starss`;
            }
        case 'jackpot':
            grantResources(client, userId, { stars: JACKPOT_REWARDS.stars, xp: JACKPOT_REWARDS.xp, source: 'halloween' });
            grantEventCurrency(userId, { bonbons: JACKPOT_REWARDS.bonbons, citrouilles: JACKPOT_REWARDS.citrouilles });
            return `LE JACKPOT ! (+${Object.values(JACKPOT_REWARDS).map(v => v.toLocaleString('fr-FR')).join(', ')})`;
    }
}

module.exports = { openBonbonSurprise, applyReward, JACKPOT_REWARDS, SURPRISE_REWARDS };
