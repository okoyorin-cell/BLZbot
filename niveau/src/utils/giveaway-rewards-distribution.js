const logger = require('./logger');
const { grantResources } = require('./db-users');
const { grantEventCurrency } = require('./db-halloween');
const { grantEventCurrency: grantChristmasEventCurrency } = require('./db-noel');

/**
 * @param {import('discord.js').Client} client
 * @param {string[]} winnerIds
 * @param {Array<{ type: string, value: string }>} rewards
 */
async function distributeGiveawayRewards(client, winnerIds, rewards) {
    for (const winnerId of winnerIds) {
        for (const reward of rewards) {
            try {
                switch (reward.type) {
                    case 'role': {
                        const guild = client.guilds.cache.first();
                        const member = await guild.members.fetch(winnerId);
                        const role = guild.roles.cache.get(reward.value);
                        if (role && member && !member.roles.cache.has(role.id)) {
                            await member.roles.add(role);
                        }
                        break;
                    }
                    case 'xp':
                        grantResources(client, winnerId, { xp: parseInt(reward.value, 10), source: 'giveaway' });
                        break;
                    case 'stars':
                        grantResources(client, winnerId, { stars: parseInt(reward.value, 10), source: 'giveaway' });
                        break;
                    case 'bonbons':
                        grantEventCurrency(winnerId, { bonbons: parseInt(reward.value, 10) });
                        break;
                    case 'citrouilles':
                        grantEventCurrency(winnerId, { citrouilles: parseInt(reward.value, 10) });
                        break;
                    case 'bonbons_surprise':
                        grantEventCurrency(winnerId, { bonbons_surprise: parseInt(reward.value, 10) });
                        break;
                    case 'rubans':
                        grantChristmasEventCurrency(winnerId, { rubans: parseInt(reward.value, 10) });
                        break;
                    case 'cadeaux_surprise':
                        grantChristmasEventCurrency(winnerId, { cadeaux_surprise: parseInt(reward.value, 10) });
                        break;
                    default:
                        break;
                }
            } catch (error) {
                logger.error(`Erreur lors de la distribution de ${reward.type} à ${winnerId}:`, error);
            }
        }
    }
}

module.exports = { distributeGiveawayRewards };
