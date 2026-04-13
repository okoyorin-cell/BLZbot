const db = require('../database/database');

function createShopTable() {
    try {
        // Drop the table if it exists to ensure a clean slate (for development)
        // In a production environment, you would use a more sophisticated migration strategy.
        db.exec('DROP TABLE IF EXISTS daily_shop');

        // Create the table
        db.exec(`
            CREATE TABLE IF NOT EXISTS daily_shop (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id TEXT NOT NULL,
                generated_at DATE NOT NULL
            )
        `);
        console.log('Table "daily_shop" créée ou déjà existante.');

        // You could also add initial data here if needed
        console.log('La base de données de la boutique est prête.');

    } catch (error) {
        console.error('Erreur lors de la création de la table de la boutique:', error);
    }
}

// Run the setup
createShopTable();
