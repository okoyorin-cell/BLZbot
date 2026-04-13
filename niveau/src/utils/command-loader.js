const fs = require('node:fs');
const path = require('node:path');
const logger = require('./logger');

const commandsRootPath = path.join(__dirname, '..', 'commands');

/** Dossiers de commandes « principales » (hors saisonniers, hors giveaway/helpers, hors archive). */
const MAIN_COMMAND_SUBDIRS = Object.freeze(['core', 'guilde', 'admin', 'misc']);

/**
 * Charge les commandes slash depuis commands/core, guilde, admin, misc.
 * @param {import('discord.js').Client} client
 */
function loadTopLevelCommands(client) {
    for (const sub of MAIN_COMMAND_SUBDIRS) {
        const dir = path.join(commandsRootPath, sub);
        if (!fs.existsSync(dir)) continue;
        const commandFiles = fs.readdirSync(dir).filter((file) => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(dir, file);
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
            } else {
                logger.warn(`[AVERTISSEMENT] La commande à ${filePath} n'a pas les propriétés "data" ou "execute" requises.`);
            }
        }
    }
}

/**
 * Charge Halloween / Noël / Valentin selon l’état en base.
 * @param {import('discord.js').Client} client
 */
function loadSeasonalCommands(client) {
    const { getEventState } = require('./db-halloween');
    const { getEventState: getNoelState } = require('./db-noel');
    const { getEventState: getValentinState } = require('./db-valentin');

    if (getEventState('halloween')) {
        const n = loadHalloweenCommands(client);
        logger.info(`Événement Halloween actif. ${n} commande(s) Halloween chargée(s).`);
    } else {
        logger.info('Événement Halloween inactif. Les commandes associées ne seront pas chargées.');
    }

    if (getNoelState('noël')) {
        const n = loadChristmasCommands(client);
        logger.info(`Événement Noël actif. ${n} commande(s) Noël chargée(s).`);
    } else {
        logger.info('Événement Noël inactif. Les commandes associées ne seront pas chargées.');
    }

    if (getValentinState('valentin')) {
        const n = loadValentinCommands(client);
        logger.info(`Événement Saint-Valentin actif. ${n} commande(s) Valentin chargée(s).`);
    } else {
        logger.info('Événement Saint-Valentin inactif. Les commandes associées ne seront pas chargées.');
    }
}

const halloweenCommandsPath = path.join(__dirname, '..', 'commands', 'halloween');
const christmasCommandsPath = path.join(__dirname, '..', 'commands', 'noël');
const valentinCommandsPath = path.join(__dirname, '..', 'commands', 'saint-valentin');

function loadHalloweenCommands(client) {
    try {
        const halloweenCommandFiles = fs.readdirSync(halloweenCommandsPath).filter(file => file.endsWith('.js'));
        logger.info(`Chargement dynamique de ${halloweenCommandFiles.length} commande(s) d'Halloween...`);
        for (const file of halloweenCommandFiles) {
            const filePath = path.join(halloweenCommandsPath, file);
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                logger.info(`Commande /${command.data.name} chargée dynamiquement.`);
            }
        }
        return halloweenCommandFiles.length;
    } catch (error) {
        logger.error("Erreur lors du chargement dynamique des commandes d'Halloween:", error);
        return 0;
    }
}

function unloadHalloweenCommands(client) {
    try {
        const halloweenCommandFiles = fs.readdirSync(halloweenCommandsPath).filter(file => file.endsWith('.js'));
        logger.info(`Déchargement dynamique de ${halloweenCommandFiles.length} commande(s) d'Halloween...`);
        let unloadedCount = 0;
        for (const file of halloweenCommandFiles) {
            const filePath = path.join(halloweenCommandsPath, file);
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);
            if (command.data && client.commands.delete(command.data.name)) {
                logger.info(`Commande /${command.data.name} déchargée dynamiquement.`);
                unloadedCount++;
            }
        }
        return unloadedCount;
    } catch (error) {
        logger.error("Erreur lors du déchargement dynamique des commandes d'Halloween:", error);
        return 0;
    }
}

function loadChristmasCommands(client) {
    try {
        const christmasCommandFiles = fs.readdirSync(christmasCommandsPath).filter(file => file.endsWith('.js'));
        logger.info(`Chargement dynamique de ${christmasCommandFiles.length} commande(s) de Noël...`);
        for (const file of christmasCommandFiles) {
            const filePath = path.join(christmasCommandsPath, file);
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                logger.info(`Commande /${command.data.name} chargée dynamiquement.`);
            }
        }
        return christmasCommandFiles.length;
    } catch (error) {
        logger.error("Erreur lors du chargement dynamique des commandes de Noël:", error);
        return 0;
    }
}

function unloadChristmasCommands(client) {
    try {
        const christmasCommandFiles = fs.readdirSync(christmasCommandsPath).filter(file => file.endsWith('.js'));
        logger.info(`Déchargement dynamique de ${christmasCommandFiles.length} commande(s) de Noël...`);
        let unloadedCount = 0;
        for (const file of christmasCommandFiles) {
            const filePath = path.join(christmasCommandsPath, file);
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);
            if (command.data && client.commands.delete(command.data.name)) {
                logger.info(`Commande /${command.data.name} déchargée dynamiquement.`);
                unloadedCount++;
            }
        }
        return unloadedCount;
    } catch (error) {
        logger.error("Erreur lors du déchargement dynamique des commandes de Noël:", error);
        return 0;
    }
}

function loadValentinCommands(client) {
    try {
        if (!fs.existsSync(valentinCommandsPath)) {
            fs.mkdirSync(valentinCommandsPath, { recursive: true });
            return 0;
        }
        const valentinCommandFiles = fs.readdirSync(valentinCommandsPath).filter(file => file.endsWith('.js'));
        logger.info(`Chargement dynamique de ${valentinCommandFiles.length} commande(s) de Saint-Valentin...`);
        for (const file of valentinCommandFiles) {
            const filePath = path.join(valentinCommandsPath, file);
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                logger.info(`Commande /${command.data.name} chargée dynamiquement.`);
            }
        }
        return valentinCommandFiles.length;
    } catch (error) {
        logger.error("Erreur lors du chargement dynamique des commandes de Saint-Valentin:", error);
        return 0;
    }
}

function unloadValentinCommands(client) {
    try {
        if (!fs.existsSync(valentinCommandsPath)) return 0;
        const valentinCommandFiles = fs.readdirSync(valentinCommandsPath).filter(file => file.endsWith('.js'));
        logger.info(`Déchargement dynamique de ${valentinCommandFiles.length} commande(s) de Saint-Valentin...`);
        let unloadedCount = 0;
        for (const file of valentinCommandFiles) {
            const filePath = path.join(valentinCommandsPath, file);
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);
            if (command.data && client.commands.delete(command.data.name)) {
                logger.info(`Commande /${command.data.name} déchargée dynamiquement.`);
                unloadedCount++;
            }
        }
        return unloadedCount;
    } catch (error) {
        logger.error("Erreur lors du déchargement dynamique des commandes de Saint-Valentin:", error);
        return 0;
    }
}

module.exports = {
    MAIN_COMMAND_SUBDIRS,
    loadTopLevelCommands,
    loadSeasonalCommands,
    loadHalloweenCommands,
    unloadHalloweenCommands,
    loadChristmasCommands,
    unloadChristmasCommands,
    loadValentinCommands,
    unloadValentinCommands
};
