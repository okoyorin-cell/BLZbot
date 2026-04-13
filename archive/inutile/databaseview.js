const mysql = require('mysql2');

// Configuration de la connexion MySQL
const connection = mysql.createConnection({
    host: 'mysql.db.bot-hosting.net',
    user: 'u310521_GwmFcZAdPO',
    password: 'uQ7sp8xvAQydI6l!@^FEs=c0',
    database: 's310521_Raid_infos'
});

// Connexion à la base de données
connection.connect((err) => {
    if (err) {
        console.error('Erreur de connexion à la base de données :', err);
        return;
    }
    console.log('Connecté à la base de données MySQL !');

    // Lire les données de la table `salon_activity`
    connection.query('SELECT * FROM salon_activity', (err, results) => {
        if (err) {
            console.error('Erreur lors de la lecture de la table salon_activity :', err);
            return;
        }
        console.log('\nDonnées de la table salon_activity :');
        console.table(results); // Affiche les résultats sous forme de tableau
    });

    // Lire les données de la table `salon_averages`
    connection.query('SELECT * FROM salon_averages', (err, results) => {
        if (err) {
            console.error('Erreur lors de la lecture de la table salon_averages :', err);
            return;
        }
        console.log('\nDonnées de la table salon_averages :');
        console.table(results); // Affiche les résultats sous forme de tableau
    });

    // Fermer la connexion après la lecture
    connection.end();
});
