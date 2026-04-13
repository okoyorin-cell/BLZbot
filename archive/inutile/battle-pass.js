const schedule = require('node-schedule');
const db = require('../database/database');
const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const BATTLE_PASS_REWARDS = {
    1: { free: 'coffre_normal', vip: 'coffre_normal', xp: 0 },
    2: { free: { type: 'starss', amount: 5000 }, vip: 'coffre_normal', xp: 200 },
    3: { free: 'xp_boost', vip: 'xp_boost', xp: 400 },
    4: { free: 'coffre_normal', vip: { type: 'starss', amount: 50000 }, xp: 600 },
    5: { free: { type: 'starss', amount: 40000 }, vip: { type: 'coffre_normal', amount: 2 }, xp: 800 },
    6: { free: 'points_boost', vip: 'coffre_normal', xp: 1000 },
    7: { free: 'coffre_normal', vip: 'joker_guilde', xp: 1200 },
    8: { free: { type: 'starss', amount: 50000 }, vip: 'coffre_normal', xp: 1400 },
    9: { free: 'coffre_normal', vip: { type: 'starss', amount: 100000 }, xp: 1600 },
    10: { free: 'coffre_mega', vip: 'coffre_mega', xp: 1800 },
    11: { free: { type: 'starss', amount: 50000 }, vip: { type: 'starss', amount: 100000 }, xp: 2000 },
    12: { free: 'coffre_normal', vip: 'coffre_normal', xp: 2000 },
    13: { free: { type: 'starss', amount: 50000 }, vip: 'remboursement', xp: 2000 },
    14: { free: 'double_daily', vip: 'coffre_normal', xp: 2000 },
    15: { free: { type: 'starss', amount: 50000 }, vip: 'coffre_normal', xp: 2000 },
    16: { free: 'coffre_normal', vip: 'coffre_mega', xp: 2000 },
    17: { free: { type: 'starss', amount: 50000 }, vip: 'coffre_normal', xp: 2000 },
    18: { free: 'coffre_normal', vip: 'streak_keeper', xp: 2000 },
    19: { free: { type: 'starss', amount: 50000 }, vip: 'coffre_normal', xp: 2000 },
    20: { free: 'points_boost', vip: 'points_boost', xp: 2000 },
    21: { free: { type: 'starss', amount: 50000 }, vip: 'coffre_normal', xp: 2400 },
    22: { free: 'xp_boost', vip: 'xp_boost', xp: 2800 },
    23: { free: { type: 'starss', amount: 50000 }, vip: 'coffre_mega', xp: 3200 },
    24: { free: 'starss_boost', vip: 'starss_boost', xp: 3600 },
    25: { free: { type: 'starss', amount: 50000 }, vip: 'coffre_normal', xp: 4000 },
    26: { free: 'double_daily', vip: 'coffre_legendaire', xp: 4000 },
    27: { free: { type: 'starss', amount: 50000 }, vip: 'coffre_normal', xp: 4000 },
    28: { free: 'coffre_normal', vip: 'coffre_legendaire', xp: 4000 },
    29: { free: { type: 'starss', amount: 50000 }, vip: 'coffre_normal', xp: 4000 },
    30: { free: 'coffre_mega', vip: 'coffre_mega', xp: 4000 },
    31: { free: { type: 'starss', amount: 50000 }, vip: 'coffre_normal', xp: 4000 },
    32: { free: 'streak_keeper', vip: 'double_daily', xp: 4000 },
    33: { free: { type: 'starss', amount: 50000 }, vip: 'coffre_normal', xp: 4000 },
    34: { free: 'points_boost', vip: 'points_boost', xp: 4000 },
    35: { free: { type: 'starss', amount: 50000 }, vip: 'coffre_normal', xp: 4000 },
    36: { free: 'coffre_normal', vip: 'mega_boost', xp: 4000 },
    37: { free: { type: 'starss', amount: 50000 }, vip: 'coffre_normal', xp: 4000 },
    38: { free: 'coffre_mega', vip: 'coffre_mega', xp: 4000 },
    39: { free: { type: 'starss', amount: 50000 }, vip: 'coffre_normal', xp: 4000 },
    40: { free: 'coffre_normal', vip: 'coffre_mega', xp: 4000 },
    41: { free: { type: 'starss', amount: 75000 }, vip: 'coffre_normal', xp: 4000 },
    42: { free: 'coffre_mega', vip: 'coffre_legendaire', xp: 4000 },
    43: { free: { type: 'starss', amount: 75000 }, vip: 'coffre_normal', xp: 4400 },
    44: { free: 'reset_boutique', vip: 'coffre_mega', xp: 4800 },
    45: { free: { type: 'starss', amount: 75000 }, vip: 'coffre_normal', xp: 5200 },
    46: { free: 'mega_boost', vip: 'mega_boost', xp: 5600 },
    47: { free: { type: 'starss', amount: 75000 }, vip: 'coffre_normal', xp: 6000 },
    48: { free: 'guild_upgrader', vip: 'coffre_mega', xp: 6000 },
    49: { free: { type: 'starss', amount: 75000 }, vip: 'coffre_normal', xp: 6000 },
    50: { free: 'coffre_legendaire', vip: 'coffre_legendaire', xp: 6000 },
};

function getBattlePassReward(tier) {
    return BATTLE_PASS_REWARDS[tier];
}

function getTierFromXp(xp) {
    let tier = 1;
    let requiredXp = 0;
    for (let i = 1; i <= 50; i++) {
        const tierData = getBattlePassReward(i);
        if (!tierData) break;
        requiredXp += tierData.xp;
        if (xp >= requiredXp) {
            tier = i;
        } else {
            break;
        }
    }
    return tier;
}

function scheduleBattlePassReset() {
    // Run on the first Saturday of every month at 13:00
    const rule = new schedule.RecurrenceRule();
    rule.dayOfWeek = 6;
    rule.hour = 13;
    rule.minute = 0;

    schedule.scheduleJob(rule, () => {
        const resetUsersStmt = db.prepare('UPDATE users SET seasonal_xp = 0');
        resetUsersStmt.run();

        const clearBattlePassStmt = db.prepare('DELETE FROM battle_pass');
        clearBattlePassStmt.run();

        // MAJ Mars 2026: Reset du Puits de Combat aussi
        try {
            const { resetAllPuits } = require('./puits-system');
            resetAllPuits();
        } catch (error) {
            console.error('[BATTLE-PASS] Erreur lors du reset du puits:', error);
        }
    });
}

async function notifyTierUpgrade(user, tier) {
    const channelId = process.env.BATTLE_PASS_CHANNEL;
    if (!channelId) {
        console.error('BATTLE_PASS_CHANNEL is not defined in the environment variables.');
        return;
    }

    const channel = client.channels.cache.get(channelId);
    if (!channel) {
        console.error(`Channel with ID ${channelId} not found.`);
        return;
    }

    try {
        await channel.send(`GG à ${user} qui vient de passer au tier ${tier} !`);
    } catch (error) {
        console.error('Failed to send tier upgrade message:', error);
    }
}

function updateUserTier(user, xp) {
    const newTier = getTierFromXp(xp);
    if (user.currentTier !== newTier) {
        user.currentTier = newTier;
        notifyTierUpgrade(user.name, newTier);
    }
}

module.exports = { getBattlePassReward, getTierFromXp, scheduleBattlePassReset, BATTLE_PASS_REWARDS, notifyTierUpgrade, updateUserTier };
