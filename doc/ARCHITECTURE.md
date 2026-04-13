# 🏗️ Architecture — BLZbot V5.3

> Documentation de l'architecture globale du bot Discord BLZbot.  
> Dernière mise à jour : 28/02/2026

---

## Vue d'ensemble

BLZbot est un bot Discord communautaire multi-fonctionnel construit avec **Discord.js v14** et **better-sqlite3**. Il gère un système complet de progression (niveaux, rangs, économie), des guildes, un battle pass, un marketplace P2P, des mini-jeux, et des événements saisonniers.

---

## Stack technique

| Composant | Technologie | Version |
|---|---|---|
| Framework Discord | discord.js | ^14.25.1 |
| Base de données | better-sqlite3 | ^12.6.2 |
| Rendu graphique | node-canvas | ^3.2.1 |
| Planification | node-schedule | ^2.1.1 |
| IA | groq-sdk + @google/generative-ai | — |
| Audio | @discordjs/voice + gtts + ffmpeg | — |
| HTTP | axios | ^1.13.2 |
| Env | dotenv | ^17.2.3 |
| Runtime | Node.js | 18+ |

---

## Structure des dossiers

```
BLZbot-main/                       ← Racine du dépôt (.env ici)
├── orchestrator/                  ← Orchestrateur multi-processus
│   ├── maintemp.js                ← npm start — fork des workers
│   └── derank-urgence.js          ← Logique /derank-urgence
├── workers/                       ← Processus lancés par maintemp
│   ├── Bug.js
│   ├── CheckToken.js
│   └── linkScanner.js
├── legacy/points-bot/             ← Ancien mini-bot points (optionnel)
├── scripts/dev/                   ← Scripts dev (ex. test-rate-limit.js)
├── sql/                           ← Schémas SQL divers (ex. create_table.sql)
├── niveau/src/                    ← 🎯 Bot principal (niveaux, économie, guildes)
│   ├── index.js                   ← Point d'entrée
│   ├── bootstrap/client-ready.js  ← Tâches au ready (timers, vocal, etc.)
│   ├── config.js                  ← Config (événements saisonniers)
│   │
│   ├── commands/                  ← Commandes slash Discord
│   │   ├── core/                  ← Profil, économie, shop, giveaway…
│   │   ├── guilde/                ← Guildes, guerre, trésorerie…
│   │   ├── admin/                 ← Admin & maintenance
│   │   ├── misc/                  ← Mini-jeux, échange…
│   │   ├── archive/legacy/        ← Anciennes commandes (non chargées)
│   │   ├── halloween/             ← Événement Halloween
│   │   ├── noël/                  ← Événement Noël
│   │   ├── saint-valentin/        ← Saint-Valentin
│   │   └── giveaway/              ← Handlers giveaway (ui, steps…)
│   │
│   ├── events/                    ← Handlers d'événements Discord
│   │   ├── guildMemberAdd.js      ← Arrivée d'un membre (tutoriel)
│   │   ├── guildMemberUpdate.js   ← Mise à jour d'un membre (booster)
│   │   ├── interactionCreate.js   ← Routage interactions (commandes, boutons)
│   │   ├── messageCreate.js       ← Messages (XP, RP, comptage, events)
│   │   ├── messageReactionAdd.js  ← Réactions (XP bonus, jeux)
│   │   └── voiceStateUpdate.js    ← Vocal (tracking rejoindre/quitter)
│   │
│   ├── utils/                     ← Modules utilitaires
│   │   ├── guild/                 ← Logique guildes (wars, upgrades, trésorerie, rôles…)
│   │   ├── db-users.js            ← CRUD utilisateurs, inventaire, ressources
│   │   ├── db-guilds.js           ← CRUD guildes, membres
│   │   ├── db-quests.js           ← CRUD progression quêtes
│   │   ├── items.js               ← Catalogue d'items (ITEMS, SHOP_CONFIG)
│   │   ├── item-effects.js        ← Logique d'utilisation des items
│   │   ├── ranks.js               ← Système de rangs (Plastique→GOAT)
│   │   ├── quests.js              ← Définition et vérification des quêtes
│   │   ├── puits-system.js        ← Puits de Combat
│   │   ├── marketplace-system.js  ← Marketplace P2P
│   │   ├── trophy-value-system.js ← Trophées & Valeur
│   │   ├── shop-system.js         ← Boutique quotidienne
│   │   ├── decay-system.js        ← Decay des points (rangs élevés)
│   │   ├── counting-system.js     ← Jeu de comptage
│   │   ├── streak-system.js       ← Système de streaks daily
│   │   ├── canvas-*.js            ← Rendus canvas (profils, battle pass, etc.)
│   │   ├── deploy-commands.js     ← Déploiement des commandes slash
│   │   ├── logger.js              ← Système de logging
│   │   └── error-handler.js       ← Gestion d'erreurs globale
│   │
│   ├── database/                  ← Bases de données SQLite
│   │   ├── database.js            ← Init + migrations DB principale
│   │   ├── blzbot.sqlite          ← 🗄️ Base principale (non versionné)
│   │   ├── Haloween.sqlite        ← Base Halloween
│   │   ├── Noël.sqlite            ← Base Noël
│   │   ├── Valentin.sqlite        ← Base Saint-Valentin
│   │   ├── badges.sqlite          ← Base badges
│   │   ├── giveaway.sqlite        ← Base giveaways
│   │   ├── db-halloween.js        ← Accès DB Halloween
│   │   ├── db-noel.js             ← Accès DB Noël
│   │   ├── db-valentin.js         ← Accès DB Valentine
│   │   └── db-badges.js           ← Accès DB badges
│   │
│   ├── config/                    ← Fichiers de configuration
│   │   └── role.config.json       ← Mapping rôles (rangs, niveaux, events, top)
│   │
│   ├── assets/                    ← Images et ressources statiques
│   │   └── rank-icons/            ← Icônes de rangs (profil / carte)
│   └── scripts/                   ← Scripts utilitaires
│
├── modération/                    ← Bot de modération (séparé)
├── ia/                            ← Module IA (Groq/Gemini)
├── archive/                       ← Hors runtime : scripts dépréciés, vieux backups
│   ├── inutile/                   ← Ancien dossier « inutile » regroupé ici
│   └── niveau-backups-trash/      ← Anciens scripts / backups niveau
├── doc/                           ← 📖 Documentation (vous êtes ici)
└── utils/                         ← Utilitaires partagés (error-handler)
```

