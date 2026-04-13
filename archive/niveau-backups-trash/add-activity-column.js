
const db = require('../database/database');
const logger = require('../utils/logger');

function runMigration() {
    logger.info('Lancement du script de migration pour ajouter la colonne last_activity_timestamp...');

    try {
        // Vérifier si la colonne existe déjà pour éviter les erreurs
        const columns = db.pragma("table_info(users)");
        const columnExists = columns.some(col => col.name === 'last_activity_timestamp');

        if (columnExists) {
            logger.warn('La colonne last_activity_timestamp existe déjà. Aucune action n\'est nécessaire.');
            return;
        }

        // Ajouter la colonne avec une valeur par défaut pour les utilisateurs existants
        const now = Date.now();
        db.exec(`
            ALTER TABLE users
            ADD COLUMN last_activity_timestamp INTEGER DEFAULT ${now}
        `);

        logger.info('Migration terminée avec succès. La colonne last_activity_timestamp a été ajoutée à la table "users".');
        logger.info('Les utilisateurs existants ont reçu la date actuelle comme dernière activité pour éviter une pénalité immédiate.');

    } catch (error) {
        logger.error('Une erreur est survenue lors de la migration de la base de données:', error);
    }
}

// Exécuter la fonction
runMigration();

