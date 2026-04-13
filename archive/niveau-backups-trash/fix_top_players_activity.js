const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../database/blzbot.sqlite');
const db = new Database(dbPath);

console.log('--- RESTAURATION DE L\'ACTIVITÉ DES TOP JOUEURS ---');

// Objectif (RP à récupérer part 2):
// 1. onissprime : 1 652 805 RP
// 2. aka_xena : 1 239 603 RP
// 3. oliviaacaca : 107 590 RP
// Ratio: ~659.92 RP / message

const players = [
    { username: 'onissprime', targetRP: 1652805 },
    { username: 'aka_xena', targetRP: 1239603 },
    { username: 'oliviaacaca', targetRP: 107590 }
];

const RP_PER_MESSAGE = 659.92;
const todayStr = new Date().toISOString().split('T')[0]; // Format 'YYYY-MM-DD'

try {
    const getUserStmt = db.prepare('SELECT id, points FROM users WHERE username = ? COLLATE NOCASE');
    const updatePointsStmt = db.prepare('UPDATE users SET points = 100000 WHERE id = ?');
    const insertActivityStmt = db.prepare(`
        INSERT INTO ranked_daily_activity (user_id, date, messages, voice_minutes)
        VALUES (?, ?, ?, 0)
        ON CONFLICT(user_id, date) DO UPDATE SET messages = excluded.messages
    `);

    for (const player of players) {
        const user = getUserStmt.get(player.username);

        if (!user) {
            console.error(`❌ Utilisateur non trouvé en base de données : ${player.username}`);
            continue;
        }

        // Calcul des messages nécessaires
        const messagesNeeded = Math.round(player.targetRP / RP_PER_MESSAGE);

        console.log(`\nTraitement pour ${player.username} (ID: ${user.id}):`);
        console.log(` - Objectif: 100k base + ${player.targetRP} RP`);
        console.log(` - Activité calculée: ${messagesNeeded} messages (Ratio: ${RP_PER_MESSAGE})`);

        // 1. Assurer qu'ils ont bien les 100k de base (si ce n'est pas déjà le cas ou plus élevé)
        if (user.points < 100000) {
            updatePointsStmt.run(user.id);
            console.log(` - Points de base réinitialisés à 100 000.`);
        } else {
            console.log(` - Points actuels suffisants (${user.points}), pas de reset des 100k.`);
        }

        // 2. Injecter l'activité
        insertActivityStmt.run(user.id, todayStr, messagesNeeded);
        console.log(` - Activité injectée: ${messagesNeeded} messages attribués pour la date ${todayStr}.`);
    }

    console.log('\n--- TERMINÉ ---');

} catch (err) {
    console.error('Erreur lors de la restauration:', err);
} finally {
    db.close();
}
