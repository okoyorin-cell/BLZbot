/**
 * SCRIPT EXCEPTIONNEL - À EXÉCUTER UNE SEULE FOIS
 * 
 * Reset tous les utilisateurs ayant plus de 15 000 citrouilles à 15 000
 * Donne une compensation de 3 000 citrouilles à tous les membres enregistrés
 * Si le total dépasse 15 000, cap à 15 000
 * 
 * ⚠️ IMPORTANT : Après l'exécution de ce script, exécutez check-halloween-rewards.js
 * pour attribuer automatiquement les récompenses de paliers aux utilisateurs qui 
 * atteignent de nouveaux seuils grâce aux 3 000 citrouilles bonus.
 * 
 * Commandes à exécuter :
 * 1. node scripts/reset-citrouilles-compensation.js
 * 2. node scripts/check-halloween-rewards.js
 */

const Database = require('better-sqlite3');
const path = require('path');

// Connexion à la base de données Halloween
const dbPath = path.join(__dirname, '../database/Haloween.sqlite');
const db = new Database(dbPath);

console.log('=== SCRIPT DE RESET CITROUILLES + COMPENSATION ===\n');

try {
    // Commencer une transaction pour assurer l'intégrité
    db.prepare('BEGIN').run();

    // 1. Obtenir tous les utilisateurs enregistrés
    const allUsers = db.prepare('SELECT user_id, citrouilles FROM event_users').all();
    console.log(`📊 Nombre total d'utilisateurs dans la DB: ${allUsers.length}\n`);

    let resetCount = 0;
    let compensationCount = 0;
    let cappedCount = 0;

    // 2. Traiter chaque utilisateur
    for (const user of allUsers) {
        const currentCitrouilles = user.citrouilles || 0;
        let newCitrouilles = currentCitrouilles;
        const hadMoreThan15k = currentCitrouilles > 15000;

        // Étape 1: Reset si > 15 000
        if (hadMoreThan15k) {
            newCitrouilles = 15000;
            resetCount++;
            console.log(`🔽 Reset: User ${user.user_id} avait ${currentCitrouilles} citrouilles → 15 000`);
        }

        // Étape 2: Ajouter compensation de 3 000 (sauf pour ceux qui avaient >15k avant reset)
        if (!hadMoreThan15k) {
            const potentialTotal = newCitrouilles + 3000;
            
            if (potentialTotal > 15000) {
                // Cap à 15 000
                const actualBonus = 15000 - newCitrouilles;
                newCitrouilles = 15000;
                cappedCount++;
                console.log(`📈 Compensation cappée: User ${user.user_id}: ${currentCitrouilles} + ${actualBonus} (au lieu de 3000) = 15 000`);
            } else {
                // Ajouter les 3 000 complets
                newCitrouilles = potentialTotal;
                compensationCount++;
                console.log(`✅ Compensation complète: User ${user.user_id}: ${currentCitrouilles} + 3000 = ${newCitrouilles}`);
            }
        } else {
            console.log(`❌ Pas de compensation: User ${user.user_id} avait ${currentCitrouilles} citrouilles (>15k), reset à 15k sans bonus`);
        }

        // Mettre à jour la base de données
        if (newCitrouilles !== currentCitrouilles) {
            db.prepare('UPDATE event_users SET citrouilles = ? WHERE user_id = ?').run(
                newCitrouilles,
                user.user_id
            );
        }
    }

    // Commit de la transaction
    db.prepare('COMMIT').run();

    // Résumé
    console.log('\n=== RÉSUMÉ DES OPÉRATIONS ===');
    console.log(`🔽 Utilisateurs reset (>15k → 15k): ${resetCount}`);
    console.log(`✅ Compensations complètes (+3000): ${compensationCount}`);
    console.log(`📈 Compensations cappées (<3000): ${cappedCount}`);
    console.log(`📊 Total d'utilisateurs traités: ${allUsers.length}`);
    console.log('\n✅ Script terminé avec succès!');

} catch (error) {
    // En cas d'erreur, annuler toutes les modifications
    db.prepare('ROLLBACK').run();
    console.error('\n❌ ERREUR:', error.message);
    console.error('Toutes les modifications ont été annulées.');
    process.exit(1);
} finally {
    db.close();
}
