const dbManager = require('../modération/src/modules/database');

console.log("Tentative de correction de la base de données...");

try {
    const db = dbManager.getTempRemovedRolesDb();

    // 1. Création de la table si elle n'existe pas
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS temp_removed_roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId TEXT NOT NULL,
            roleId TEXT NOT NULL,
            expires_at INTEGER NOT NULL
        )
    `;

    db.run(createTableQuery, function (err) {
        if (err) {
            console.error("ERREUR SQL lors de la création de la table:", err.message);
            return;
        }

        console.log("Table 'temp_removed_roles' vérifiée/créée.");

        // 2. Vérification de la colonne 'expires_at'
        db.all("PRAGMA table_info(temp_removed_roles)", function (err, rows) {
            if (err) {
                console.error("Erreur lors de la vérification des colonnes:", err.message);
                return;
            }

            const hasExpiresAt = rows.some(row => row.name === 'expires_at');

            if (!hasExpiresAt) {
                console.log("Colonne 'expires_at' manquante. Ajout en cours...");
                db.run("ALTER TABLE temp_removed_roles ADD COLUMN expires_at INTEGER DEFAULT 0", function (err) {
                    if (err) {
                        console.error("Erreur lors de l'ajout de la colonne 'expires_at':", err.message);
                    } else {
                        console.log("SUCCÈS: Colonne 'expires_at' ajoutée.");
                    }
                });
            } else {
                console.log("La colonne 'expires_at' existe déjà.");
            }
        });
    });

} catch (error) {
    console.error("ERREUR CRITIQUE:", error);
}