---

## Flux de démarrage (`index.js`)

```
1. Chargement de l'orchestrateur `orchestrator/maintemp.js`
   ├── Lancement de workers/CheckToken.js, modération, niveau/src/index.js, workers/linkScanner.js, ia/index.js, workers/Bug.js
   └── Suivi des crashs (auto-restart)
        │
2. Dans `niveau/src/index.js` (module principal)
   ├── Chargement dotenv, logger, modules Node.js
   └── Création du Client Discord (intents: Guilds, Members, Messages,
       MessageContent, VoiceStates, Reactions)
        │
3. Chargement des commandes
   ├── Commandes principales (commands/core, guilde, admin, misc)
   ├── Commandes Halloween (si événement actif)
   ├── Commandes Noël (si événement actif)
   └── Commandes Saint-Valentin (si événement actif)
        │
4. Chargement des event handlers (events/*.js)
        │
5. Initialisation du système ranked (shares)
        │
6. client.login(TOKEN)
        │
7. Event "ready" → Tâches planifiées :
   ├── Vérification prêts en retard (toutes les 1h)
   ├── Sync rôles booster
   ├── Vérification canaux de guilde
   ├── Init système de comptage
   ├── Revenus trésorerie (minuit Paris, puis /24h)
   ├── Reset Battle Pass (1er samedi du mois, 13h)
   ├── Reset Streaks (planifié)
   ├── Cleanup Marketplace (toutes les 1h)
   ├── Recalcul Valeurs (toutes les 2h + au démarrage)
   ├── Mise à jour TOP rôles (toutes les 1h)
   ├── Sync Halloween (si actif)
   ├── Vérification AFK vocal (Ranked V2)
   ├── Récompenses vocales (toutes les 60s)
   ├── Vérification decay (toutes les 1h)
   ├── Expiration giveaways (toutes les 30s)
   ├── Fin guerres de guildes (toutes les 60s)
   ├── Vérification sureffectif guildes (toutes les 1h)
   ├── Sync usernames (toutes les 1h)
   └── Événement Saint-Valentin périodique (toutes les 5min)
        │
8. Déploiement des commandes slash via deploy-commands.js
```

