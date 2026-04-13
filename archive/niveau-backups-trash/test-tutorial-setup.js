/**
 * Script de test pour vérifier que le système de tutoriel est correctement configuré
 * Usage: node src/scripts/test-tutorial-setup.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('\n🔍 Vérification du système de tutoriel...\n');

let errors = 0;
let warnings = 0;

// 1. Vérifier que TUTORIAL_CHANNEL est défini dans .env
console.log('1️⃣  Vérification de TUTORIAL_CHANNEL dans .env...');
if (!process.env.TUTORIAL_CHANNEL) {
    console.error('   ❌ ERREUR: TUTORIAL_CHANNEL n\'est pas défini dans .env');
    console.error('   → Ajoutez: TUTORIAL_CHANNEL=VOTRE_ID_DE_SALON');
    errors++;
} else if (process.env.TUTORIAL_CHANNEL === 'YOUR_TUTORIAL_CHANNEL_ID_HERE') {
    console.warn('   ⚠️  ATTENTION: TUTORIAL_CHANNEL n\'a pas été configuré (valeur par défaut)');
    console.warn('   → Remplacez par l\'ID réel du salon TUTO');
    warnings++;
} else {
    console.log('   ✅ TUTORIAL_CHANNEL défini:', process.env.TUTORIAL_CHANNEL);
}

// 2. Vérifier que les fichiers nécessaires existent
console.log('\n2️⃣  Vérification des fichiers requis...');

const requiredFiles = [
    'src/events/guildMemberAdd.js',
    'src/utils/tutorial-handler.js'
];

const modifiedFiles = [
    'src/events/interactionCreate.js',
    'src/events/messageCreate.js'
];

requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', '..', file);
    if (fs.existsSync(filePath)) {
        console.log(`   ✅ ${file} existe`);
    } else {
        console.error(`   ❌ ERREUR: ${file} introuvable`);
        errors++;
    }
});

modifiedFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', '..', file);
    if (fs.existsSync(filePath)) {
        console.log(`   ✅ ${file} existe (modifié)`);
    } else {
        console.error(`   ❌ ERREUR: ${file} introuvable`);
        errors++;
    }
});

// 3. Vérifier le contenu de guildMemberAdd.js
console.log('\n3️⃣  Vérification du contenu de guildMemberAdd.js...');
try {
    const guildMemberAddPath = path.join(__dirname, '..', 'events', 'guildMemberAdd.js');
    const content = fs.readFileSync(guildMemberAddPath, 'utf8');
    
    if (content.includes('initializeTutorial')) {
        console.log('   ✅ Appel à initializeTutorial présent');
    } else {
        console.error('   ❌ ERREUR: initializeTutorial non trouvé');
        errors++;
    }
    
    if (content.includes('TUTORIAL_CHANNEL')) {
        console.log('   ✅ Référence à TUTORIAL_CHANNEL présente');
    } else {
        console.error('   ❌ ERREUR: TUTORIAL_CHANNEL non référencé');
        errors++;
    }
} catch (error) {
    console.error('   ❌ ERREUR lors de la lecture:', error.message);
    errors++;
}

// 4. Vérifier le contenu de tutorial-handler.js
console.log('\n4️⃣  Vérification du contenu de tutorial-handler.js...');
try {
    const tutorialHandlerPath = path.join(__dirname, '..', 'utils', 'tutorial-handler.js');
    const content = fs.readFileSync(tutorialHandlerPath, 'utf8');
    
    const expectedFunctions = [
        'initializeTutorial',
        'markRulesAccepted',
        'handleTutorialChoice',
        'handleTutorialNext',
        'handleFinalConfirmation',
        'completeTutorial'
    ];
    
    expectedFunctions.forEach(func => {
        if (content.includes(func)) {
            console.log(`   ✅ Fonction ${func} présente`);
        } else {
            console.error(`   ❌ ERREUR: Fonction ${func} non trouvée`);
            errors++;
        }
    });
    
    // Vérifier le nombre de parties du tutoriel
    const partMatches = content.match(/tutorial_part_\d+/g);
    if (partMatches) {
        const uniqueParts = [...new Set(partMatches)];
        console.log(`   ✅ ${uniqueParts.length} parties de tutoriel détectées`);
        if (uniqueParts.length < 14) {
            console.warn(`   ⚠️  Moins de 14 parties trouvées (attendu: 14)`);
            warnings++;
        }
    }
    
    // Vérifier la création de la table tutorial_progress
    if (content.includes('CREATE TABLE IF NOT EXISTS tutorial_progress')) {
        console.log('   ✅ Création de la table tutorial_progress présente');
    } else {
        console.error('   ❌ ERREUR: Création de table tutorial_progress non trouvée');
        errors++;
    }
} catch (error) {
    console.error('   ❌ ERREUR lors de la lecture:', error.message);
    errors++;
}

// 5. Vérifier interactionCreate.js
console.log('\n5️⃣  Vérification des modifications dans interactionCreate.js...');
try {
    const interactionCreatePath = path.join(__dirname, '..', 'events', 'interactionCreate.js');
    const content = fs.readFileSync(interactionCreatePath, 'utf8');
    
    const tutorialButtons = [
        'tutorial_continue',
        'tutorial_skip',
        'tutorial_next_',
        'accept_rules'
    ];
    
    tutorialButtons.forEach(btn => {
        if (content.includes(btn)) {
            console.log(`   ✅ Détection de "${btn}" présente`);
        } else {
            console.error(`   ❌ ERREUR: Détection de "${btn}" non trouvée`);
            errors++;
        }
    });
} catch (error) {
    console.error('   ❌ ERREUR lors de la lecture:', error.message);
    errors++;
}

// 6. Vérifier messageCreate.js
console.log('\n6️⃣  Vérification des modifications dans messageCreate.js...');
try {
    const messageCreatePath = path.join(__dirname, '..', 'events', 'messageCreate.js');
    const content = fs.readFileSync(messageCreatePath, 'utf8');
    
    if (content.includes('handleFinalConfirmation')) {
        console.log('   ✅ Appel à handleFinalConfirmation présent');
    } else {
        console.error('   ❌ ERREUR: handleFinalConfirmation non trouvé');
        errors++;
    }
} catch (error) {
    console.error('   ❌ ERREUR lors de la lecture:', error.message);
    errors++;
}

// 7. Vérifier la documentation
console.log('\n7️⃣  Vérification de la documentation...');
const docFiles = [
    'TUTORIAL_SYSTEM_DOC.md',
    'SETUP_TUTORIEL.md'
];

docFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', '..', file);
    if (fs.existsSync(filePath)) {
        console.log(`   ✅ ${file} existe`);
    } else {
        console.warn(`   ⚠️  ${file} introuvable (documentation)`);
        warnings++;
    }
});

// Résumé
console.log('\n' + '='.repeat(60));
console.log('📊 RÉSUMÉ DE LA VÉRIFICATION');
console.log('='.repeat(60));

if (errors === 0 && warnings === 0) {
    console.log('✅ Tout est parfait ! Le système de tutoriel est prêt.');
    console.log('\n📝 Prochaines étapes:');
    console.log('   1. Configurez TUTORIAL_CHANNEL dans .env avec l\'ID réel');
    console.log('   2. Redémarrez le bot: node src/index.js');
    console.log('   3. Testez avec un compte de test');
    process.exit(0);
} else {
    console.log(`\n⚠️  ${errors} erreur(s) et ${warnings} avertissement(s) détecté(s)`);
    
    if (errors > 0) {
        console.log('\n❌ ERREURS CRITIQUES à corriger:');
        console.log('   - Vérifiez que tous les fichiers ont été créés/modifiés');
        console.log('   - Relisez les logs ci-dessus pour les détails');
        process.exit(1);
    }
    
    if (warnings > 0) {
        console.log('\n⚠️  AVERTISSEMENTS (non bloquants):');
        console.log('   - Configurez TUTORIAL_CHANNEL dans .env');
        console.log('   - Le système fonctionnera une fois configuré');
        process.exit(0);
    }
}
