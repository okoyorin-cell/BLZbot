const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { getOrCreateUser, grantResources, updateDailyClaim, addItemToInventory } = require('../../utils/db-users');
const { msToTime } = require('../../utils/time');
const { checkQuestProgress } = require('../../utils/quests');
const logger = require('../../utils/logger');

const rewards = [
    { name: '10 000 Stars', chance: 0.30, type: 'stars', amount: 10000 },
    { name: '500 EXP', chance: 0.30, type: 'xp', amount: 500 },
    { name: '500 RP', chance: 0.20, type: 'points', amount: 500 },
    { name: '25 000 Stars', chance: 0.10, type: 'stars', amount: 25000 },
    { name: 'Coffre au trésor', chance: 0.09, type: 'item', itemId: 'coffre_normal' },
    { name: 'Méga coffre au trésor', chance: 0.01, type: 'item', itemId: 'coffre_mega' },
];

function getRandomReward() {
    const rand = Math.random();
    let cumulativeChance = 0;
    for (const reward of rewards) {
        cumulativeChance += reward.chance;
        if (rand < cumulativeChance) {
            return reward;
        }
    }
    return rewards[0]; // Fallback
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Réclamez votre récompense journalière aléatoire !'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const user = getOrCreateUser(userId, interaction.user.username);

        const now = new Date();
        const midnightLocal = new Date(now);
        midnightLocal.setHours(0, 0, 0, 0);

        // Si daily_last_claimed est 0 ou null, considérer que le daily n'a jamais été réclamé
        const canClaim = !user.daily_last_claimed || user.daily_last_claimed === 0;

        let lastClaimedMidnight;
        if (!canClaim) {
            const lastClaimedDate = new Date(user.daily_last_claimed);
            lastClaimedMidnight = new Date(lastClaimedDate);
            lastClaimedMidnight.setHours(0, 0, 0, 0);
        }

        if (canClaim || lastClaimedMidnight < midnightLocal) {
            const reward = getRandomReward();
            let rewardMessage = '';

            switch (reward.type) {
                case 'stars':
                    await grantResources(interaction.client, userId, { stars: reward.amount, source: 'daily' });
                    rewardMessage = `Vous avez reçu **${reward.name}** ! ☀️`;
                    break;
                case 'xp':
                    await grantResources(interaction.client, userId, { xp: reward.amount, source: 'daily' });
                    rewardMessage = `Vous avez reçu **${reward.name}** ! 🚀`;
                    break;
                case 'points':
                    await grantResources(interaction.client, userId, { points: reward.amount, source: 'daily' });
                    rewardMessage = `Vous avez reçu **${reward.name}** ! 🏆`;
                    break;
                // case 'counting_points' removed - replaced with 25k stars above
                case 'item':
                    addItemToInventory(userId, reward.itemId, 1);
                    rewardMessage = `Vous avez obtenu un **${reward.name}** ! 🎁`;
                    if (reward.itemId === 'coffre_normal') {
                        checkQuestProgress(interaction.client, 'DAILY_CHEST_REWARD', interaction.user);
                    } else if (reward.itemId === 'coffre_mega') {
                        checkQuestProgress(interaction.client, 'DAILY_MEGA_CHEST_REWARD', interaction.user);
                    }
                    break;
            }

            updateDailyClaim(userId);
            checkQuestProgress(interaction.client, 'DAILY_CLAIM', interaction.user);

            const successText = new TextDisplayBuilder().setContent(`🎉 **Récompense quotidienne !** 🎉\n${rewardMessage}`);
            const container = new ContainerBuilder().addTextDisplayComponents(successText);
            await interaction.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });

        } else {
            const tomorrowMidnight = new Date(midnightLocal);
            tomorrowMidnight.setDate(tomorrowMidnight.getDate() + 1);
            const remainingTime = tomorrowMidnight.getTime() - now.getTime();

            // Vérifier si l'utilisateur a des Double Daily dans son inventaire
            const { getUserInventory } = require('../../utils/db-users');
            const inventory = getUserInventory(userId);
            const doubleDailyItem = inventory.find(item => item.item_id === 'double_daily');
            const hasDoubleDailyCount = doubleDailyItem ? doubleDailyItem.quantity : 0;

            let message = `Vous avez déjà réclamé votre récompense aujourd'hui. Veuillez patienter encore **${msToTime(remainingTime)}**. ⏳`;

            if (hasDoubleDailyCount > 0) {
                message += `\n\n💡 **Astuce :** Vous avez **${hasDoubleDailyCount}** Double Daily dans votre inventaire ! Utilisez \`/use item:Double_Daily\` ou \`/inventaire\` pour récupérer votre daily une deuxième fois.`;
            }

            const failText = new TextDisplayBuilder().setContent(message);
            const container = new ContainerBuilder().addTextDisplayComponents(failText);
            await interaction.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        }
    },
};