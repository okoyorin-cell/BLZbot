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
    // Function to hide sensitive data by comparing to actual token
    const sanitize = (obj) => {
        if (!obj) return obj;
        if (typeof obj === 'string') {
            // If string contains or equals the token, hide it
            if (obj.includes(BOT_TOKEN) || obj === BOT_TOKEN) {
                return '***TOKEN***';
            }
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(item => sanitize(item));
        }
        if (typeof obj === 'object') {
            const copy = {};
            for (const key in obj) {
                copy[key] = sanitize(obj[key]);
            }
            return copy;
        }
        return obj;
    };

    console.log(`\n═══════════════════════════════════════════════════════════════`);
    console.log(`[RATE LIMIT TEST] Starting...`);
    console.log(`CLIENT_ID: ${CLIENT_ID ? '✅ SET' : '❌ MISSING'}`);
    console.log(`GUILD_ID: ${GUILD_ID ? '✅ SET' : '❌ MISSING'}`);
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

    // rest.on('debug', (info) => {
    //     console.log(`\n[EVENT: debug]`, info);
    // });

    rest.on('error', (error) => {
        console.log(`\n[EVENT: error]`);
        console.log(`  Message:`, error.message);
        console.log(`  Stack:`, error.stack);
    });

    rest.on('request', (request) => {
        console.log(`\n[EVENT: request]`, sanitize(request));
    });

    // Event 'response' doesn't show Discord's actual response, just request info
    // rest.on('response', (response) => {
    //     console.log(`\n[EVENT: response]`, JSON.stringify(sanitize(response), null, 2));
    // });

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

        // Wrapper to log input/output for each request
        const postWithLogging = async (cmd, testNum) => {
            console.log(`\n[REQUEST ${testNum}] ════════════════════════════════`);
            console.log(`[${testNum}] INPUT:`, JSON.stringify(cmd, null, 2));
            console.log(`[${testNum}] Sending to Discord...`);
            
            const startTime = Date.now();
            const result = await rest.post(
                Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
                { body: cmd }
            );
            const elapsed = Date.now() - startTime;
            
            console.log(`\n[RESPONSE ${testNum}] ════════════════════════════════`);
            console.log(`[${testNum}] Time: ${elapsed}ms`);
            console.log(`[${testNum}] OUTPUT:`, JSON.stringify(result, null, 2));
            
            return result;
        };

        // Send all 3 requests at the exact same time
        const promises = [
            postWithLogging(test1Cmd, 1),
            postWithLogging(test2Cmd, 2),
            postWithLogging(test3Cmd, 3)
        ];

        console.log('[WAITING] ⏳ Waiting for all 3 requests to complete...');
        const results = await Promise.allSettled(promises);
        console.log('[WAITING] ✅ All requests completed!\n');
        const totalElapsed = Date.now() - startTimeParallel;

        console.log(`\n[RESULTS] ═══════════════════════════════════════════════════════════════`);
        console.log(`Total time for 3 parallel requests: ${totalElapsed}ms (${(totalElapsed / 1000).toFixed(1)}s)\n`);

        results.forEach((result, index) => {
            const testNum = index + 1;
            if (result.status === 'fulfilled') {
                console.log(`✅ [${testNum}] SUCCESS`);
                console.log(`    Command created:`, JSON.stringify(result.value, null, 2));
            } else {
                console.log(`❌ [${testNum}] FAILED`);
                console.log(`    Error: ${result.reason?.message}`);
                console.log(`    Code: ${result.reason?.code}`);
                console.log(`    Status: ${result.reason?.status}`);
                if (result.reason?.rawError) {
                    console.log(`    Discord Error:`, JSON.stringify(result.reason.rawError, null, 2));
                }
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
