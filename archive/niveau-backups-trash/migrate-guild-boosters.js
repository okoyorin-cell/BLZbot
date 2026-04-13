const Database = require('better-sqlite3');
const path = require('path');

// Connexion à la base de données
const db = new Database(path.join(__dirname, '../database/blzbot.sqlite'));

console.log('🔧 Migration: Conversion des anciens boosters de guilde...');

try {
    // Vérifier s'il y a des guildes avec l'ancien système
    const guildsWithOldSystem = db.prepare(`
        SELECT id, name, boost_level, treasury_multiplier_level 
        FROM guilds 
        WHERE boost_level > 0 OR treasury_multiplier_level > 0
    `).all();

    if (guildsWithOldSystem.length === 0) {
        console.log('ℹ️  Aucune guilde à migrer (aucune n\'utilise l\'ancien système)');
    } else {
        console.log(`📊 ${guildsWithOldSystem.length} guilde(s) à migrer...`);
        
        const updateStmt = db.prepare(`
            UPDATE guilds 
            SET xp_boost_purchased = ?, 
                treasury_multiplier_purchased = ?
            WHERE id = ?
        `);

        for (const guild of guildsWithOldSystem) {
            // Convertir boost_level -> xp_boost_purchased
            const xpBoost = guild.boost_level;
            
            // Convertir treasury_multiplier_level -> treasury_multiplier_purchased
            // Ancien: level 1 = x200, level 2 = x400, level 3 = x800
            // Nouveau: purchased 1 = x200, purchased 2 = x400, purchased 3 = x800
            // Donc c'est identique, mais on ajoute +1 car le système stocke différemment
            const treasuryBoost = guild.treasury_multiplier_level > 0 
                ? guild.treasury_multiplier_level + 1 
                : 0;

            updateStmt.run(xpBoost, treasuryBoost, guild.id);
            console.log(`  ✅ Guilde "${guild.name}": XP boost ${xpBoost}, Treasury ${treasuryBoost}`);
        }
        
        console.log('✅ Migration terminée avec succès!');
    }

    // Statistiques finales
    const stats = db.prepare(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN xp_boost_purchased > 0 THEN 1 ELSE 0 END) as with_xp,
            SUM(CASE WHEN points_boost_purchased > 0 THEN 1 ELSE 0 END) as with_points,
            SUM(CASE WHEN treasury_multiplier_purchased > 0 THEN 1 ELSE 0 END) as with_treasury
        FROM guilds
    `).get();

    console.log('\n📈 Statistiques des boosters:');
    console.log(`   Total guildes: ${stats.total}`);
    console.log(`   Avec boost XP: ${stats.with_xp}`);
    console.log(`   Avec boost Points: ${stats.with_points}`);
    console.log(`   Avec boost Treasury: ${stats.with_treasury}`);

} catch (error) {
    console.error('❌ Erreur lors de la migration:', error.message);
    process.exit(1);
}

db.close();
console.log('✨ Script terminé!');
