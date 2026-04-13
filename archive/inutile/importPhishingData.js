// importDomains.js

const fs = require('fs');
const readline = require('readline');
const sqlite3 = require('sqlite3').verbose();
const { exec } = require('child_process');

// Ouvrir la base de données des domaines bannis
const db = new sqlite3.Database('ban_domains.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, err => {
  if (err) {
    console.error('Erreur lors de la connexion à la base de données des domaines bannis :', err.message);
  } else {
    console.log('Connecté à la base de données des domaines bannis.');
    // Créer la table ban_domains si elle n'existe pas
    db.run('CREATE TABLE IF NOT EXISTS ban_domains (domain TEXT UNIQUE)', err => {
      if (err) {
        console.error('Erreur lors de la création de la table ban_domains :', err.message);
      } else {
        // Commencer l'importation après s'être assuré que la table est prête
        startImport();
      }
    });
  }
});

// Fonction pour vérifier si un domaine existe déjà dans la base de données
function isDomainAlreadyExists(domain, callback) {
  db.get('SELECT domain FROM ban_domains WHERE domain = ?', [domain], (err, row) => {
    if (err) {
      callback(err);
    } else {
      callback(null, !!row);
    }
  });
}

// Fonction pour ajouter un domaine à la base de données
function addBannedDomain(domain, callback) {
  isDomainAlreadyExists(domain, (err, exists) => {
    if (err) {
      callback(err);
    } else if (!exists) {
      db.run('INSERT INTO ban_domains (domain) VALUES (?)', [domain], err => {
        callback(err);
      });
    } else {
      callback();
    }
  });
}

// Fonction pour démarrer l'importation des données
function startImport() {

  // Création d'un flux de lecture du fichier
  const rl = readline.createInterface({
    input: fs.createReadStream('phishing-domains-ACTIVE.json'),
    crlfDelay: Infinity
  });

  let totalDomains = 0;
  let processedDomains = 0;
  let nextProgressUpdate = 5;
  const domains = [];

  rl.on('line', (line) => {
    const domain = line.trim();
    if (domain) {
      domains.push(domain);
      totalDomains++;
    }
  });

  rl.on('close', () => {
    console.log(`Nombre total de domaines à importer : ${totalDomains}`);

    // Encore doubler la vitesse en augmentant le batchSize et en réduisant l'intervalle
    const batchSize = 1000; // Au lieu de 500
    const interval = 250;   // Au lieu de 500 ms (0,25 seconde)

    function processBatch(index) {
      const end = Math.min(index + batchSize, domains.length);
      const batch = domains.slice(index, end);
      let processed = 0;

      function processNext() {
        if (processed < batch.length) {
          const domain = batch[processed];
          addBannedDomain(domain, (err) => {
            if (err) {
              console.error('Erreur lors de l\'ajout du domaine :', err.message);
            }
            processed++;
            processNext();
          });
        } else {
          processedDomains += batch.length;
          const progress = (processedDomains / totalDomains * 100).toFixed(2);
          console.log(`Progression : ${progress}%`);

          if (progress >= nextProgressUpdate) {
            nextProgressUpdate += 5;
          }

          if (end < domains.length) {
            setTimeout(() => processBatch(end), interval);
          } else {
            console.log('Importation des domaines terminée.');
            // Fermer la base de données une fois les opérations terminées
            db.close((err) => {
              if (err) {
                return console.error('Erreur lors de la fermeture de la base de données :', err.message);
              }
              console.log('Connexion à la base de données fermée.');

              // Lancer main.js après fermeture de la base de données
              exec('node main.js', (err, stdout, stderr) => {
                if (err) {
                  console.error('Erreur lors du lancement de main.js :', err.message);
                  return;
                }
                console.log('main.js lancé avec succès.');
                console.log(stdout);
              });
            });
          }
        }
      }

      processNext();
    }

    // Démarrer le traitement des lots
    processBatch(0);
  });
}

// Démarrer l'importation des données (si la table est déjà prête)
if (db.open) {
  startImport();
}
