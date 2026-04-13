require('dotenv').config();
const db = require('../database/database');

try {
    const checkColumnStmt = db.prepare(`
        PRAGMA table_info(users)
    `);
    
    const columns = checkColumnStmt.all();
    const hasHackerColumn = columns.some(col => col.name === 'hacker_item_timestamp');
    
    if (!hasHackerColumn) {
        const addColumnStmt = db.prepare(`
            ALTER TABLE users ADD COLUMN hacker_item_timestamp INTEGER DEFAULT 0
        `);
        addColumnStmt.run();
        console.log('✅ Colonne hacker_item_timestamp ajoutée à la table users');
    } else {
        console.log('✅ Colonne hacker_item_timestamp existe déjà');
    }
} catch (error) {
    console.error('❌ Erreur lors de la vérification/ajout de la colonne:', error.message);
    process.exit(1);
}
