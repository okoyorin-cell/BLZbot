require('dotenv').config();
const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
    BLOCK_DURATION: 3600000, // 1 heure en millisecondes
    DEFAULT_MESSAGES_PER_HOUR: 300, // Valeur par défaut pour les salons sans historique
    BOT_TOKEN: process.env.BOT_TOKEN // Token du bot
};

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
        console.log('Connected to MySQL database!');
    }
});

// Enregistrer l'activité d'un salon avec gestion des erreurs et logs
function recordActivity(salon_id, message_count) {
    const query = `
        INSERT INTO salon_activity (salon_id, date, hour, message_count)
        VALUES (?, CURDATE(), HOUR(NOW()), ?)
    `;
    connection.query(query, [salon_id, message_count], (err) => {
        if (err) {
            console.error('Erreur lors de l\'enregistrement de l\'activité pour le salon', salon_id, ':', err);
        } else {
            console.log(`Activité enregistrée pour le salon ${salon_id} : ${message_count} messages à ${new Date().toLocaleTimeString()}`);
            // Vérification immédiate
            connection.query('SELECT * FROM salon_activity WHERE salon_id = ?', [salon_id], (err, results) => {
                if (err) {
                    console.error('Erreur lors de la vérification de l\'activité pour le salon', salon_id, ':', err);
                } else {
                    console.log('Données après insertion :', results);
                }
            });
        }
    });
}

// Calculer la moyenne quotidienne
function updateAverage(salon_id) {
    const query = `
        INSERT INTO salon_averages (salon_id, average, last_updated)
        SELECT ?, AVG(message_count), CURDATE()
        FROM salon_activity
        WHERE salon_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        ON DUPLICATE KEY UPDATE average = VALUES(average), last_updated = VALUES(last_updated);
    `;
    connection.query(query, [salon_id, salon_id], (err) => {
        if (err) {
            console.error('Erreur lors de la mise à jour de la moyenne pour le salon', salon_id, ':', err);
        } else {
            console.log(`Moyenne mise à jour pour le salon ${salon_id}`);
        }
    });
}

// Vérifier si un raid est en cours
async function checkForRaid(salon_id) {
    // Vérifier si le salon a au moins 7 jours d'historique
    const historyQuery = `
        SELECT COUNT(DISTINCT date) AS history_days
        FROM salon_activity
        WHERE salon_id = ?;
    `;
    connection.query(historyQuery, [salon_id], (err, results) => {
        if (err) {
            console.error('Erreur lors de la vérification de l\'historique pour le salon', salon_id, ':', err);
            return;
        }

        const historyDays = results[0]?.history_days || 0;

        // Si le salon a moins de 7 jours d'historique, on ne bloque pas
        if (historyDays < 7) {
            console.log(`Salon ${salon_id} n'a pas encore 7 jours d'historique. Aucune action.`);
            return;
        }

        // Sinon, vérifier si l'activité dépasse le double de la moyenne
        const averageQuery = `
            SELECT average FROM salon_averages WHERE salon_id = ?;
        `;
        connection.query(averageQuery, [salon_id], (err, results) => {
            if (err) {
                console.error('Erreur lors de la récupération de la moyenne pour le salon', salon_id, ':', err);
                return;
            }

            const average = results[0]?.average || config.DEFAULT_MESSAGES_PER_HOUR;
            const currentCount = getCurrentMessageCount(salon_id); // À implémenter

            if (currentCount > 2 * average) {
                console.log(`Raid détecté dans le salon ${salon_id}. Action requise.`);
            }
        });
    });
}

// Fonction factice pour obtenir le nombre actuel de messages (à implémenter)
function getCurrentMessageCount(salon_id) {
    // Cette fonction doit être implémentée pour retourner le nombre actuel de messages dans le salon
    return 500; // Exemple de valeur
}

// Exemple d'utilisation des fonctions
recordActivity('example_salon_id', 100); // Enregistrer une activité fictive
updateAverage('example_salon_id'); // Mettre à jour la moyenne pour un salon fictif
checkForRaid('example_salon_id'); // Vérifier si un raid est en cours pour un salon fictif
