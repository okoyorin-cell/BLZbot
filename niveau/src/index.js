const path = require('node:path');
require('dotenv').config({
    path: path.join(__dirname, '..', '..', '.env'),
    quiet: true,
});

const logger = require('./utils/logger');
const fs = require('node:fs');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { getEventState } = require('./utils/db-halloween');
const { initializeSharesSystem } = require('./utils/ranked-shares');
const { loadTopLevelCommands, loadSeasonalCommands } = require('./utils/command-loader');
const { registerClientReady } = require('./bootstrap/client-ready');

initializeSharesSystem();

const isHalloweenActive = getEventState('halloween');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions
    ]
});

client.commands = new Collection();
loadTopLevelCommands(client);
loadSeasonalCommands(client);

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

registerClientReady(client, { isHalloweenActive });

const deployCommands = require('./utils/deploy-commands');

const BLZ_COMPACT = process.env.BLZ_COMPACT_LOG === '1';

(async () => {
    if (!BLZ_COMPACT) logger.info('✅ Commandes des événements chargées');

    await new Promise((resolve) => {
        client.once('clientReady', () => {
            resolve();
        });
        client.login(process.env.BOT_TOKEN);
    });

    const skipSlashDeploy = ['1', 'true', 'yes'].includes(
        String(process.env.SKIP_SLASH_DEPLOY_ON_START || '').toLowerCase()
    );
    if (skipSlashDeploy) {
        const skipMsg =
            'SKIP_SLASH_DEPLOY_ON_START: déploiement slash ignoré — `npm run deploy:commands` après changement de commandes.';
        if (BLZ_COMPACT) logger.debug(skipMsg);
        else logger.warn(skipMsg);
    } else {
        try {
            await deployCommands(client);
            if (!BLZ_COMPACT) logger.info('✅ Commandes déployées avec succès');
        } catch (error) {
            const msg =
                error.code === 10004
                    ? 'GUILD_ID inconnu — mets l’ID du serveur où le bot est invité (même valeur que modération/.env si besoin).'
                    : error.message || String(error);
            logger.error(`❌ Déploiement slash: ${msg}`);
        }
    }
})();
