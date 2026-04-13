
const UPGRADES = {
    2: { level: 50, cost: 350000, slots: 3, treasury_capacity: 1500000 },
    3: { level: 100, cost: 1000000, slots: 3, treasury_capacity: 3000000, treasury_req: 1000000 },
    4: { level: 200, cost: 2000000, slots: 3, treasury_capacity: 7000000, treasury_req: 2500000 },
    5: { level: 300, cost: 5000000, slots: 3, treasury_capacity: 15000000, treasury_req: 5000000 },
    6: { level: 400, cost: 10000000, slots: 3, treasury_capacity: 20000000, treasury_req: 10000000 },
    7: { level: 500, cost: 15000000, slots: 3, treasury_capacity: 25000000, wars_won_req: 1 },
    8: { level: 600, cost: 20000000, slots: 3, treasury_capacity: 30000000, wars_won_req: 1, wars_won_percent_req: 70, mega_boost_req: 1 },
    9: { level: 800, cost: 25000000, slots: 3, treasury_capacity: 30000000, wars_won_req: 1, wars_won_percent_req: 80, mega_boost_req: 1 },
    10: { level: 1000, cost: 30000000, slots: 3, treasury_capacity: 30000000, wars_won_req: 1, wars_won_percent_req: 90, guild_upgrader_req: 1, mega_boost_req: 2 },
};

function getUpgradeInfo(level) {
    return UPGRADES[level];
}

module.exports = { getUpgradeInfo };
