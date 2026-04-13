/**
 * Script de migration pour marquer les guildes en sureffectif (>12 membres)
 * À exécuter après le déploiement du système de pénalités
 * Date de référence: 10 février 2026
 */

const db = require('../database/database');
const logger = require('../utils/logger');

const MAX_MEMBERS = 12;

function markOverstaffedGuilds() {
    console.log('🔍 Vérification des guildes en sureffectif...\n');

    // Récupérer toutes les guildes
    const guilds = db.prepare('SELECT id, name, emoji FROM guilds').all();
    
    let markedCount = 0;
    let exemptCount = 0;

    for (const guild of guilds) {
        // Compter les membres
        const memberCount = db.prepare('SELECT COUNT(*) as count FROM guild_members WHERE guild_id = ?')
            .get(guild.id).count;

        if (memberCount > MAX_MEMBERS) {
            // Marquer la guilde comme en sureffectif
            const now = Date.now();
            db.prepare('UPDATE guilds SET overstaffed_since = ? WHERE id = ?')
                .run(now, guild.id);

            markedCount++;
            console.log(`⚠️  ${guild.emoji} ${guild.name} : ${memberCount} membres (${memberCount - MAX_MEMBERS} en trop) - MARQUÉE`);
        } else {
            exemptCount++;
            console.log(`✅ ${guild.emoji} ${guild.name} : ${memberCount} membres - OK`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📊 Résultats de la migration :`);
    console.log(`   - Guildes marquées en sureffectif : ${markedCount}`);
    console.log(`   - Guildes conformes : ${exemptCount}`);
    console.log(`   - Total de guildes : ${guilds.length}`);
    console.log('='.repeat(60));

    if (markedCount > 0) {
        console.log('\n⚠️  ATTENTION :');
        console.log(`   ${markedCount} guilde(s) ont été marquées en sureffectif.`);
        console.log(`   Ces guildes ont désormais toutes leurs fonctionnalités désactivées sauf kick/quit.`);
        console.log(`   Les pénalités seront appliquées à minuit Paris chaque jour.`);
        console.log(`   Formule : (membres_en_trop * 1000 * jours_depuis_marquage) starss par membre`);
    }
}

// Exécution si lancé directement
if (require.main === module) {
    try {
        markOverstaffedGuilds();
        console.log('\n✅ Migration terminée avec succès !');
    } catch (error) {
        console.error('❌ Erreur lors de la migration :', error);
        process.exit(1);
    }
}

module.exports = { markOverstaffedGuilds };
