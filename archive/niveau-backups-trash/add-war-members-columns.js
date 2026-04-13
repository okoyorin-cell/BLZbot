/**
 * Migration : ajout des colonnes war_messages, war_counting_messages, war_voice_minutes
 * à la table guild_war_members.
 *
 * Exécuter une seule fois sur la prod :
 *   node niveau/src/scripts/add-war-members-columns.js
 */

const db = require('../database/database');
const logger = require('../utils/logger');

function runMigration() {
    logger.info('Migration : ajout des colonnes manquantes dans guild_war_members...');

    const columns = [
        'war_messages INTEGER DEFAULT 0',
        'war_counting_messages INTEGER DEFAULT 0',
        'war_voice_minutes INTEGER DEFAULT 0',
    ];

    for (const columnDef of columns) {
        const columnName = columnDef.split(' ')[0];
        try {
            db.exec(`ALTER TABLE guild_war_members ADD COLUMN ${columnDef}`);
            logger.info(`✅ Colonne ${columnName} ajoutée.`);
        } catch (error) {
            if (error.message.includes('duplicate column name')) {
                logger.warn(`⚠️  Colonne ${columnName} existe déjà, ignorée.`);
            } else {
                logger.error(`❌ Erreur ajout colonne ${columnName}:`, error);
            }
        }
    }

    logger.info('Migration terminée.');
}

runMigration();
