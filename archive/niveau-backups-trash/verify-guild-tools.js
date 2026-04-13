const { purchaseBooster, BOOSTERS } = require('../utils/guild/guild-boosters');
const db = require('../database/database');

// Mock specific DB methods to avoid affecting real data and allow simulation
const originalPrepare = db.prepare;
const originalTransaction = db.transaction;

// Mock data
let mockGuild = {
    id: 'test_guild',
    upgrade_level: 5,
    treasury: 10000000,
    treasury_multiplier_purchased: 0,
    xp_boost_purchased: 0,
    points_boost_purchased: 0
};

// Mock DB implementation
db.prepare = (sql) => {
    if (sql.includes('SELECT * FROM guilds WHERE id = ?')) {
        return {
            get: () => mockGuild
        };
    }
    if (sql.includes('UPDATE guilds SET treasury = treasury - ?')) {
        return {
            run: (cost) => {
                mockGuild.treasury -= cost;
                console.log(`[MockDB] Treasury deducted: -${cost}. New balance: ${mockGuild.treasury}`);
            }
        };
    }
    if (sql.includes('UPDATE guilds SET treasury_multiplier_purchased = ?')) {
        return {
            run: (level) => {
                mockGuild.treasury_multiplier_purchased = level;
                console.log(`[MockDB] Treasury multiplier updated to level: ${level}`);
            }
        };
    }
    // Return dummy for other queries
    return {
        get: () => null,
        run: () => { },
        all: () => []
    };
};

db.transaction = (fn) => {
    return () => fn();
};

// Also mock isGuildInWar to return false
const dbGuilds = require('../utils/db-guilds');
dbGuilds.isGuildInWar = () => false;

async function runTest() {
    console.log('--- Starting Guild Tools Verification ---');

    try {
        console.log('\nTest 1: Purchasing Treasury Multiplier Level 1 (x100)');
        // Level 1 booster (x100), id: treasury_mult_100
        const booster1 = BOOSTERS.U4.find(b => b.id === 'treasury_mult_100');

        console.log(`Initial State: Multiplier Level = ${mockGuild.treasury_multiplier_purchased}`);

        purchaseBooster('test_guild', 'treasury_mult_100');

        if (mockGuild.treasury_multiplier_purchased === 2) { // Level 1 is stored as 2
            console.log('✅ Success: Purchased Level 1 booster.');
        } else {
            console.error('❌ Failed: Multiplier level expected 2, got ' + mockGuild.treasury_multiplier_purchased);
        }

    } catch (error) {
        console.error('❌ Error during Test 1:', error.message);
    }

    try {
        console.log('\nTest 2: Purchasing Treasury Multiplier Level 2 (x200)');
        // Level 2 booster (x200), id: treasury_mult_200
        // Currently at level 2 (from previous test), want to buy level 2 (stored as 3)
        // Required level for booster level 2 is level 1 (stored as 2)

        console.log(`Current State: Multiplier Level = ${mockGuild.treasury_multiplier_purchased}`);

        purchaseBooster('test_guild', 'treasury_mult_200');

        if (mockGuild.treasury_multiplier_purchased === 3) {
            console.log('✅ Success: Purchased Level 2 booster.');
        } else {
            console.error('❌ Failed: Multiplier level expected 3, got ' + mockGuild.treasury_multiplier_purchased);
        }

    } catch (error) {
        console.error('❌ Error during Test 2:', error.message);
    }

    // Reset for negative test
    mockGuild.treasury_multiplier_purchased = 0;

    try {
        console.log('\nTest 3: Attempting to skip to Level 2');
        console.log(`Reset State: Multiplier Level = ${mockGuild.treasury_multiplier_purchased}`);

        purchaseBooster('test_guild', 'treasury_mult_200');
        console.error('❌ Failed: Should have thrown an error.');
    } catch (error) {
        if (error.message.includes('Vous devez d\'abord acheter le booster')) {
            console.log('✅ Success: Correctly prevented skipping levels.');
        } else {
            console.error('❌ Failed: Wrong error message:', error.message);
        }
    }

    console.log('\n--- Verification Complete ---');
}

// Restore original mocks after run (though process will exit)
runTest();
