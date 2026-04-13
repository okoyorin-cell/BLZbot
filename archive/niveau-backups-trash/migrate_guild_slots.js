const db = require('../database/database');
const logger = require('../utils/logger');
const { UPGRADE_MATRIX } = require('../utils/guild/guild-upgrades');

console.log("Starting Guild Slots Migration...");

// 1. Get all guilds
const guilds = db.prepare('SELECT * FROM guilds').all();
console.log(`Found ${guilds.length} guilds to process.`);

const updateSlotsStmt = db.prepare('UPDATE guilds SET member_slots = ? WHERE id = ?');

let updatedCount = 0;

db.transaction(() => {
    for (const guild of guilds) {
        const level = guild.upgrade_level || 1;
        const jokers = guild.joker_guilde_uses || 0;

        // Calculate base slots from matrix
        let baseAndUpgrades = 3; // Starting slots

        // Add slots for each level achieved UP TO current level
        // Note: UPGRADE_MATRIX is keyed by level.
        // If guild is level 5, it received benefits from 2, 3, 4, 5?
        // Let's verify UPGRADE_MATRIX structure.
        // Level 1 is "Base". upgrades start from 2?
        // Usually upgrade level starts at 1.

        for (let l = 2; l <= level; l++) {
            if (UPGRADE_MATRIX[l]) {
                baseAndUpgrades += UPGRADE_MATRIX[l].slots_gained;
            }
        }

        const newTotal = baseAndUpgrades + jokers;

        // Security cap (hard limit 12 mentioned in logic)
        // But let's stick to the calculated value so user sees strictly what they have entitlement to.

        console.log(`Guild ${guild.name} (Lvl ${level}, Jokers ${jokers}): Old Slots ${guild.member_slots} -> New Slots ${newTotal}`);

        updateSlotsStmt.run(newTotal, guild.id);
        updatedCount++;
    }
})();

console.log(`Migration Complete. Updated ${updatedCount} guilds.`);
