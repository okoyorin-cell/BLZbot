
const db = require('../database/database');
const logger = require('../utils/logger');

function runMigration() {
    logger.info('Lancement du script de migration pour créer la table custom_roles...');

    try {
        // La clause "IF NOT EXISTS" empêche une erreur si la table existe déjà.
        db.exec(`
            CREATE TABLE IF NOT EXISTS custom_roles (
                role_id TEXT PRIMARY KEY,
                guild_id TEXT NOT NULL,
                owner_id TEXT NOT NULL,
                members TEXT NOT NULL
            );
        `);

        logger.info('Migration terminée avec succès. La table "custom_roles" est prête.');

    } catch (error) {
        logger.error('Une erreur est survenue lors de la création de la table custom_roles:', error);
    }
}

// Exécuter la fonction
runMigration();
