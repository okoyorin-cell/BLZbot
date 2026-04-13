const Database = require('better-sqlite3');
const path = require('path');

// Connexion à la base de données
const db = new Database(path.join(__dirname, '../database/blzbot.sqlite'));

console.log('🔧 Migration: Ajout de la colonne hacker_item_timestamp...');

try {
    db.exec('ALTER TABLE users ADD COLUMN hacker_item_timestamp TEXT DEFAULT NULL');
    console.log('✅ Colonne hacker_item_timestamp ajoutée avec succès!');
} catch (error) {
    if (error.message.includes('duplicate column name')) {
        console.log('ℹ️  La colonne hacker_item_timestamp existe déjà.');
    } else {
        console.error('❌ Erreur lors de l\'ajout de la colonne:', error.message);
        process.exit(1);
    }
}

// Vérification
try {
    const result = db.prepare('SELECT hacker_item_timestamp FROM users LIMIT 1').get();
    console.log('✅ Vérification réussie: La colonne est accessible');
} catch (error) {
    console.error('❌ Erreur lors de la vérification:', error.message);
    process.exit(1);
}

db.close();
console.log('✨ Migration terminée!');
