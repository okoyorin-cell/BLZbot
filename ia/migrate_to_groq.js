/**
 * migrate_to_groq.js
 * 
 * Ce script migre tous les utilisateurs dont le modèle préféré est 'gemini' 
 * (ou toute autre variante de Gemini) vers 'groq' dans le fichier user_settings.json.
 */

const fs = require('fs');
const path = require('path');

// Chemins des fichiers
const SETTINGS_PATH = path.join(__dirname, 'user_settings.json');
const BACKUP_PATH = path.join(__dirname, `user_settings_backup_${Date.now()}.json`);

const log = (msg) => {
    const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    console.log(`[${timestamp}] [MIGRATION] ${msg}`);
};

async function migrate() {
    log('🚀 Début de la migration des utilisateurs Gemini vers Groq...');

    // 1. Vérifier si le fichier existe
    if (!fs.existsSync(SETTINGS_PATH)) {
        log('❌ Erreur: Le fichier user_settings.json n\'a pas été trouvé dans ce répertoire.');
        log(`📂 Chemin recherché : ${SETTINGS_PATH}`);
        return;
    }

    // 2. Charger les données
    let userSettings;
    try {
        const data = fs.readFileSync(SETTINGS_PATH, 'utf8');
        userSettings = JSON.parse(data);
        log(`📖 Fichier chargé avec ${Object.keys(userSettings).length} profil(s) utilisateur.`);
    } catch (err) {
        log(`❌ Erreur lors de la lecture ou du parsing du fichier : ${err.message}`);
        return;
    }

    // 3. Créer une sauvegarde par sécurité
    try {
        fs.writeFileSync(BACKUP_PATH, JSON.stringify(userSettings, null, 2));
        log(`📦 Sauvegarde de sécurité créée : ${path.basename(BACKUP_PATH)}`);
    } catch (err) {
        log(`⚠️ Impossible de créer la sauvegarde, arrêt par sécurité : ${err.message}`);
        return;
    }

    // 4. Migration
    let totalUsers = 0;
    let migratedCount = 0;
    let alreadyGroq = 0;
    let otherModels = 0;

    for (const userId in userSettings) {
        totalUsers++;
        const user = userSettings[userId];

        // Normalisation du modèle (lowercase pour la comparaison)
        const currentModel = user.preferredModel ? user.preferredModel.toLowerCase() : null;

        if (!currentModel || currentModel.includes('gemini') || currentModel === 'other') {
            // On migre si c'est Gemini, null, ou 'other'
            user.preferredModel = 'groq';
            migratedCount++;
        } else if (currentModel === 'groq') {
            alreadyGroq++;
        } else {
            // Un autre modèle spécifique (ex: gemma, llama) - on le passe aussi sur groq par précaution
            user.preferredModel = 'groq';
            otherModels++;
        }
    }

    // 5. Sauvegarder les changements
    if (migratedCount > 0 || otherModels > 0) {
        try {
            fs.writeFileSync(SETTINGS_PATH, JSON.stringify(userSettings, null, 2));
            log(`✅ Migration terminée avec succès !`);
            log(`📊 Résumé des opérations :`);
            log(`   - Utilisateurs totaux analysés : ${totalUsers}`);
            log(`   - Utilisateurs migrés vers Groq : ${migratedCount + otherModels}`);
            log(`   - Utilisateurs déjà sur Groq : ${alreadyGroq}`);
            log(`\n💡 Tous les utilisateurs utiliseront désormais Groq par défaut.`);
        } catch (err) {
            log(`❌ Erreur critique lors de la mise à jour du fichier : ${err.message}`);
        }
    } else {
        log('ℹ️ Aucun changement nécessaire : tous les utilisateurs sont déjà sur Groq.');
    }
}

// Exécution du script
migrate().catch(err => {
    console.error('❌ Erreur inattendue lors de la migration:', err);
});
