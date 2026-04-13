const logger = require('./logger');
const fs = require('node:fs');
const path = require('node:path');
const { getEventState: getHalloweenState } = require('./db-halloween');
const { getEventState: getChristmasState } = require('./db-noel');
const { getEventState: getValentinState } = require('./db-valentin');

// Fonction pour charger les données de commande depuis un fichier
function loadCommandData(filePath) {
    try {
        const command = require(filePath);
        if (command.data && command.execute) {
            return command.data.toJSON();
        }
    } catch (e) {
        logger.error(`Erreur de chargement pour la commande à ${filePath}:`, e);
    }
    return null;
}

module.exports = async function deployCommands(client) {
    // Token sanitization function
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const sanitize = (obj) => {
        if (!obj) return obj;
        if (typeof obj === 'string') {
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

    const rest = new REST({ 
        version: '10', 
        timeout: 120_000
    }).setToken(BOT_TOKEN);
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('[DEPLOY-COMMANDS] Initializing REST client with event listeners...');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    // Enable ALL possible event listeners
    rest.on('rateLimited', (info) => {
        console.log(`\n[EVENT: rateLimited] ⚠️⚠️⚠️`);
        console.log(`  timeToReset: ${info.timeToReset}ms (${Math.round(info.timeToReset / 1000)}s)`);
        console.log(`  route: ${info.route}`);
        console.log(`  method: ${info.method}`);
        console.log(`  limit: ${info.limit}`);
        console.log(`  remaining: ${info.remaining}`);
        console.log(`  resetAfter: ${info.resetAfter}`);
        logger.warn(`[RATE LIMITED] Waiting ${Math.round(info.timeToReset / 1000)}s - ${info.route}`);
    });

    rest.on('warn', (info) => {
        console.log(`\n[EVENT: warn] ⚠️`, info);
        logger.warn(`[REST WARN]`, info);
    });

    rest.on('debug', (info) => {
        console.log(`[EVENT: debug]`, info);
    });

    rest.on('error', (error) => {
        console.log(`\n[EVENT: error] ❌`);
        console.log(`  Message:`, error.message);
        console.log(`  Stack:`, error.stack);
        logger.error(`[REST ERROR]`, error.message);
    });

    rest.on('request', (request) => {
        console.log(`\n[EVENT: request] 📤`, sanitize(request));
    });

    rest.on('response', (response) => {
        console.log(`[EVENT: response] 📥`, sanitize(response));
    });

    rest.on('restDebug', (info) => {
        console.log(`[EVENT: restDebug]`, info);
    });

    rest.on('handlerSweep', (info) => {
        console.log(`[EVENT: handlerSweep]`, info);
    });

    rest.on('hashSweep', (info) => {
        console.log(`[EVENT: hashSweep]`, info);
    });

    rest.on('invalidRequestWarning', (info) => {
        console.log(`[EVENT: invalidRequestWarning]`, info);
    });

    console.log('[DEPLOY-COMMANDS] ✅ All event listeners attached');
    console.log(`  - rateLimited, warn, debug, error`);
    console.log(`  - request, response, restDebug`);
    console.log(`  - handlerSweep, hashSweep, invalidRequestWarning`);
    console.log('Listeners are now active and will log everything!\n');

    const commandsPath = path.join(__dirname, '..', 'commands');
    const halloweenCommandsPath = path.join(commandsPath, 'halloween');
    const christmasCommandsPath = path.join(commandsPath, 'noël');
    const valentinCommandsPath = path.join(commandsPath, 'saint-valentin');
    const isHalloweenActive = getHalloweenState('halloween');
    const isChristmasActive = getChristmasState('noël');
    const isValentinActive = getValentinState('valentin');

    // 1. Déterminer la liste des commandes que ce script est censé gérer
    const localCommands = new Map();

    // Charger les commandes normales
    fs.readdirSync(commandsPath)
        .filter(file => file.endsWith('.js'))
        .forEach(file => {
            const commandData = loadCommandData(path.join(commandsPath, file));
            if (commandData) localCommands.set(commandData.name, { ...commandData, source: 'normal' });
        });

    // Charger les commandes d'Halloween
    fs.readdirSync(halloweenCommandsPath)
        .filter(file => file.endsWith('.js'))
        .forEach(file => {
            const commandData = loadCommandData(path.join(halloweenCommandsPath, file));
            if (commandData) localCommands.set(commandData.name, { ...commandData, source: 'halloween' });
        });

    // Charger les commandes de Noël
    fs.readdirSync(christmasCommandsPath)
        .filter(file => file.endsWith('.js'))
        .forEach(file => {
            const commandData = loadCommandData(path.join(christmasCommandsPath, file));
            if (commandData) localCommands.set(commandData.name, { ...commandData, source: 'christmas' });
        });

    // Charger les commandes de Saint-Valentin
    if (fs.existsSync(valentinCommandsPath)) {
        fs.readdirSync(valentinCommandsPath)
            .filter(file => file.endsWith('.js'))
            .forEach(file => {
                const commandData = loadCommandData(path.join(valentinCommandsPath, file));
                if (commandData) localCommands.set(commandData.name, { ...commandData, source: 'valentin' });
            });
    }

    // 2. Récupérer les commandes actuellement déployées sur Discord
    let existingCommands = new Map();
    try {
        console.log('\n[DEPLOY] ════════════════════════════════════════');
        console.log('[DEPLOY] 🔍 Fetching existing commands from Discord...');
        console.log(`[DEPLOY] GET ${Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)}`);
        
        const startTimeGet = Date.now();
        const deployedCommands = await rest.get(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID));
        const elapsedGet = Date.now() - startTimeGet;
        
        console.log(`[DEPLOY] ✅ GET succeeded in ${elapsedGet}ms`);
        console.log(`[DEPLOY] Found ${deployedCommands.length} existing commands on Discord:`);
        
        if (deployedCommands.length === 0) {
            console.log('[DEPLOY] ⚠️⚠️⚠️ WARNING: 0 commands found on Discord!');
            console.log('[DEPLOY] This might be wrong - there should be existing commands!');
        } else {
            deployedCommands.forEach(cmd => console.log(`  - ${cmd.name} (ID: ${cmd.id})`));
        }
        
        existingCommands = new Map(deployedCommands.map(cmd => [cmd.name, cmd]));
        console.log('[DEPLOY] ════════════════════════════════════════\n');
    } catch (error) {
        console.log('[DEPLOY] ❌❌❌ GET FAILED!');
        console.log(`[DEPLOY] Error: ${error.message}`);
        console.log(`[DEPLOY] Code: ${error.code}, Status: ${error.status}`);
        logger.error('Impossible de récupérer les commandes depuis Discord:', error);
        return; // Arrêter en cas d'erreur ici
    }

    console.log(`\n[DEPLOY] Loaded ${localCommands.size} local commands:`);
    for (const [name, cmd] of localCommands.entries()) {
        console.log(`  - ${name} (source: ${cmd.source})`);
    }

    // 3. Comparer et déterminer les actions à prendre
    const commandsToCreate = [];
    const commandsToUpdate = [];
    const commandsToDelete = [];

    function commandsAreEqual(localCmd, discordCmd) {
        // Simplification de la comparaison en se basant sur les propriétés modifiables
        const props = ['name', 'description', 'options', 'default_member_permissions', 'dm_permission'];
        for (const prop of props) {
            const localVal = localCmd[prop] ?? (prop === 'options' ? [] : null);
            const discordVal = discordCmd[prop] ?? (prop === 'options' ? [] : null);
            if (JSON.stringify(localVal) !== JSON.stringify(discordVal)) return false;
        }
        return true;
    }

    // Itérer sur les commandes locales pour décider quoi faire
    for (const [name, command] of localCommands.entries()) {
        const shouldBeActive = command.source === 'normal' ||
            (command.source === 'halloween' && isHalloweenActive) ||
            (command.source === 'christmas' && isChristmasActive) ||
            (command.source === 'valentin' && isValentinActive);
        const discordCmd = existingCommands.get(name);

        console.log(`\n[DEPLOY] Analyzing /${name}:`);
        console.log(`  shouldBeActive: ${shouldBeActive}`);
        console.log(`  existsOnDiscord: ${!!discordCmd}`);

        if (shouldBeActive) {
            if (!discordCmd) {
                console.log(`  ➡️ Action: CREATE (doesn't exist on Discord)`);
                commandsToCreate.push(command); // La commande doit exister mais n'existe pas -> CRÉER
            } else if (!commandsAreEqual(command, discordCmd)) {
                console.log(`  ➡️ Action: UPDATE (exists but different)`);
                commandsToUpdate.push({ id: discordCmd.id, data: command }); // La commande existe mais a changé -> METTRE À JOUR
            } else {
                console.log(`  ➡️ Action: SKIP (already up-to-date)`);
            }
        } else { // La commande ne devrait pas être active
            if (discordCmd) {
                console.log(`  ➡️ Action: DELETE (should not be active)`);
                commandsToDelete.push(discordCmd); // La commande ne doit pas exister mais existe -> SUPPRIMER
            } else {
                console.log(`  ➡️ Action: SKIP (not active and doesn't exist)`);
            }
        }
    }

    // 4. Exécuter les actions
    if (commandsToDelete.length > 0) {
        logger.info(`Suppression de ${commandsToDelete.length} commande(s)...`);
        for (const cmd of commandsToDelete) {
            try {
                await rest.delete(Routes.applicationGuildCommand(process.env.CLIENT_ID, process.env.GUILD_ID, cmd.id));
                logger.info(`Commande /${cmd.name} supprimée.`);
            } catch (error) {
                logger.error(`Erreur lors de la suppression de /${cmd.name}:`, error);
            }
        }
    }

    // Create commands ONE BY ONE
    if (commandsToCreate.length > 0) {
        console.log('\n[DEPLOY] ════════════════════════════════════════');
        console.log(`[DEPLOY] 🚀 Creating ${commandsToCreate.length} commands`);
        console.log('[DEPLOY] ════════════════════════════════════════\n');
        
        logger.info(`Création de ${commandsToCreate.length} nouvelle(s) commande(s)...`);
        
        for (let i = 0; i < commandsToCreate.length; i++) {
            const cmd = commandsToCreate[i];
            const { source, ...cleanCmd } = cmd;
            
            try {
                console.log(`\n[CREATE ${i+1}/${commandsToCreate.length}] /${cmd.name}`);
                
                const startTime = Date.now();
                const result = await rest.post(
                    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), 
                    { body: cleanCmd }
                );
                const elapsed = Date.now() - startTime;
                
                console.log(`  ✅ Success in ${elapsed}ms (ID: ${result.id})`);
                logger.info(`Commande /${cmd.name} créée (${elapsed}ms).`);
                
            } catch (error) {
                console.log(`  ❌ FAILED: ${error.message}`);
                console.log(`     Code: ${error.code}, Status: ${error.status}`);
                
                if (error.rawError) {
                    console.log(`     Discord Error:`, JSON.stringify(error.rawError, null, 2));
                }
                
                logger.error(`Erreur lors de la création de /${cmd.name}:`, error.message);
            }
        }
        
        console.log('\n[DEPLOY] ════════════════════════════════════════');
        console.log(`[DEPLOY] ✅ Deployment complete!`);
        console.log('[DEPLOY] ════════════════════════════════════════\n');
    }

    // Update modified commands
    if (commandsToUpdate.length > 0) {
        logger.info(`Mise à jour de ${commandsToUpdate.length} commande(s)...`);
        for (const cmd of commandsToUpdate) {
            try {
                const { source, ...cleanData } = cmd.data;
                await rest.patch(
                    Routes.applicationGuildCommand(process.env.CLIENT_ID, process.env.GUILD_ID, cmd.id), 
                    { body: cleanData }
                );
                logger.info(`Commande /${cmd.data.name} mise à jour.`);
            } catch (error) {
                logger.error(`Erreur lors de la mise à jour de /${cmd.data.name}:`, error);
            }
        }
    }

    if (commandsToCreate.length === 0 && commandsToDelete.length === 0 && commandsToUpdate.length === 0) {
        logger.info('Aucune modification de commande nécessaire.');
    }
};