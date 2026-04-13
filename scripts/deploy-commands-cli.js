/**
 * Déploie les slash commands du bot niveau sur la guilde GUILD_ID (sans lancer tout l’orchestrateur).
 * Usage : npm run deploy:commands
 * Prérequis : .env à la racine du dépôt avec BOT_TOKEN et GUILD_ID.
 */
const path = require('node:path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const { Client, GatewayIntentBits } = require('discord.js');
const deployCommands = require(path.join(__dirname, '..', 'niveau', 'src', 'utils', 'deploy-commands'));

async function main() {
    const token = process.env.BOT_TOKEN;
    const guildId = process.env.GUILD_ID;

    if (!token) {
        console.error('❌ BOT_TOKEN manquant — ajoute-le dans le .env à la racine du dépôt (pas seulement modération/.env).');
        process.exit(1);
    }
    if (!guildId) {
        console.error('❌ GUILD_ID manquant dans le .env à la racine.');
        process.exit(1);
    }

    const client = new Client({ intents: [GatewayIntentBits.Guilds] });

    await new Promise((resolve, reject) => {
        client.once('clientReady', resolve);
        client.once('error', reject);
        client.login(token);
    });

    console.log(`✅ Connecté : ${client.user.tag}\n`);

    try {
        await deployCommands(client);
    } finally {
        client.destroy();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
