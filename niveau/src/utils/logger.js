require('dotenv').config({ quiet: true });

const LOG_LEVELS = {
    NONE: 0,
    ERROR: 1,
    WARN: 2,
    INFO: 3,
    DEBUG: 4,
};

/** Sous npm start l’orchestrateur met BLZ_COMPACT_LOG=1 → moins de bruit (WARN par défaut). LOG_LEVEL dans .env prime toujours. */
function resolveLogLevel() {
    const name = process.env.LOG_LEVEL;
    if (name && LOG_LEVELS[name] !== undefined) {
        return LOG_LEVELS[name];
    }
    if (process.env.BLZ_COMPACT_LOG === '1') {
        return LOG_LEVELS.WARN;
    }
    return LOG_LEVELS.INFO;
}

const currentLogLevel = resolveLogLevel();

const logger = {
    error: (message, ...args) => {
        if (currentLogLevel >= LOG_LEVELS.ERROR) {
            console.error(`[ERROR] ${message}`, ...args);
        }
    },
    warn: (message, ...args) => {
        if (currentLogLevel >= LOG_LEVELS.WARN) {
            console.warn(`[WARN] ${message}`, ...args);
        }
    },
    info: (message, ...args) => {
        if (currentLogLevel >= LOG_LEVELS.INFO) {
            console.log(`[INFO] ${message}`, ...args);
        }
    },
    debug: (message, ...args) => {
        if (currentLogLevel >= LOG_LEVELS.DEBUG) {
            console.log(`[DEBUG] ${message}`, ...args);
        }
    },
};

module.exports = logger;
