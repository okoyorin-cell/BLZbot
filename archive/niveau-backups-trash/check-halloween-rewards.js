/**
 * SCRIPT DE VÉRIFICATION DES RÉCOMPENSES HALLOWEEN
 * 
 * À exécuter APRÈS reset-citrouilles-compensation.js pour attribuer
 * les récompenses de paliers à tous les utilisateurs qui les méritent.
 * 
 * Ce script nécessite que le bot soit en cours d'exécution car il utilise
 * le client Discord pour attribuer les rôles et envoyer les notifications.
 * 
 * Utilisation : node scripts/check-halloween-rewards.js
 */

const { Client, GatewayIntentBits } = require('discord.js');
const Database = require('better-sqlite3');
const path = require('path');
const { checkAndGrantHalloweenRewards } = require('../utils/halloween-rewards');
const logger = require('../utils/logger');

// Créer le client Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

async function main() {
    console.log('=== VÉRIFICATION DES RÉCOMPENSES HALLOWEEN ===\n');
    
    try {
        // Se connecter au bot
        console.log('🔄 Connexion au bot Discord...');
        await client.login(process.env.TOKEN);
        console.log('✅ Bot connecté!\n');

        // Connexion à la base de données
        const dbPath = path.join(__dirname, '../database/Haloween.sqlite');
        const db = new Database(dbPath);
        
        // Récupérer tous les utilisateurs
        const allUsers = db.prepare('SELECT user_id, citrouilles, claimed_rewards FROM event_users').all();
        console.log(`📊 ${allUsers.length} utilisateurs à vérifier\n`);

        let checkedCount = 0;
        let rewardsGranted = 0;

        for (const user of allUsers) {
            // Parser claimed_rewards
            user.claimed_rewards = JSON.parse(user.claimed_rewards);
            
            try {
                const beforeCount = user.claimed_rewards.length;
                
                // Vérifier et attribuer les récompenses
                await checkAndGrantHalloweenRewards(client, user);
                
                // Recharger l'utilisateur pour voir si de nouvelles récompenses ont été ajoutées
                const updatedUser = db.prepare('SELECT claimed_rewards FROM event_users WHERE user_id = ?').get(user.user_id);
                const afterCount = JSON.parse(updatedUser.claimed_rewards).length;
                
                const newRewards = afterCount - beforeCount;
                if (newRewards > 0) {
                    console.log(`✅ User ${user.user_id}: ${newRewards} nouvelle(s) récompense(s) attribuée(s) (${user.citrouilles} citrouilles)`);
                    rewardsGranted += newRewards;
                }
                
                checkedCount++;
            } catch (error) {
                console.error(`❌ Erreur pour l'utilisateur ${user.user_id}:`, error.message);
            }
        }

        console.log('\n=== RÉSUMÉ ===');
        console.log(`✅ Utilisateurs vérifiés: ${checkedCount}/${allUsers.length}`);
        console.log(`🎁 Récompenses attribuées: ${rewardsGranted}`);
        console.log('\n✅ Vérification terminée!');

        db.close();
        await client.destroy();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ ERREUR:', error.message);
        console.error(error.stack);
        await client.destroy();
        process.exit(1);
    }
}

// Attendre que le bot soit prêt avant de commencer
client.once('ready', () => {
    console.log(`✅ Bot prêt: ${client.user.tag}\n`);
    main();
});

// Gérer les erreurs non capturées
process.on('unhandledRejection', error => {
    console.error('Erreur non gérée:', error);
    process.exit(1);
});
