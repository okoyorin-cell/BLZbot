require('dotenv').config();
const mysql = require('mysql2');

// Connexion à MySQL
const connection = mysql.createConnection({
    host: 'mysql.db.bot-hosting.net',
    user: 'u310521_GwmFcZAdPO',
    password: 'uQ7sp8xvAQydI6l!@^FEs=c0',
    database: 's310521_Raid_infos'
});

connection.connect((err) => {
    if (err) {
        console.error('Erreur de connexion à la base de données MySQL :', err);
    } else {
        console.log('Connecté à la base de données MySQL !');
        resetTables();
    }
});

// Fonction pour réinitialiser les tables
function resetTables() {
    // Vider la table salon_activity
    const resetActivityQuery = `DELETE FROM salon_activity`;
    connection.query(resetActivityQuery, (err) => {
        if (err) {
            console.error('Erreur lors de la réinitialisation de la table salon_activity :', err);
        } else {
            console.log('Table salon_activity réinitialisée avec succès.');
        }
    });

    // Vider la table salon_averages
    const resetAveragesQuery = `DELETE FROM salon_averages`;
    connection.query(resetAveragesQuery, (err) => {
        if (err) {
            console.error('Erreur lors de la réinitialisation de la table salon_averages :', err);
        } else {
            console.log('Table salon_averages réinitialisée avec succès.');
            connection.end(); // Fermer la connexion après la réinitialisation
        }
    });
}
