/**
 * reset-commands.js
 *
 * Script de nettoyage complet des commandes slash :
 *  - Supprime TOUTES les commandes enregistrées sur le serveur (guild commands)
 *
 * Usage :
 *   node niveau/src/scripts/reset-and-redeploy-commands.js
 */

require('dotenv').config({ path: require('node:path').join(__dirname, '..', '..', '..', '.env') });

const { Client, GatewayIntentBits } = require('discord.js');

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
    const { BOT_TOKEN } = process.env;
    const GUILD_ID = '1097110036192448656';

    if (!BOT_TOKEN) {
        console.error('❌ BOT_TOKEN manquant dans le fichier .env');
        process.exit(1);
    }

    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('  SUPPRESSION COMPLÈTE DES COMMANDES SLASH');
    console.log('══════════════════════════════════════════════════════════════\n');

    // ── Connexion du client Discord ───────────────────────────────────────────
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });

    await new Promise((resolve, reject) => {
        client.once('ready', resolve);
        client.once('error', reject);
        client.login(BOT_TOKEN);
    });

    console.log(`✅ Connecté en tant que ${client.user.tag}\n`);

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        if (!guild) {
            console.error('❌ Guild introuvable. Vérifiez GUILD_ID dans .env');
            process.exit(1);
        }

        console.log(`🏠 Serveur : ${guild.name} (${guild.id})\n`);

        // ── Suppression via PUT [] (remplace toutes les commandes par rien) ───
        console.log('🗑️  Récupération des commandes existantes...');
        const existingCommands = await guild.commands.fetch();
        console.log(`  → ${existingCommands.size} commande(s) enregistrée(s)\n`);

        console.log('📤 Envoi PUT avec tableau vide → suppression de toutes les commandes...');
        await guild.commands.set([]); // PUT /applications/:id/guilds/:guild/commands avec body []
        console.log('  ✅ Toutes les commandes supprimées.\n');

        // ── Résumé ────────────────────────────────────────────────────────────
        console.log('\n══════════════════════════════════════════════════════════════');
        console.log('  RÉSUMÉ');
        console.log('══════════════════════════════════════════════════════════════');
        console.log(`  🗑️  Supprimées : ${existingCommands.size} (via PUT [])`);
        console.log('══════════════════════════════════════════════════════════════\n');

    } catch (err) {
        console.error('❌ Erreur globale :', err);
    } finally {
        await client.destroy();
        console.log('🔌 Client déconnecté. Script terminé.');
    }
}

main();
