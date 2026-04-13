#!/usr/bin/env node
/**
 * Discord rate limit test script
 * Deploys a simple /test command and logs EVERYTHING
 */

require('dotenv').config();
const { REST, Routes } = require('discord.js');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!BOT_TOKEN || !CLIENT_ID || !GUILD_ID) {
    console.error('❌ Missing BOT_TOKEN, CLIENT_ID or GUILD_ID in .env');
    process.exit(1);
}

async function testRateLimit() {
    console.log(`\n═══════════════════════════════════════════════════════════════`);
    console.log(`[RATE LIMIT TEST] Starting...`);
    console.log(`CLIENT_ID: ${CLIENT_ID}`);
    console.log(`GUILD_ID: ${GUILD_ID}`);
    console.log(`═══════════════════════════════════════════════════════════════\n`);

    const rest = new REST({ version: '10', timeout: 120_000 }).setToken(BOT_TOKEN);

    // All possible event emitters
    rest.on('rateLimited', (info) => {
        console.log(`\n[EVENT: rateLimited]`);
        console.log(`  timeToReset: ${info.timeToReset}ms (${Math.round(info.timeToReset / 1000)}s)`);
        console.log(`  route: ${info.route}`);
        console.log(`  method: ${info.method}`);
        console.log(`  limit: ${info.limit}`);
        console.log(`  remaining: ${info.remaining}`);
        console.log(`  resetAfter: ${info.resetAfter}`);
    });

    rest.on('warn', (info) => {
        console.log(`\n[EVENT: warn]`);
        console.log(`  Message:`, info);
    });

    rest.on('debug', (info) => {
        console.log(`\n[EVENT: debug]`);
        console.log(`  Message:`, info);
    });

    rest.on('error', (error) => {
        console.log(`\n[EVENT: error]`);
        console.log(`  Message:`, error.message);
        console.log(`  Stack:`, error.stack);
    });

    rest.on('request', (request) => {
        console.log(`\n[EVENT: request]`);
        console.log(`  Method: ${request.method}`);
        console.log(`  Path: ${request.path}`);
        console.log(`  URL: ${request.url}`);
    });

    rest.on('response', (response) => {
        console.log(`\n[EVENT: response]`);
        console.log(`  Status: ${response?.status}`);
        console.log(`  URL: ${response?.url}`);
        if (response?.headers) {
            try {
                console.log(`  Headers:`, JSON.stringify(Object.fromEntries(response.headers), null, 2));
            } catch (e) {
                console.log(`  Headers: (parse error)`, response.headers);
            }
        }
    });

    try {
        // All 3 tests in parallel - no waiting!
        console.log(`\n[PARALLEL TEST] ═══════════════════════════════════════════════════════════════`);
        console.log(`🚀 Sending 3 POST requests SIMULTANEOUSLY (no waiting between them)`);
        console.log(`Watch for [EVENT: rateLimited] logs below!\n`);

        const test1Cmd = {
            name: 'test',
            description: 'Test command'
        };
        const test2Cmd = {
            name: 'test2',
            description: 'Test command 2'
        };
        const test3Cmd = {
            name: 'test3',
            description: 'Test command 3'
        };

        const startTimeParallel = Date.now();

        // Send all 3 requests at the exact same time
        const promises = [
            rest.post(
                Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
                { body: test1Cmd }
            ),
            rest.post(
                Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
                { body: test2Cmd }
            ),
            rest.post(
                Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
                { body: test3Cmd }
            )
        ];

        const results = await Promise.allSettled(promises);
        const totalElapsed = Date.now() - startTimeParallel;

        console.log(`\n[RESULTS] ═══════════════════════════════════════════════════════════════`);
        console.log(`Total time for 3 parallel requests: ${totalElapsed}ms (${(totalElapsed / 1000).toFixed(1)}s)\n`);

        results.forEach((result, index) => {
            const testNum = index + 1;
            if (result.status === 'fulfilled') {
                console.log(`✅ [${testNum}] SUCCESS`);
                console.log(`    ID: ${result.value?.id}`);
                console.log(`    Name: ${result.value?.name}`);
            } else {
                console.log(`❌ [${testNum}] FAILED`);
                console.log(`    Error: ${result.reason?.message}`);
                console.log(`    Full Error:`, result.reason);
            }
        });
    } catch (error) {
        console.log(`\n[ERROR STEP] ═══════════════════════════════════════════════════════════════`);
        console.log(`❌ ERROR DETECTED:`);
        console.log(`  Message: ${error.message}`);
        console.log(`  Status: ${error.status}`);
        console.log(`  Code: ${error.code}`);
        console.log(`  StatusCode: ${error.statusCode}`);
        console.log(`  RequestData:`, error.requestData);
        if (error.rawError) {
            console.log(`  Discord details (rawError):`, JSON.stringify(error.rawError, null, 2));
        }
        if (error.response) {
            console.log(`  Response Headers:`, error.response.headers);
            console.log(`  Response Status:`, error.response.status);
        }
        console.log(`═══════════════════════════════════════════════════════════════\n`);
        process.exit(1);
    }
}

testRateLimit();
