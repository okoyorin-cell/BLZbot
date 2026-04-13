require('dotenv').config();
const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

// Configuration
const config = {
    INACTIVITY_THRESHOLD: 48 * 60 * 60 * 1000, // 48 heures en millisecondes
    LEARNING_PERIOD: 24 * 60 * 60 * 1000, // 24 heures en millisecondes
    BLOCK_DURATION: 60 * 60 * 1000, // 1 heure en millisecondes
    MESSAGE_THRESHOLD: 300, // Seuil de messages par heure
    BOT_TOKEN: process.env.BOT_TOKEN, // Token du bot
    LOG_CHANNEL_ID: '1343195904399773706', // Salon de logs des modérateurs
    SANCTION_LOG_CHANNEL_ID: '1343193683595366482', // Salon de logs des sanctions
    BLACKLISTED_CATEGORY_ID: '1323250666545746002' // Catégorie à ignorer
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
    }
});

// Initialiser le client Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Charger les salons bloqués
const blockedSalonsPath = path.join(__dirname, 'blockedSalons.json');
let blockedSalons = {};
if (fs.existsSync(blockedSalonsPath)) {
    blockedSalons = JSON.parse(fs.readFileSync(blockedSalonsPath, 'utf8'));
}

// Sauvegarder les salons bloqués
function saveBlockedSalons() {
    fs.writeFileSync(blockedSalonsPath, JSON.stringify(blockedSalons, null, 2));
}

// Enregistrer l'activité d'un salon
function recordActivity(salon_id, message_count) {
    const query = `
        INSERT INTO salon_activity (salon_id, date, hour, message_count)
        VALUES (?, CURDATE(), HOUR(NOW()), ?)
        ON DUPLICATE KEY UPDATE message_count = message_count + VALUES(message_count);
    `;
    connection.query(query, [salon_id, message_count], (err) => {
        if (err) {
            console.error('Erreur lors de l\'enregistrement de l\'activité pour le salon', salon_id, ':', err);
        }
    });
}

// Calculer la moyenne quotidienne pour tous les salons
function updateAverages() {
    const query = `
        INSERT INTO salon_averages (salon_id, average, last_updated)
        SELECT salon_id, AVG(message_count) / COUNT(DISTINCT date) AS average, CURDATE()
        FROM salon_activity
        WHERE date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY salon_id
        ON DUPLICATE KEY UPDATE average = VALUES(average), last_updated = VALUES(last_updated);
    `;
    connection.query(query, (err) => {
        if (err) {
            console.error('Erreur lors de la mise à jour des moyennes :', err);
        }
    });
}

// Vérifier les salons inactifs
function checkInactiveSalons() {
    const query = `
        SELECT salon_id, MAX(date) as last_active
        FROM salon_activity
        GROUP BY salon_id
        HAVING last_active < DATE_SUB(CURDATE(), INTERVAL 2 DAY);
    `;
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Erreur lors de la vérification des salons inactifs :', err);
            return;
        }

        results.forEach((row) => {
            deleteSalonData(row.salon_id);
        });
    });
}

// Supprimer les données d'un salon
function deleteSalonData(salon_id) {
    const query = `DELETE FROM salon_activity WHERE salon_id = ?`;
    connection.query(query, [salon_id], (err) => {
        if (err) {
            console.error('Erreur lors de la suppression des données pour le salon', salon_id, ':', err);
        }
    });
}

// Vérifier si un raid est en cours pour tous les salons
async function checkForRaids() {
    const salonsQuery = `SELECT DISTINCT salon_id FROM salon_activity`;
    connection.query(salonsQuery, (err, results) => {
        if (err) {
            console.error('Erreur lors de la récupération des salons :', err);
            return;
        }

        results.forEach((row) => {
            checkForRaid(row.salon_id);
        });
    });
}

// Vérifier si un raid est en cours pour un salon spécifique
function checkForRaid(salon_id) {
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

        if (historyDays < 7) {
            return;
        }

        const averageQuery = `
            SELECT average FROM salon_averages WHERE salon_id = ?;
        `;
        connection.query(averageQuery, [salon_id], (err, results) => {
            if (err) {
                console.error('Erreur lors de la récupération de la moyenne pour le salon', salon_id, ':', err);
                return;
            }

            const average = results[0]?.average || config.MESSAGE_THRESHOLD;
            const currentCount = getCurrentMessageCount(salon_id); // À implémenter

            if (currentCount > 2 * average || currentCount > 600) {
                blockSalon(salon_id);
            }
        });
    });
}

// Bloquer un salon
async function blockSalon(salon_id) {
    const salon = client.channels.cache.get(salon_id);
    if (salon && salon.isTextBased()) {
        // Vérifier que @everyone ne peut pas parler
        const permissions = salon.permissionsFor(salon.guild.roles.everyone);
        if (permissions.has(PermissionsBitField.Flags.SendMessages)) {
            await salon.permissionOverwrites.edit(salon.guild.roles.everyone, {
                SendMessages: false
            });
        }

        // Bloquer le salon
        blockedSalons[salon_id] = Date.now() + config.BLOCK_DURATION;
        saveBlockedSalons();

        // Envoyer un message dans le salon
        await salon.send('Ce salon a été bloqué temporairement en raison d\'une activité suspecte.');

        // Notifier les modérateurs
        notifyModerators(`Salon ${salon_id} bloqué pour activité suspecte.`);
    }
}

// Débloquer un salon
async function unblockSalon(salon_id) {
    const salon = client.channels.cache.get(salon_id);
    if (salon && salon.isTextBased()) {
        await salon.permissionOverwrites.edit(salon.guild.roles.everyone, {
            SendMessages: null
        });
        delete blockedSalons[salon_id];
        saveBlockedSalons();
        notifyModerators(`Salon ${salon_id} débloqué.`);
    }
}

// Vérifier les salons bloqués toutes les minutes
setInterval(() => {
    const now = Date.now();
    for (const [salon_id, unblockTime] of Object.entries(blockedSalons)) {
        if (now >= unblockTime) {
            unblockSalon(salon_id);
        }
    }
    checkInactiveSalons();
    updateAverages();
    checkForRaids();
}, 60000);

// Notifier les modérateurs
function notifyModerators(message) {
    const logChannel = client.channels.cache.get(config.LOG_CHANNEL_ID);
    if (logChannel) {
        logChannel.send(message);
    }
}

// Fonction pour obtenir le nombre actuel de messages (à implémenter)
function getCurrentMessageCount(salon_id) {
    // Cette fonction doit être implémentée pour retourner le nombre actuel de messages dans le salon
    // Pour l'instant, retourne une valeur fictive
    return 500; // Exemple de valeur
}

// Écouter les messages pour enregistrer l'activité
client.on('messageCreate', async message => {
    // Ignorer les bots et les salons blacklistés
    if (message.author.bot || message.channel.parentId === config.BLACKLISTED_CATEGORY_ID) return;

    const salon_id = message.channel.id;
    recordActivity(salon_id, 1); // Enregistrer 1 message pour le salon actuel
});

// Démarrer le bot
client.login(config.BOT_TOKEN);
