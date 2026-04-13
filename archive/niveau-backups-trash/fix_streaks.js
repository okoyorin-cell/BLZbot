const { Client, GatewayIntentBits } = require('discord.js');
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const dbPath = path.join(__dirname, '../database/blzbot.sqlite');
const db = new Database(dbPath);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

if (!process.env.BOT_TOKEN) {
    console.error("ERREUR FATALE: BOT_TOKEN est introuvable. Vérifiez votre .env");
    process.exit(1);
}

// Heure limite: Aujourd'hui à 13h07 (Heure locale de Paris / Europe/Paris)
const cutoffDate = new Date();
cutoffDate.setHours(13, 7, 0, 0);
const CUTOFF_TIMESTAMP = cutoffDate.getTime();

client.once('ready', async () => {
    console.log(`Connecté en tant que ${client.user.tag}`);

    try {
        // Remettre tous les streaks à 0 avant de recommencer
        console.log('--- RÉINITIALISATION DES STREAKS ---');
        db.exec('UPDATE users SET streak = 0');
        console.log('Tous les streaks remis à 0.');

        console.log('\n--- RÉCUPÉRATION DES STREAKS ---');
        const STREAK_CHANNEL_ID = '1454479486476357764';
        const streakChannel = await client.channels.fetch(STREAK_CHANNEL_ID).catch(() => null);
        let userStreaks = new Map();

        if (streakChannel && streakChannel.isTextBased()) {
            let lastId;
            let messagesCount = 0;
            console.log('Récupération des messages de streaks...');

            while (true) {
                const options = { limit: 100 };
                if (lastId) options.before = lastId;

                const messages = await streakChannel.messages.fetch(options).catch(() => new Map());
                if (messages.size === 0) break;

                messages.forEach(msg => {
                    // Ignorer les messages générés aujourd'hui après 13h07
                    if (msg.createdTimestamp > CUTOFF_TIMESTAMP) return;

                    const mentions = msg.mentions.users;
                    if (mentions.size > 0) {
                        const user = mentions.first();

                        // Le message exact est : "Bravo <@ID> qui a maintenant une streak de X jours !"
                        // La regex cherche "streak de " suivi d'un nombre.
                        const match = msg.content.match(/streak de (\d+)/i);

                        if (match) {
                            const streak = parseInt(match[1]);
                            if (!userStreaks.has(user.id) || userStreaks.get(user.id) < streak) {
                                userStreaks.set(user.id, streak);
                            }
                        }
                    }
                });

                lastId = messages.last().id;
                messagesCount += messages.size;
                console.log(`... ${messagesCount} messages analysés`);
            }

            console.log(`${userStreaks.size} streaks uniques trouvés.`);

            // Sauvegarde dans la BDD
            console.log('\n--- SAUVEGARDE DES STREAKS ---');
            const updateStreak = db.prepare('UPDATE users SET streak = ? WHERE id = ?');
            let updatedCount = 0;

            for (const [userId, streakVal] of userStreaks.entries()) {
                const info = updateStreak.run(streakVal, userId);
                if (info.changes > 0) {
                    updatedCount++;
                }
            }
            console.log(`${updatedCount} utilisateurs mis à jour avec une streak.`);

        } else {
            console.log('Salon de streaks introuvable ou inaccessible (Missing Access).');
        }

        console.log('\n--- TERMINÉ ---');

    } catch (error) {
        console.error('Erreur durant la récupération:', error);
    } finally {
        client.destroy();
        db.close();
        process.exit(0);
    }
});

client.login(process.env.BOT_TOKEN);
