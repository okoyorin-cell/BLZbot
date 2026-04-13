/**
 * Script de synchronisation des badges basés sur les rôles Discord.
 * 
 * Usage (depuis la racine du projet V5.2):
 *   node niveau/src/scripts/sync-badges.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '..', '.env') });
const { Client, GatewayIntentBits } = require('discord.js');
const { grantBadge } = require('../database/db-badges');
const { BADGE_ROLE_MAP } = require('../utils/badge-config');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
    ]
});

client.once('ready', async () => {
    console.log(`✅ Bot connecté en tant que ${client.user.tag}`);

    const guildId = process.env.GUILD_ID;
    if (!guildId) {
        console.error('❌ GUILD_ID non défini dans .env');
        process.exit(1);
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
        console.error(`❌ Guilde ${guildId} introuvable`);
        process.exit(1);
    }

    console.log(`📡 Récupération des membres de ${guild.name}...`);
    const members = await guild.members.fetch();
    console.log(`👥 ${members.size} membres récupérés`);

    let totalBadgesGranted = 0;
    const badgeCounts = {};

    for (const [memberId, member] of members) {
        if (member.user.bot) continue;

        for (const badge of BADGE_ROLE_MAP) {
            const hasRole = badge.roleIds.some(roleId => member.roles.cache.has(roleId));
            if (hasRole) {
                grantBadge(memberId, badge.badgeId);
                totalBadgesGranted++;
                badgeCounts[badge.badgeId] = (badgeCounts[badge.badgeId] || 0) + 1;
            }
        }
    }

    console.log('\n📊 Résumé:');
    console.log(`   Total badges assignés: ${totalBadgesGranted}`);
    for (const [badge, count] of Object.entries(badgeCounts)) {
        console.log(`   ${badge}: ${count} membre(s)`);
    }

    console.log('\n✅ Synchronisation terminée !');
    process.exit(0);
});

client.login(process.env.BOT_TOKEN);
