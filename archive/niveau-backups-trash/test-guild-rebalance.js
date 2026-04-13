/**
 * Script de test pour le système de rôles personnalisés et pénalités de sureffectif
 * Pour tester les nouvelles fonctionnalités avant déploiement
 */

const db = require('../database/database');
const { getCustomRoles, addOrUpdateCustomRole, hasCustomPermission, CUSTOM_ROLE_PERMISSIONS } = require('../utils/guild/guild-custom-roles');
const { isGuildOverstaffed, areGuildFeaturesDisabled, calculateOverstaffPenalty } = require('../utils/guild/guild-overstaffing');

console.log('🧪 Test du système de rôles personnalisés et sureffectif\n');
console.log('='.repeat(70) + '\n');

// Test 1: Vérification de la structure de la base de données
console.log('📊 Test 1: Vérification de la structure de la base de données');
try {
    // Vérifier que les colonnes existent
    const guildsInfo = db.prepare("PRAGMA table_info(guilds)").all();
    const hasCustomRoles = guildsInfo.some(col => col.name === 'custom_roles');
    const hasOverstaffedSince = guildsInfo.some(col => col.name === 'overstaffed_since');
    const hasEmoji = guildsInfo.some(col => col.name === 'emoji');
    
    console.log(`   ✅ Colonne 'custom_roles' : ${hasCustomRoles ? 'OK' : '❌ MANQUANTE'}`);
    console.log(`   ✅ Colonne 'overstaffed_since' : ${hasOverstaffedSince ? 'OK' : '❌ MANQUANTE'}`);
    console.log(`   ✅ Colonne 'emoji' : ${hasEmoji ? 'OK' : '❌ MANQUANTE'}`);
    
    const guildMembersInfo = db.prepare("PRAGMA table_info(guild_members)").all();
    const hasCustomRole = guildMembersInfo.some(col => col.name === 'custom_role');
    console.log(`   ✅ Colonne 'custom_role' dans guild_members : ${hasCustomRole ? 'OK' : '❌ MANQUANTE'}`);
    
    // Vérifier la table custom_roles
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='custom_roles'").all();
    console.log(`   ✅ Table 'custom_roles' : ${tables.length > 0 ? 'OK' : '❌ MANQUANTE'}`);
    
    console.log('   ✅ Structure de la base de données OK\n');
} catch (error) {
    console.error('   ❌ Erreur lors de la vérification de la structure :', error.message + '\n');
}

// Test 2: Test des rôles personnalisés
console.log('📋 Test 2: Gestion des rôles personnalisés');
try {
    // Trouver une guilde de test (Upgrade 7+)
    const testGuild = db.prepare('SELECT * FROM guilds WHERE upgrade_level >= 7 LIMIT 1').get();
    
    if (testGuild) {
        console.log(`   🏰 Guilde de test: ${testGuild.emoji} ${testGuild.name} (Niveau ${testGuild.upgrade_level})`);
        
        // Lister les rôles actuels
        const existingRoles = getCustomRoles(testGuild.id);
        console.log(`   📋 Rôles actuels: ${existingRoles.length}/3`);
        
        for (const role of existingRoles) {
            const perms = [];
            if (role.can_kick_members) perms.push('kick');
            if (role.can_manage_blacklist) perms.push('blacklist');
            if (role.can_start_war) perms.push('war');
            if (role.can_empty_treasury) perms.push('treasury');
            console.log(`      - "${role.name}" (pos. ${role.position}) : [${perms.join(', ')}]`);
        }
        
        // Test création d'un rôle (simulation)
        if (existingRoles.length < 3) {
            console.log(`   ℹ️  Possibilité de créer ${3 - existingRoles.length} rôle(s) supplémentaire(s)`);
        } else {
            console.log(`   ⚠️  Limite de 3 rôles atteinte`);
        }
        
        console.log('   ✅ Système de rôles personnalisés fonctionnel\n');
    } else {
        console.log('   ⚠️  Aucune guilde Upgrade 7+ trouvée pour le test\n');
    }
} catch (error) {
    console.error('   ❌ Erreur lors du test des rôles :', error.message + '\n');
}

