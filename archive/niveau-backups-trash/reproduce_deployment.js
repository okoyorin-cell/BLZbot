const fs = require('node:fs');
const path = require('node:path');

// Mock logger
const logger = {
    info: console.log,
    warn: console.warn,
    error: console.error
};

// Paths
const commandsPath = path.join(__dirname, 'src', 'commands');
const halloweenCommandsPath = path.join(commandsPath, 'halloween');
const christmasCommandsPath = path.join(commandsPath, 'noël');
const valentinCommandsPath = path.join(commandsPath, 'saint-valentin');

console.log('--- Diagnostic Start ---');
console.log(`Commands Path: ${commandsPath}`);

function loadCommandData(filePath) {
    try {
        const command = require(filePath);
        if (command.data && command.execute) {
            return command.data.toJSON();
        } else {
            console.warn(`[WARN] Skipping ${path.basename(filePath)}: Missing data or execute`);
        }
    } catch (e) {
        console.error(`[ERROR] Failed to load ${filePath}:`, e.message);
    }
    return null;
}

const localCommands = new Map();

if (fs.existsSync(commandsPath)) {
    console.log('Reading src/commands directory...');
    const items = fs.readdirSync(commandsPath);

    items.forEach(file => {
        const fullPath = path.join(commandsPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (['halloween', 'noël', 'saint-valentin'].includes(file)) {
                console.log(`[INFO] Found known event folder: ${file}`);
            } else if (file === 'giveaway') {
                console.log(`[INFO] Found 'giveaway' folder (expected to be handled by giveaway.js)`);
            } else {
                console.warn(`[WARN] Found IGNORED subfolder: ${file}`);
            }
        } else if (file.endsWith('.js')) {
            const cmd = loadCommandData(fullPath);
            if (cmd) {
                console.log(`[SUCCESS] Loaded command: ${cmd.name}`);
                localCommands.set(cmd.name, cmd);
            }
        }
    });

    // Check specific event folders just like deploy-commands.js
    console.log('\n--- Checking Event Folders ---');
    [halloweenCommandsPath, christmasCommandsPath, valentinCommandsPath].forEach(p => {
        if (fs.existsSync(p)) {
            console.log(`Reading ${path.basename(p)}...`);
            fs.readdirSync(p).filter(f => f.endsWith('.js')).forEach(f => {
                const cmd = loadCommandData(path.join(p, f));
                if (cmd) console.log(`[SUCCESS] Loaded event command: ${cmd.name} (${path.basename(p)})`);
            });
        } else {
            console.log(`[INFO] Event folder not found: ${path.basename(p)}`);
        }
    });

} else {
    console.error('[CRITICAL] src/commands directory does not exist!');
}

console.log(`\nTotal Loaded Commands: ${localCommands.size}`);
console.log('--- Diagnostic End ---');
