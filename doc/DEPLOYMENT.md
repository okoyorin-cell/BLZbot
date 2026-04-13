# 🚀 Déploiement & Workflow — BLZbot V5.3

> Guide de déploiement, variables d'environnement, et workflow de développement.  
> Dernière mise à jour : 28/02/2026

---

## Variables d'environnement

Le fichier `.env` doit se trouver à la **racine du dépôt** (parent du dossier `orchestrator/`).

### Obligatoires

| Variable | Description | Exemple |
|---|---|---|
| `BOT_TOKEN` | Token du bot Discord | `MTE5...` |
| `CLIENT_ID` | Application ID Discord | `1154...` |
| `GUILD_ID` | ID du serveur Discord | `1124...` |
| `WEBHOOK_URL`| Webhook URL (CheckToken) | `https://discord.com/api/webhooks/...` |

### Canaux (IDs Discord)

| Variable | Description |
|---|---|
| `GUILD_CHANNEL` | Canal des notifications de guilde |
| `GUILD_CATEGORY` | Catégorie pour les canaux privés de guilde |
| `LEVEL_UP_CHANNEL` | Canal des annonces de level up |
| `RANK_UP_CHANNEL` | Canal des annonces de rank up |
| `QUEST_CHANNEL` | Canal des complétion de quêtes |
| `BATTLE_PASS_CHANNEL` | Canal des annonces battle pass |
| `STREAK_CHANNEL` | Canal des annonces streak |
| `COUNTING_CHANNEL` | Canal du jeu de comptage |
| `TUTORIAL_CHANNEL` | Canal des tutoriels nouveaux membres |
| `HACKER_CHANNEL` | Canal secret hacker |

### Rôles

| Variable | Description |
|---|---|
| `REGLEMENT_ROLE` | ID du rôle donné quand les règles sont acceptées |

### Optionnelles

| Variable | Description | Défaut |
|---|---|---|
| `LOG_LEVEL` | Niveau de logging : `NONE`, `ERROR`, `WARN`, `INFO`, `DEBUG` | `INFO` |

---

## Démarrage

### Prérequis

- **Node.js** ≥ 18
- **npm** ou **pnpm**
- **build-essential** (pour `better-sqlite3` et `canvas` natifs)
- **Fonts système** (pour le canvas : polices custom dans assets/)

### Installation

```bash
cd <racine-du-depot>
npm install
```

> ⚠️ `better-sqlite3` et `canvas` sont des modules natifs — ils nécessitent un compilateur C++ (`build-essential` sur Linux, Xcode CLI tools sur macOS).

### Lancement

```bash
# Orchestrateur (lance modération, niveau, IA, workers, etc.)
npm start
# équivalent : node orchestrator/maintemp.js

# Module niveau seul (.env à la racine du dépôt)
node niveau/src/index.js

# Ancien mini-bot points (legacy)
npm run points-bot
```

L'orchestrateur (`orchestrator/maintemp.js`) va :
1. Lancer les scripts utiles listés (modération, niveau, IA, etc) et les auto-restart en cas de crash.

Le script `index.js` principal va :
1. Charger les variables d'environnement
2. Initialiser la base de données (exécuter toutes les migrations)
3. Charger les commandes et événements
4. Se connecter à Discord
5. Déployer les commandes slash (smart deploy — ne redéploie que si changements)
6. Démarrer toutes les tâches planifiées

---

## Déploiement des commandes

### Fonctionnement automatique

Les commandes sont déployées automatiquement au démarrage via `utils/deploy-commands.js`.

Le système :
1. Scanne `commands/*.js` (+ sous-dossiers événementiels si actifs)
2. Compare avec les commandes enregistrées sur Discord
3. **Crée** les nouvelles commandes
4. **Met à jour** les commandes modifiées
5. **Supprime** les commandes qui n'existent plus localement
6. **Ignore** les commandes inchangées

### Forcer un redéploiement

En temps normal, le déploiement est automatique. Si nécessaire :

```bash
# Supprimer toutes les commandes puis redéployer
# (utile si des commandes fantômes persistent)
node -e "
const { REST, Routes } = require('discord.js');
const rest = new REST().setToken(process.env.DISCORD_TOKEN);
rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: [] });
"
# Puis relancer le bot
node index.js
```

---

## Migrations de base de données

### Fonctionnement

Les migrations sont **embarquées** dans `database/database.js` dans la fonction `initializeDatabase()`.

Chaque migration :
1. Utilise `ALTER TABLE ... ADD COLUMN` avec un `try/catch` (silent fail si la colonne existe déjà)
2. Ou `CREATE TABLE IF NOT EXISTS` (idempotent)
3. Est exécutée à chaque démarrage du bot

