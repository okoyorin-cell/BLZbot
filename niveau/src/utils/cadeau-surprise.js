const { grantResources } = require('./db-users');
const { grantEventCurrency } = require('./db-noel');
const mainDb = require('../database/database');
const { QUESTS, checkQuestProgress } = require('./quests');
const logger = require('./logger');
const roleConfig = require('../config/role.config.json');

const NOEL_ROLES = roleConfig.eventRoles.noel.roles;

// --- Table des Récompenses du Cadeau Surprise de Noël ---
// Les pourcentages doivent totaliser 100%
const SURPRISE_REWARDS = [
    { type: 'stars_and_xp', stars: 50000, xp: 1500, weight: 50 },  // 50%
    { type: 'multiplier_stars', duration: 3600000, weight: 25 },    // 25% (1h)
    { type: 'multiplier_rank', duration: 3600000, weight: 13 },     // 13% (1h)
    { type: 'role', name: NOEL_ROLES.pereNoel.name, weight: 5 },              // 5%
    { type: 'jackpot', weight: 4 },                                   // 4%
    { type: 'cadeaux_multi', amount: 5, weight: 2 },                // 2%
    { type: 'role', name: NOEL_ROLES.maitreNoel.name, weight: 1 },            // 1%
];

const JACKPOT_REWARDS = {
    stars: 1000000,
    xp: 17500,
};

// --- Fonction de Sélection Pondérée ---
function openCadeauSurprise() {
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
    const { setMultiplier, getActiveMultiplier } = require('./db-noel');

    switch (reward.type) {
        case 'stars_and_xp':
            grantResources(client, userId, { stars: reward.stars, xp: reward.xp, source: 'noel' });
            return `${reward.stars.toLocaleString('fr-FR')} Starss et ${reward.xp.toLocaleString('fr-FR')} XP`;

        case 'multiplier_stars':
            const existingStars = getActiveMultiplier(userId, 'xp_money_x2');
            setMultiplier(userId, 'xp_money_x2', reward.duration);
            const hoursStars = Math.floor(reward.duration / 3600000);
            if (existingStars) {
                const addedHours = Math.floor(reward.duration / 3600000);
                return `✨ Multiplicateur X2 Argent/Starss prolongé de ${addedHours}h`;
            }
            return `✨ Multiplicateur X2 Argent/Starss pendant ${hoursStars}h`;

        case 'multiplier_rank':
            const existingRank = getActiveMultiplier(userId, 'rank_points_x2');
            setMultiplier(userId, 'rank_points_x2', reward.duration);
            const hoursRank = Math.floor(reward.duration / 3600000);
            if (existingRank) {
                const addedHours = Math.floor(reward.duration / 3600000);
                return `✨ Multiplicateur X2 Points de Rang prolongé de ${addedHours}h`;
            }
            return `✨ Multiplicateur X2 Points de Rang pendant ${hoursRank}h`;

        case 'role':
            const guild = await client.guilds.fetch(process.env.GUILD_ID);
            let role = guild.roles.cache.find(r => r.name === reward.name);

            if (!role) {
                const roleColors = {
                    [NOEL_ROLES.pereNoel.name]: NOEL_ROLES.pereNoel.color,
                    [NOEL_ROLES.maitreNoel.name]: NOEL_ROLES.maitreNoel.color,
                };
                const color = roleColors[reward.name] || '#FFFFFF';
                role = await guild.roles.create({
                    name: reward.name,
                    color: color,
                    reason: 'Récompense Cadeau Surprise Noël'
                });
            }

            const member = await guild.members.fetch(userId);
            if (member && !member.roles.cache.has(role.id)) {
                await member.roles.add(role);
                return `🎄 Rôle "${reward.name}" obtenu !`;
            } else if (member && member.roles.cache.has(role.id)) {
                grantResources(client, userId, { stars: 50000, source: 'noel' });
                return `50 000 Starss (vous aviez déjà "${reward.name}")`;
            }
            return `🎄 Rôle "${reward.name}"`;

        case 'jackpot':
            grantResources(client, userId, { stars: JACKPOT_REWARDS.stars, xp: JACKPOT_REWARDS.xp, source: 'noel' });
            return `🎁 LE JACKPOT ! +${JACKPOT_REWARDS.stars.toLocaleString('fr-FR')} Starss et +${JACKPOT_REWARDS.xp.toLocaleString('fr-FR')} XP`;

        case 'cadeaux_multi':
            grantEventCurrency(userId, { cadeaux_surprise: reward.amount });
            return `🎁 ${reward.amount} Cadeaux Surprise supplémentaires !`;

        default:
            return 'Récompense inconnue';
    }
}

module.exports = { openCadeauSurprise, applyReward, JACKPOT_REWARDS, SURPRISE_REWARDS };
