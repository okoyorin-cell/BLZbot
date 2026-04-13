const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');

async function migrateSQLiteToMySQL() {
  // Connexion à MySQL
  const mysqlConnection = await mysql.createConnection({
    host: 'mysql.db.bot-hosting.net',
    port: 3306,
    user: 'u310521_n0vaT6jrw6',
    password: 'xreE!z8Sz^4ssd7kvsWTVCh!',
    database: 's310521_LienMalveillants'
  });

  // Créer la table banned_links sur MySQL si elle n'existe pas, avec la contrainte UNIQUE
  await mysqlConnection.execute(`
    CREATE TABLE IF NOT EXISTS banned_links (
      id INT AUTO_INCREMENT PRIMARY KEY,
      link TEXT NOT NULL UNIQUE
    )
  `);

  // Ouvrir la base SQLite (ici, le fichier s'appelle 'banned_links.db')
  const sqliteDB = new sqlite3.Database('banned_links.db', sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error("Erreur lors de l'ouverture de la base SQLite :", err);
      process.exit(1);
    }
  });

  // Lire les données de la table SQLite 'banned_links'
  sqliteDB.all("SELECT * FROM banned_links", async (err, rows) => {
    if (err) {
      console.error("Erreur lors de la lecture des données SQLite :", err);
      return;
    }

    for (let row of rows) {
      try {
        await mysqlConnection.execute(
          `INSERT IGNORE INTO banned_links (link) VALUES (?)`,
          [row.link]
        );
      } catch (e) {
        console.error("Erreur lors de l'insertion dans MySQL :", e, "\nDonnées :", row);
      }
    }

    console.log("Migration terminée !");
    sqliteDB.close();
    await mysqlConnection.end();
    
    // Action supplémentaire : par exemple, lancer un autre script ou notifier l'utilisateur
    // Exemple : exec('node main.js', ...) si nécessaire.
  });
}

migrateSQLiteToMySQL().catch(err => console.error(err));