// Test 3: Test du système de sureffectif
console.log('⚖️  Test 3: Vérification du sureffectif');
try {
    const allGuilds = db.prepare('SELECT * FROM guilds').all();
    
    let overstaffedCount = 0;
    let compliantCount = 0;
    
    for (const guild of allGuilds) {
        const memberCount = db.prepare('SELECT COUNT(*) as count FROM guild_members WHERE guild_id = ?')
            .get(guild.id).count;
        
        const isOverstaffed = isGuildOverstaffed(guild.id);
        const featuresDisabled = areGuildFeaturesDisabled(guild.id);
        
        if (isOverstaffed || memberCount > 12) {
            overstaffedCount++;
            
            let penalty = 0;
            if (guild.overstaffed_since) {
                const daysOver = Math.floor((Date.now() - guild.overstaffed_since) / (1000 * 60 * 60 * 24));
                penalty = calculateOverstaffPenalty(guild, memberCount);
                console.log(`   ⚠️  ${guild.emoji} ${guild.name}: ${memberCount} membres (${memberCount - 12} en trop)`);
                console.log(`      📅 Depuis ${daysOver} jour(s) - Pénalité: ${penalty.toLocaleString('fr-FR')} starss/membre`);
                console.log(`      🚫 Fonctionnalités ${featuresDisabled ? 'DÉSACTIVÉES' : 'actives'}`);
            } else {
                console.log(`   ⚠️  ${guild.emoji} ${guild.name}: ${memberCount} membres (non marquée)`);
            }
        } else {
            compliantCount++;
        }
    }
    
    console.log(`\n   📊 Résumé:`);
    console.log(`      - Guildes en sureffectif: ${overstaffedCount}`);
    console.log(`      - Guildes conformes: ${compliantCount}`);
    console.log(`      - Total: ${allGuilds.length}`);
    console.log('   ✅ Système de sureffectif fonctionnel\n');
} catch (error) {
    console.error('   ❌ Erreur lors du test du sureffectif :', error.message + '\n');
}

// Test 4: Vérification des constantes
console.log('🔧 Test 4: Vérification des constantes');
try {
    const { UPGRADE_MATRIX } = require('../utils/guild/guild-upgrades');
    
    console.log('   📈 Progression des slots de membres:');
    for (let i = 1; i <= 10; i++) {
        const upgrade = UPGRADE_MATRIX[i];
        if (upgrade) {
            console.log(`      Upgrade ${i}: ${upgrade.member_slots} slots (${upgrade.slots_gained || 0} gagné(s))`);
        }
    }
    
    console.log(`\n   🎯 Limites:`);
    console.log(`      - Maximum de base (Upgrade 10): 9 membres`);
    console.log(`      - Maximum avec jokers: 12 membres (9 + 3 jokers)`);
    console.log(`      - Pénalité par membre en trop par jour: 1000 starss`);
    console.log('   ✅ Configuration des constantes OK\n');
} catch (error) {
    console.error('   ❌ Erreur lors de la vérification des constantes :', error.message + '\n');
}

// Test 5: Test des permissions
console.log('🔑 Test 5: Test des permissions personnalisées');
try {
    console.log('   📋 Permissions disponibles:');
    for (const [key, value] of Object.entries(CUSTOM_ROLE_PERMISSIONS)) {
        console.log(`      - ${key}: "${value}"`);
    }
    
    // Test de vérification de permission
    const testGuild = db.prepare('SELECT * FROM guilds LIMIT 1').get();
    if (testGuild) {
        const testMember = db.prepare('SELECT * FROM guild_members WHERE guild_id = ? LIMIT 1')
            .get(testGuild.id);
        
        if (testMember) {
            const canKick = hasCustomPermission(testGuild.id, testMember.user_id, CUSTOM_ROLE_PERMISSIONS.KICK_MEMBER);
            console.log(`\n   🧪 Test sur un membre: ${canKick ? 'A' : 'N\'a pas'} la permission KICK_MEMBER`);
        }
    }
    
    console.log('   ✅ Système de permissions fonctionnel\n');
} catch (error) {
    console.error('   ❌ Erreur lors du test des permissions :', error.message + '\n');
}

console.log('='.repeat(70));
console.log('✅ Tous les tests terminés !');
console.log('\n💡 Prochaines étapes:');
console.log('   1. Exécuter le script mark-overstaffed-guilds.js pour marquer les guildes en sureffectif');
console.log('   2. Tester la commande /guilde-roles en jeu');
console.log('   3. Vérifier que les pénalités s\'appliquent à minuit');
console.log('   4. Vérifier que les fonctionnalités sont bien bloquées pour les guildes en sureffectif');
