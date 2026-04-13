const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// Ouvrir la base de données existante
const db = new sqlite3.Database('banned_links.db');

// Fonction pour sauvegarder la base de données
function backupDatabase(callback) {
  db.all('SELECT * FROM banned_links', [], (err, rows) => {
    if (err) {
      return console.error('Erreur lors de la sauvegarde de la base de données:', err.message);
    }
    // Écrire les données dans un fichier JSON
    fs.writeFile('AncienneBaseDeDonnée.json', JSON.stringify(rows, null, 2), (err) => {
      if (err) {
        return console.error('Erreur lors de l\'écriture du fichier:', err.message);
      }
      console.log('Base de données sauvegardée dans AncienneBaseDeDonnée.json');
      callback();
    });
  });
}

// Fonction pour réinitialiser la base de données
function resetDatabase() {
  db.run('DELETE FROM banned_links', [], (err) => {
    if (err) {
      return console.error('Erreur lors de la réinitialisation de la base de données:', err.message);
    }
    console.log('Base de données réinitialisée.');
    // Fermer la base de données une fois les opérations terminées
    db.close((err) => {
      if (err) {
        return console.error('Erreur lors de la fermeture de la base de données:', err.message);
      }
      console.log('Connexion à la base de données fermée.');
    });
  });
}

// Exécution de la sauvegarde puis de la réinitialisation
backupDatabase(() => {
  resetDatabase();
});
