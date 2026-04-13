const fs = require('node:fs');
const path = require('node:path');

const MAINTENANCE_FILE = path.join(__dirname, 'maintenance.json');

// Initialiser le fichier si inexistant
if (!fs.existsSync(MAINTENANCE_FILE)) {
    fs.writeFileSync(MAINTENANCE_FILE, JSON.stringify({ maintenance: false }, null, 2));
}

/**
 * Définit l'état du mode maintenance.
 * @param {boolean} status True pour activer, False pour désactiver.
 */
function setMaintenanceMode(status) {
    fs.writeFileSync(MAINTENANCE_FILE, JSON.stringify({ maintenance: status }, null, 2));
}

/**
 * Vérifie si le mode maintenance est activé.
 * @returns {boolean} True si activé, False sinon.
 */
function isMaintenanceMode() {
    const data = fs.readFileSync(MAINTENANCE_FILE, 'utf8');
    const config = JSON.parse(data);
    return config.maintenance;
}

module.exports = { setMaintenanceMode, isMaintenanceMode };