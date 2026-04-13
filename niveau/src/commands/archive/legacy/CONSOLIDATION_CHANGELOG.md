# Consolidation des Commandes - Changelog

## 📋 Résumé
Les commandes dupliquées ont été consolidées en utilisant le système de sous-commandes Discord.js pour réduire l'encombrement et améliorer l'organisation.

## ✅ Fichiers Consolidés

### 1. **guerre.js** (Nouveau)
Remplace 3 fichiers:
- ❌ `guerre-declarer.js`
- ❌ `guerre-repondre.js`
- ❌ `guerre-statut.js`

**Sous-commandes:**
- `/guerre declarer <guilde>` - Déclarer une guerre
- `/guerre repondre <accepter:boolean>` - Répondre à une invitation de guerre
- `/guerre statut` - Voir le statut de la guerre en cours

---

### 2. **money.js** (Nouveau)
Remplace 3 fichiers:
- ❌ `give-money.js`
- ❌ `remove-money.js`
- ❌ `set-money.js`

**Sous-commandes:**
- `/money give <user> <type> <montant>` - Donner stars/points
- `/money remove <user> <type> <montant>` - Retirer stars/points
- `/money set <user> <type> <montant>` - Définir stars/points

**Note:** Les commandes `/payer` et `/rembourser` restent séparées (non admin).

---

### 3. **xp.js** (Nouveau)
Remplace 3 fichiers:
- ❌ `give-xp.js`
- ❌ `remove-xp.js`
- ❌ `set-level.js`

**Sous-commandes:**
- `/xp give <user> <xp>` - Donner de l'XP
- `/xp remove <user> <xp>` - Retirer de l'XP
- `/xp set-level <user> <niveau>` - Définir le niveau

---

### 4. **admin.js** (Modifié)
Ajout d'une sous-commande:
- ❌ `reset-profil.js` → `/admin reset-profil <user>`

**Nouvelles sous-commandes:**
- `/admin reset-profil <user>` - Réinitialiser complètement un profil utilisateur (avec confirmation)

---

### 5. **guilde-admin.js** (Nouveau)
Remplace 2 fichiers:
- ❌ `inviter-guilde.js`
- ❌ `exclure-guilde.js`

**Sous-commandes:**
- `/guilde-admin inviter <user>` - Inviter un membre dans la guilde
- `/guilde-admin exclure <user>` - Exclure un membre de la guilde

**Features conservées:**
- Cooldown 12h par utilisateur + 3 invitations/heure
- Vérification sureffectif et permissions
- DM avec bouton d'acceptation (30s timeout)
- Admin override pour kicker les owners

---

### 6. **guilde-membre.js** (Nouveau)
Remplace 2 fichiers:
- ❌ `demander-rejoindre-guilde.js`
- ❌ `quitter-guilde.js`

**Sous-commandes:**
- `/guilde-membre demander-rejoindre <nom>` - Demander à rejoindre une guilde
- `/guilde-membre quitter` - Quitter sa guilde

**Features conservées:**
- Autocomplete pour le nom de guilde
- Vérification capacité de guilde
- Message dans salon guildes avec boutons accepter/refuser
- Collector 24h pour les réponses
- Progression quêtes (rejoindre, prestige, etc.)

---

## 🗂️ Fichiers Non Consolidés (Conservés)

Ces fichiers restent séparés car ils ont des fonctionnalités distinctes et complexes:

- **guilde.js** - Acheter places, changer nom (2 sous-commandes déjà existantes)
- **guilde-roles.js** - Gestion complète des rôles personnalisés (6 sous-commandes)
- **guilde-tools.js** - Boutique de boosters (ComponentsV2, UI complexe)
- **guilde-upgrade.js** - Système d'amélioration de guilde
- **guilde-dissoudre.js** - Dissolution de guilde avec confirmation

---

## 📊 Statistiques

**Avant:** ~40 fichiers de commandes
**Après:** ~25 fichiers de commandes

**Réduction:** ~37% de fichiers en moins

---

## 🔄 Migration

Aucune migration nécessaire. Les nouvelles commandes avec sous-commandes apparaîtront automatiquement après redémarrage du bot. Les anciennes commandes seront retirées automatiquement.

**Commandes à mettre à jour dans la documentation:**
- `guerre-*` → `guerre <subcommand>`
- `give-money`, `remove-money`, `set-money` → `money <subcommand>`
- `give-xp`, `remove-xp`, `set-level` → `xp <subcommand>`
- `reset-profil` → `admin reset-profil`
- `inviter-guilde`, `exclure-guilde` → `guilde-admin <subcommand>`
- `demander-rejoindre-guilde`, `quitterguilde` → `guilde-membre <subcommand>`

---

## ⚠️ Notes Importantes

1. **Tous les anciens fichiers sont sauvegardés** dans `OLD-BACKUP-consolidated/`
2. **Toutes les fonctionnalités originales sont préservées** (cooldowns, permissions, collectors, etc.)
3. **Les dépendances sont inchangées** - mêmes imports et utilitaires
4. **Format cohérent** - Tous les nouveaux fichiers suivent le même pattern de structure

---

## 🛠️ Structure des Nouveaux Fichiers

Tous les fichiers consolidés suivent cette structure:

```javascript
module.exports = {
    data: new SlashCommandBuilder()
        .setName('commande')
        .setDescription('Description')
        .addSubcommand(...)
        .addSubcommand(...),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'subcommand1') {
            await handleSubcommand1(interaction);
        } else if (subcommand === 'subcommand2') {
            await handleSubcommand2(interaction);
        }
    },
    
    // Autocomplete si nécessaire
    async autocomplete(interaction) { ... }
};

// Fonctions helper séparées
async function handleSubcommand1(interaction) { ... }
async function handleSubcommand2(interaction) { ... }
```

---

Date de consolidation: $(date +%Y-%m-%d)
Version: 1.0
