# 📖 Documentation — BLZbot V5.3

> Documentation complète du bot Discord BLZbot.  
> Dernière mise à jour : 28/02/2026

---

## Sommaire

| Document | Description |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Architecture globale, structure des dossiers, flux de démarrage, conventions |
| [SYSTEMES.md](SYSTEMES.md) | Documentation détaillée de chaque système (XP, rangs, guildes, puits, marketplace, trophées, etc.) |
| [COMMANDES.md](COMMANDES.md) | Référence exhaustive de toutes les commandes slash |
| [DATABASE.md](DATABASE.md) | Schéma complet de la base de données (tables, colonnes, relations) |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Guide de déploiement, variables d'environnement, workflow de développement |
| [TESTS-PRE-PRODUCTION.md](TESTS-PRE-PRODUCTION.md) | Checklist de tests avant mise en production (MAJ Mars 2026) |

---

## Mise à jour rapide

### MAJ Mars 2026 — Contenu

- 🎰 **Puits de Combat** — Système de tirage aléatoire remplaçant la progression linéaire du pass
- 🏪 **Marketplace P2P** — Achat/vente d'items entre joueurs
- 🏆 **Trophées & Valeur** — Renommage succès → trophées, nouveau système de valeur
- ❌ Suppression : quête de serveur, skip niveau/pallier, ultra quest
- ✨ Nouveautés : inventaire cliquable dans le profil, bouton trophées

### Fichiers créés/modifiés

**Nouveaux fichiers :**
- `utils/puits-system.js`
- `utils/marketplace-system.js`
- `utils/trophy-value-system.js`
- `commands/puits.js`
- `commands/marketplace.js`
- `commands/valeur.js`

**Fichiers modifiés :**
- `database/database.js` — nouvelles tables et colonnes
- `events/messageCreate.js` — gain de PT
- `index.js` — gain de PT vocal, tâches planifiées
- `utils/battle-pass.js` — reset puits
- `utils/quests.js` — attribution trophées
- `utils/db-users.js` — fixedRewardSources mis à jour
- `utils/canvas-battle-pass.js` — nettoyage items supprimés
- `utils/tutorial-handler.js` — nettoyage références supprimées
- `events/interactionCreate.js` — suppression handler server quest
- `commands/profile.js` — bouton inventaire + renommage trophées

**Fichiers supprimés (historique ; aujourd’hui regroupés sous `archive/inutile/`) :**
- `commands/avancement-quete-serveur.js`
- `commands/set-quest-end.js`
