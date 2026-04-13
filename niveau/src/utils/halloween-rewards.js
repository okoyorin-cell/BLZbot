const { EmbedBuilder } = require('discord.js');
const { grantResources, addXp } = require('./db-users');
const { grantEventCurrency, addClaimedReward } = require('./db-halloween');
const logger = require('./logger');
const roleConfig = require('../config/role.config.json');

const LEGENDARY_PUMPKIN_ROLE = roleConfig.eventRoles.halloween.legendaryPumpkin.name;

const HALLOWEEN_REWARDS = [
    { id: 'reward_100', citrouilles: 100, reward: { bonbons: 1000 }, name: '1 000 Bonbons' },
    { id: 'reward_250', citrouilles: 250, reward: { bonbons_surprise: 2 }, name: '2 Bonbons Surprise' },
    { id: 'reward_500', citrouilles: 500, reward: { stars: 150000 }, name: '150 000 Starss' },
    { id: 'reward_1000', citrouilles: 1000, reward: { bonbons: 15000 }, name: '15 000 Bonbons' },
    { id: 'reward_5000', citrouilles: 5000, reward: { xp: 20000 }, name: '20 000 XP' },
    { id: 'reward_10000', citrouilles: 10000, reward: { bonbons_surprise: 10 }, name: '10 Bonbons Surprise' },
    { id: 'reward_30000', citrouilles: 30000, reward: { role: LEGENDARY_PUMPKIN_ROLE }, name: `Rôle "${LEGENDARY_PUMPKIN_ROLE}"` },
];

async function checkAndGrantHalloweenRewards(client, eventUser) {
    const user = await client.users.fetch(eventUser.user_id).catch(() => null);
    if (!user) return;

    for (const tier of HALLOWEEN_REWARDS) {
        // Vérifie si le palier est atteint et n'a pas déjà été réclamé
        if (eventUser.citrouilles >= tier.citrouilles && !eventUser.claimed_rewards.includes(tier.id)) {
            try {
                // Accorder la récompense
                if (tier.reward.bonbons) {
                    grantEventCurrency(user.id, { bonbons: tier.reward.bonbons });
                }
                if (tier.reward.bonbons_surprise) {
                    grantEventCurrency(user.id, { bonbons_surprise: tier.reward.bonbons_surprise });
                }
                if (tier.reward.stars) {
                    grantResources(client, user.id, { stars: tier.reward.stars, source: 'halloween' });
                }
                if (tier.reward.xp) {
                    grantResources(client, user.id, { xp: tier.reward.xp, source: 'halloween' });
                }
                if (tier.reward.role) {
                    const guild = await client.guilds.fetch(process.env.GUILD_ID);
                    let role = guild.roles.cache.find(r => r.name === tier.reward.role);
                    if (!role) {
                        role = await guild.roles.create({ name: tier.reward.role, reason: 'Récompense événement Halloween' });
                    }
                    const member = await guild.members.fetch(user.id);
                    if (member) await member.roles.add(role);
                }

                // Marquer la récompense comme réclamée
                addClaimedReward(user.id, tier.id);

                // Notifier l'utilisateur
                const embed = new EmbedBuilder()
                    .setTitle('🎃 Palier de Récompense Atteint ! 🎃')
                    .setDescription(`Félicitations ! Vous avez atteint un nouveau palier de l'événement Halloween et gagné : **${tier.name}** !`)
                    .setColor('Orange')
                    .setThumbnail('https://i.imgur.com/h1h4B0t.png') // Generic pumpkin icon
                    .setTimestamp();

                await user.send({ embeds: [embed] }).catch(err => {
                    logger.warn(`Impossible d'envoyer un DM de récompense à ${user.username}: ${err.message}`);
                });

                logger.info(`Récompense d'Halloween '${tier.name}' accordée à ${user.username}.`);

            } catch (error) {
                logger.error(`Erreur lors de l'attribution de la récompense d'Halloween '${tier.name}' à ${user.username}:`, error);
            }
        }
    }
}

module.exports = { HALLOWEEN_REWARDS, checkAndGrantHalloweenRewards };