---

## Flux des événements Discord

### Message envoyé (`messageCreate.js`)

```
Message reçu
    │
    ├── Bot ? → Ignorer
    ├── Mode maintenance ? → Ignorer
    │
    ├── Cooldown anti-spam (2s entre récompenses)
    │
    ├── Créer/récupérer l'utilisateur en DB
    │
    ├── Accorder ressources :
    │   ├── XP (base + multiplicateurs)
    │   ├── RP (base + multiplicateurs)
    │   ├── Starss (base + multiplicateurs)
    │   └── PT (Points de Tirage) +10
    │
    ├── Vérifier level up → Rôle de niveau
    │
    ├── Vérifier rank up → Rôle de rang + notification
    │
    ├── Vérifier progression des quêtes
    │
    ├── Événements saisonniers :
    │   ├── Halloween : +bonbons, +citrouilles (chance)
    │   ├── Noël : +rubans
    │   └── Saint-Valentin : +cœurs
    │
    ├── Canal de comptage → Logique de comptage
    │
    ├── Guerre de guilde → Tracking messages
    │
    └── Tutoriel → Progression
```

### Interaction reçue (`interactionCreate.js`)

```
Interaction reçue
    │
    ├── Autocomplete → Déléguer au handler
    │
    ├── Slash Command → Vérifier maintenance → Exécuter
    │
    └── Button/Modal → Router selon customId :
        ├── shop_buy_* → Achat boutique
        ├── use_item_* → Utilisation item
        ├── battlepass_claim_* → Claim battle pass
        ├── accept_trade_* / decline_trade_* → Échange
        ├── accept_war_* / decline_war_* → Guerre
        ├── hacker_daily_item → Item hacker
        ├── tutorial_* → Tutoriel
        ├── giveaway_* → Giveaway
        └── ... (et autres)
```

### Vocal (`voiceStateUpdate.js` + `index.js`)

```
Membre rejoint/quitte un salon vocal
    │
    ├── Rejoint → Ajout au Set voiceUsers
    │
    └── Quitte → Retrait du Set voiceUsers

Toutes les 60 secondes (index.js) :
    │
    Pour chaque utilisateur dans voiceUsers :
    ├── Vérifier qu'il est toujours en vocal (pas seul, pas mute+deaf)
    ├── Vérifier les soft/hard caps journaliers
    ├── Accorder : XP (30/min), RP (10/min), PT (20/min)
    ├── Événements : bonbons, rubans, cœurs
    └── Guerre de guilde : +1 minute vocale
```

---

## Bases de données

Le bot utilise **6 fichiers SQLite** séparés :

| Fichier | Contenu | Module d'accès |
|---|---|---|
| `blzbot.sqlite` | Base principale (users, guilds, items, quests, marketplace, etc.) | `database/database.js` |
| `Haloween.sqlite` | Données événement Halloween | `database/db-halloween.js` |
| `Noël.sqlite` | Données événement Noël | `database/db-noel.js` |
| `Valentin.sqlite` | Données événement Valentine | `database/db-valentin.js` |
| `badges.sqlite` | Badges utilisateurs | `database/db-badges.js` |
| `giveaway.sqlite` | Giveaways | `utils/db-giveaway.js` |

Voir [DATABASE.md](DATABASE.md) pour le schéma complet.

---

## Conventions de code

- **Commandes** : 1 fichier par commande, exporte `{ data: SlashCommandBuilder, execute: async function }`
- **Events** : 1 fichier par événement Discord, exporte `{ name, once?, execute }`
- **Utilitaires** : Fonctions exportées via `module.exports`
- **Nommage fichiers** : kebab-case (`puits-system.js`, `canvas-battle-pass.js`)
- **Nommage variables** : camelCase
- **Nommage DB** : snake_case (`user_id`, `total_value`)
- **Pas de TypeScript** — tout est en CommonJS (`require()` / `module.exports`)
- **UI** : Discord ComponentsV2 (ContainerBuilder, TextDisplayBuilder, etc.) pour les nouvelles commandes
