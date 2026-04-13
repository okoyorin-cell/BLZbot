require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
    LOG_CHANNEL_ID: '1343195904399773706', // Salon de logs des modérateurs
    SANCTION_LOG_CHANNEL_ID: '1343193683595366482', // Salon de logs des sanctions
    BLACKLISTED_CATEGORY_ID: '1323250666545746002', // Catégorie à ignorer
    BLOCK_DURATION: 3600000, // 1 heure en millisecondes
    DEFAULT_MESSAGES_PER_HOUR: 300, // Valeur par défaut pour les salons sans historique
    BOT_TOKEN: process.env.BOT_TOKEN // Token du bot
};

// Connexion à MySQL
const connection = mysql.createConnection({
    host: 'mysql.db.bot-hosting.net',
    user: 'u3105231_GwmFcZAdPO',
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
}, 60000);

// Notifier les modérateurs
function notifyModerators(message) {
    const logChannel = client.channels.cache.get(config.LOG_CHANNEL_ID);
    if (logChannel) {
        logChannel.send(message);
    }
}

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
                blockSalon(salon_id);
            }
        });
    });
}

// Système anti-spam amélioré pour les salons vocaux
let messageCounts = new Map();

client.on('messageCreate', async message => {
    // Ignorer les bots et les salons blacklistés
    if (message.author.bot || message.channel.parentId === config.BLACKLISTED_CATEGORY_ID) return;

    const userId = message.author.id;
    const channelId = message.channel.id;

    // Vérifier si le salon est un salon vocal
    const isVoiceChannel = message.channel.isVoiceBased();

    // Réinitialiser les compteurs si un autre utilisateur intervient
    if (messageCounts.has(channelId)) {
        messageCounts.get(channelId).forEach((count, id) => {
            if (id !== userId) {
                messageCounts.get(channelId).set(id, 0);
            }
        });
    }

    // Initialiser le compteur pour le salon si nécessaire
    if (!messageCounts.has(channelId)) {
        messageCounts.set(channelId, new Map());
    }

    const userMessageCount = messageCounts.get(channelId).get(userId) || 0;

    // Seuils différents pour les salons vocaux et textuels
    const warningThreshold = isVoiceChannel ? 15 : 10; // Avertissement après 15 messages dans un salon vocal, 10 dans un salon textuel
    const sanctionThreshold = isVoiceChannel ? 25 : 20; // Sanction après 20 messages dans un salon vocal, 15 dans un salon textuel

    // Avertir après X messages sans réponse
    if (userMessageCount >= warningThreshold) {
        if (userMessageCount === warningThreshold) {
            await message.channel.send(`Attention <@${userId}>, vous parlez tout seul. Si vous continuez, vous aurez une sanction.`);
        } else if (userMessageCount >= sanctionThreshold) {
            const member = message.guild.members.cache.get(userId);
            if (member && member.moderatable) {
                await member.timeout(3600000, 'Spam');
                const sanctionLogChannel = client.channels.cache.get(config.SANCTION_LOG_CHANNEL_ID);
                if (sanctionLogChannel) {
                    sanctionLogChannel.send(`# ${member.user.tag} (${member.id}) a été time out 1 heure pour avoir spam.`);
                }
            }
            messageCounts.get(channelId).delete(userId);
            return;
        }
    }

    // Ignorer les messages courts dans les salons vocaux (moins de 5 caractères)
    if (isVoiceChannel && message.content.length < 5) {
        return;
    }

    // Incrémenter le compteur de messages
    messageCounts.get(channelId).set(userId, userMessageCount + 1);

    // Réinitialiser le compteur après 5 minutes d'inactivité
    setTimeout(() => {
        if (messageCounts.has(channelId) && messageCounts.get(channelId).has(userId)) {
            const currentCount = messageCounts.get(channelId).get(userId) || 0;
            if (currentCount > 0) {
                messageCounts.get(channelId).set(userId, currentCount - 1);
            }
        }
    }, 300000); // 5 minutes en millisecondes
});

// Activer le mode "True Raid"
function activateTrueRaid() {
    const salons = client.channels.cache.filter(channel => channel.isTextBased());
    salons.forEach(async salon => {
        await salon.permissionOverwrites.edit(salon.guild.roles.everyone, {
            SendMessages: false
        });
    });
    notifyModerators('Le mode "True Raid" a été activé.');
}

// Commande pour activer manuellement le mode "True Raid"
client.on('messageCreate', async message => {
    if (message.content === '+starttrueraid' && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        activateTrueRaid();
        notifyModerators('Le mode "True Raid" a été activé manuellement.');
    }
});

// Vérifier les salons bloqués au démarrage
client.once('ready', () => {
    console.log(`Bot connecté en tant que ${client.user.tag}`);

    // Vérifier les salons bloqués au démarrage
    for (const [salon_id, unblockTime] of Object.entries(blockedSalons)) {
        const salon = client.channels.cache.get(salon_id);
        if (salon && salon.isTextBased()) {
            // Vérifier si le salon doit encore être bloqué
            if (Date.now() < unblockTime) {
                salon.permissionOverwrites.edit(salon.guild.roles.everyone, {
                    SendMessages: false
                });
            } else {
                // Débloquer le salon si le temps est écoulé
                delete blockedSalons[salon_id];
                saveBlockedSalons();
            }
        }
    }
});

// Démarrer le bot
client.login(config.BOT_TOKEN);