### Ajouter une migration

Pour ajouter une nouvelle migration :

```javascript
// Dans database/database.js, à la fin de initializeDatabase()

// === [NOM-MAJ] Nouvelles tables/colonnes ===
try {
    db.exec(`ALTER TABLE users ADD COLUMN ma_colonne INTEGER DEFAULT 0`);
    logger.info('[NOM-MAJ] Colonne ma_colonne ajoutée.');
} catch (e) {
    // Colonne existe déjà — ignorer
}
```

### Pas de système de versioning

> ⚠️ Il n'y a **pas** de système de migration numérotée (comme Knex, Prisma, etc.). Les migrations sont simplement des blocs de code `try/catch` dans `initializeDatabase()`. L'idempotence est garantie par les `IF NOT EXISTS` et les `try/catch`.

---

## Structure d'un fichier commande

```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ma-commande')
        .setDescription('Description de la commande.')
        .addStringOption(option =>
            option.setName('param')
                .setDescription('Un paramètre')
                .setRequired(true)),

    async execute(interaction) {
        // Logique de la commande
        await interaction.reply('Réponse');
    },

    // Optionnel : pour l'autocomplete
    async autocomplete(interaction) {
        // ...
    }
};
```

---

## Structure d'un fichier événement

```javascript
module.exports = {
    name: 'messageCreate',  // Nom de l'événement Discord
    once: false,             // true = s'exécute une seule fois

    async execute(message, client) {
        // Logique de l'événement
    }
};
```

---

## Mode maintenance

Le mode maintenance empêche l'exécution de toutes les commandes slash.

```
/maintenance    → Active/désactive le mode
```

Le statut est stocké dans `maintenance.json` (créé automatiquement).

---

## Workflow de développement

### Ajout d'une fonctionnalité

```
1. Créer le module utilitaire dans utils/
2. Créer la commande dans commands/
3. Ajouter les migrations DB dans database/database.js
4. Intégrer dans les événements (messageCreate, index.js, etc.)
5. Tester localement
6. Relancer le bot (les commandes se déploient automatiquement)
```

### Ajout d'un item

1. Ajouter la définition dans `utils/items.js` → objet `ITEMS`
2. Si l'item a un effet actif, ajouter la logique dans `utils/item-effects.js`
3. Si l'item est passif, l'ajouter à `PASSIVE_ITEMS`
4. Si l'item ne doit pas être vendable, l'ajouter à `NON_SELLABLE_ITEMS` dans `marketplace-system.js`

### Ajout d'une quête

1. Ajouter la quête dans `utils/quests.js` → objet `QUESTS`
2. Définir : `name`, `description`, `type`, `goal`, `rarity`, `reward`
3. La progression est vérifiée automatiquement via `checkQuestProgress()`
4. Le trophée est attribué automatiquement à la complétion

### Ajout d'un événement saisonnier

1. Créer le dossier `commands/[événement]/`
2. Créer la DB séparée `database/db-[événement].js`
3. Créer le canvas `utils/canvas-[événement]-profile.js`
4. Ajouter le toggle dans `utils/command-manager.js`
5. Ajouter les gains dans `events/messageCreate.js` et `index.js` (vocal)
6. Ajouter le chargement conditionnel dans `index.js`

---

## Arborescence des logs

Le logger (`utils/logger.js`) supporte 4 niveaux :

| Niveau | Variable `LOG_LEVEL` | Contenu |
|---|---|---|
| NONE | `NONE` | Aucun log |
| ERROR | `ERROR` | Erreurs uniquement |
| WARN | `WARN` | Erreurs + avertissements |
| INFO | `INFO` | Tout sauf debug (défaut) |
| DEBUG | `DEBUG` | Tout |

Les logs sont affichés dans la console (stdout). Il n'y a pas de système de fichier log.

---

## Backups

### Base de données

Les fichiers `.sqlite` sont la seule source de vérité. Il est recommandé de les sauvegarder régulièrement :

```bash
# Backup simple
cp niveau/src/database/blzbot.sqlite backup/blzbot-$(date +%Y%m%d).sqlite

# Avec les bases secondaires
cp niveau/src/database/*.sqlite backup/
```

### Code

Le code est versionné dans le dossier du projet. Les fichiers dépréciés et backups non utilisés sont regroupés sous `archive/` (`archive/inutile`, `archive/niveau-backups-trash`).

---

## Checklist pré-production

Voir [TESTS-PRE-PRODUCTION.md](TESTS-PRE-PRODUCTION.md) pour la checklist complète de tests.
