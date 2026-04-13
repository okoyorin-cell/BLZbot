function testLogic() {
    console.log("Testing Logic Fix...");

    // Mock user/guild state
    const guild = {
        treasury_multiplier_purchased: 0 // Level 0 (x1)
    };

    // The logic being tested
    function checkRequirement(booster) {
        // Copied from fix
        const currentTreasuryLevel = guild.treasury_multiplier_purchased || 0;
        const targetLevel = booster.level + 1;

        if (currentTreasuryLevel >= targetLevel) {
            return 'ALREADY_PURCHASED';
        }

        const requiredLevel = booster.level;

        // THE FIX:
        if (booster.level > 1 && currentTreasuryLevel < requiredLevel) {
            return 'REQUIRE_PREVIOUS';
        }
        return 'OK';
    }

    // Test Case 1: Buying Level 1 (x100)
    // booster.level = 1.
    // current = 0.
    // required = 1.
    // Condition: 1 > 1 (false) && ... -> false.
    // Should be OK.
    const result1 = checkRequirement({ level: 1, type: 'treasury' });
    console.log(`Test 1 (Level 1, Current 0): ${result1}`);
    if (result1 !== 'OK') throw new Error('Test 1 Failed');

    // Test Case 2: Buying Level 2 (x200)
    // booster.level = 2.
    // current = 0.
    // required = 2.
    // Condition: 2 > 1 (true) && 0 < 2 (true) -> true.
    // Should be REQUIRE_PREVIOUS.
    const result2 = checkRequirement({ level: 2, type: 'treasury' });
    console.log(`Test 2 (Level 2, Current 0): ${result2}`);
    if (result2 !== 'REQUIRE_PREVIOUS') throw new Error('Test 2 Failed');

    // Test Case 3: Buying Level 2 (x200) after having Level 1 (stored as 2)
    guild.treasury_multiplier_purchased = 2; // Owns Level 1
    // booster.level = 2.
    // current = 2.
    // required = 2.
    // Condition: 2 > 1 (true) && 2 < 2 (false) -> false.
    // Should be OK.
    const result3 = checkRequirement({ level: 2, type: 'treasury' });
    console.log(`Test 3 (Level 2, Current Level 1): ${result3}`);
    if (result3 !== 'OK') throw new Error('Test 3 Failed');

    console.log("SUCCESS: Logic verified.");
}

testLogic();
