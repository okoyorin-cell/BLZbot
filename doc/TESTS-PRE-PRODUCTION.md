# 🧪 Tests Pré-Production — MAJ Mars 2026 (V5.3)

> **Date de rédaction :** 28/02/2026  
> **Version :** BLZbot V5.3  
> **Contenu :** Rework Pass (Puits), Marketplace, Trophées & Valeur, Changements divers

---

## 📋 Comment utiliser cette checklist

- [ ] = Non testé
- [x] = Testé et validé
- ❌ = Testé et échoué (noter le problème)
- ⚠️ = Testé avec réserves

**Testeur :**  
**Date du test :**  
**Environnement :** Serveur de test / Production  

---

## 0. Pré-requis

- [x] Le bot démarre sans erreur (`node index.js`)
- [x] La migration DB s'exécute sans erreur (vérifier les logs `[MAJ-MARS]`)
- [x] Les nouvelles tables existent : `puits_tirages`, `marketplace_listings`, `user_trophies`
- [x] Les nouvelles colonnes existent sur `users` : `tirage_points`, `total_tirages`, `total_value`
- [x] La colonne `total_value` existe sur `guilds`
- [X] Les 3 nouvelles commandes sont déployées : `/puits`, `/marketplace`, `/valeur`
- [x] Les 2 commandes supprimées ne sont plus visibles : `/avancement-quete-serveur`, `/set-quest-end`
- [❌] Aucune erreur dans la console au démarrage
erreur rencontrée : 
[ERROR] Erreur lors de la migration de la base de données giveaway: SqliteError: no such table: giveaways
    at Database.exec (/home/richard/projets/V5.3/node_modules/better-sqlite3/lib/methods/wrappers.js:9:14)
    at Object.<anonymous> (/home/richard/projets/V5.3/niveau/src/utils/db-giveaway.js:16:12)
    at Module._compile (node:internal/modules/cjs/loader:1761:14)
    at Object..js (node:internal/modules/cjs/loader:1893:10)
    at Module.load (node:internal/modules/cjs/loader:1481:32)
    at Module._load (node:internal/modules/cjs/loader:1300:12)
    at TracingChannel.traceSync (node:diagnostics_channel:328:14)
    at wrapModuleLoad (node:internal/modules/cjs/loader:245:24)
    at Module.require (node:internal/modules/cjs/loader:1504:12)
    at require (node:internal/modules/helpers:152:16) {
  code: 'SQLITE_ERROR'
}

---

## 1. 🎰 Système de Puits (`/puits`)

### 1.1 Gain de Points de Tirage (PT)

- [x] Envoyer un message donne +10 PT
- [x] Rester 1 minute en vocal donne +20 PT
- [x] Vérifier que les PT apparaissent bien sur `/puits afficher`
- [x] Vérifier que les PT se cumulent correctement

### 1.2 Affichage (`/puits afficher`)

- [x] L'embed affiche le nombre de PT correctement
- [x] La barre de progression est visible
- [x] Le coût du prochain tirage est affiché
- [⚠️] Le nombre de tirages effectués / max est affiché
- [⚠️] Les boutons "Tirer x1", "Tirer x5", "Tirer Max" apparaissent
- [x] Les boutons sont désactivés si pas assez de PT
- [x] Distinction Free vs VIP (vérifier avec un compte VIP)

### 1.3 Tirages (`/puits tirer`)

- [⚠️] `/puits tirer nombre:1` — effectue 1 tirage, déduit le bon coût
- [ ] `/puits tirer nombre:5` — effectue 5 tirages a envlever 
- [⚠️] Vérifier la progression des coûts :
  - [⚠️] Tirages 1-5 : 500 PT chacun (Free) / 300 PT (VIP)
  - [⚠️] Tirages 6-10 : 1 000 PT chacun (Free) / 600 PT (VIP)
  - [⚠️] Tirages 11-25 : 2 000 PT chacun (Free) / 1 200 PT (VIP)
  - [⚠️] Tirages 26-50 : 4 000 PT chacun (Free) / 2 400 PT (VIP)
  - [⚠️] Tirages 51-70 (VIP uniquement) : 3 500 PT chacun
- [⚠️] Limite de 50 tirages atteinte → message d'erreur (Free)
- [⚠️] Limite de 70 tirages atteinte → message d'erreur (VIP)
- [x] Tentative de tirer sans assez de PT → message d'erreur
- [⚠️] Les récompenses s'affichent correctement (emoji + nom + quantité)
- [⚠️] Les récompenses sont bien ajoutées à l'inventaire / au profil

### 1.4 Récompenses de tirage

Vérifier que chaque type de récompense fonctionne :

- [ ⚠️] `starss` (30k / 50k) — les Starss sont bien crédités
- [ ⚠️] `coffre_normal` — le coffre est ajouté à l'inventaire
- [ ⚠️] `coffre_mega` — idem
- [ ⚠️] `coffre_legendaire` — idem
- [ ⚠️] `double_daily` — idem
- [⚠️ ] `reset_boutique` — idem
- [⚠️ ] `joker_guilde` — idem
- [ ⚠️] `streak_keeper` — idem
- [⚠️ ] `mega_boost` — idem
- [⚠️ ] `remboursement` — idem
- [⚠️ ] `xp_boost` / `points_boost` — idem
- [⚠️ ] `role_exclusif` — le rôle est bien attribué
- [⚠️ ] Récompenses VIP bonus (100k starss, mega coffre, etc.)

### 1.5 Boutons d'action rapide

- [⚠️] Bouton "Tirer x1" fonctionne
- [⚠️] Bouton "Tirer x5" fonctionne
- [⚠️] Bouton "Tirer Max" tire le maximum possible
- [⚠️] Les boutons se mettent à jour après chaque action

### 1.6 Historique (`/puits historique`)

- [⚠️] Affiche les derniers tirages avec pagination
- [⚠️] Chaque entrée montre : numéro, récompense, date
- [⚠️] La pagination avant/arrière fonctionne

### 1.7 Reset mensuel
- [⚠️] Vérifier que `resetAllPuits()` est appelé lors du reset du battle pass
- [⚠️ ] Après reset : `tirage_points` = 0, `total_tirages` = 0
- [⚠️ ] L'historique des tirages est conservé (ou vidé selon le choix)

---
⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️v: battle pass a supprimer 
## 2. 🏪 Marketplace (`/marketplace`)

### 2.1 Conditions d'accès

- [x] Utilisateur niveau < 25 → message d'erreur
- [⚠️] Utilisateur niveau ≥ 25 → accès autorisé

### 2.2 Mise en vente (`/marketplace vendre`)

- [x] Vendre un item de l'inventaire → l'item est retiré (escrow)
- [x] Le prix minimum (1 000 Starss) est respecté
- [x] Le prix maximum (50 000 000 Starss) est respecté
- [⚠️] Limite de 5 annonces actives respectée → message d'erreur à la 6ème
- [x] Item non-vendable (couscous, bague_mariage, etc.) → message d'erreur
- [x] Vendre un item qu'on ne possède pas → message d'erreur
- [x] L'annonce apparaît dans la liste

### 2.3 Parcourir (`/marketplace parcourir`)

- [x] Liste les annonces actives avec pagination
- [x] Chaque annonce affiche : vendeur, item, quantité, prix, date d'expiration ⚠️⚠️(au leiu d'une étoile, mettre starss)
- [⚠️] Les annonces expirées n'apparaissent pas

### 2.4 Achat (`/marketplace acheter`)

- [⚠️] Acheter une annonce avec assez de Starss → transaction réussie
- [⚠️] Les Starss sont déduits de l'acheteur
- [⚠️] Les Starss sont crédités au vendeur
- [⚠️] L'item est ajouté à l'inventaire de l'acheteur
- [⚠️] L'annonce passe en statut "sold"
- [⚠️] Acheter sans assez de Starss → message d'erreur
- [⚠️] Acheter sa propre annonce → message d'erreur ⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️prevenir d'utiliser marketplace annuler
- [⚠️] Acheter une annonce expirée/annulée → message d'erreur

### 2.5 Annulation (`/marketplace annuler`)

- [x] Annuler sa propre annonce → item retourné dans l'inventaire
- [⚠️] Annuler l'annonce d'un autre → message d'erreur

### 2.6 Mes annonces (`/marketplace mes-annonces`)

- [x] Affiche uniquement les annonces du joueur
- [] Inclut les statuts : active, sold, cancelled, expired

### 2.7 Recherche (`/marketplace rechercher`)

- [x] Recherche par nom d'item fonctionne
- [x] L'autocomplete propose des items existants

### 2.8 Expiration automatique

- [⚠️] Vérifier que `cleanupExpiredListings()` tourne toutes les heures
- [⚠️] Les annonces de +7 jours passent en "expired"
- [ ⚠️] Les items des annonces expirées sont retournés au vendeur

---

## 3. 🏆 Trophées & Valeur (`/valeur`)

### 3.1 Attribution des trophées
⚠️⚠️⚠⚠️⚠️️ classement pas bien⚠️⚠️⚠️⚠️⚠️
- [x] Compléter une quête Commune → trophée Commune attribué
- [ ⚠️] Compléter une quête Rare → trophée Rare attribué
- [ ⚠️] Compléter une quête Épique → trophée Épique attribué
- [ ⚠️] Compléter une quête Légendaire → trophée Légendaire attribué
- [⚠️ ] Compléter une quête Mythique → trophée Mythique attribué
- [⚠️ ] Compléter une quête Goatesque → trophée Goatesque attribué
- [⚠️ ] Compléter une quête Halloween → trophée Halloween attribué
- [⚠️ ] Un même trophée ne peut pas être obtenu deux fois

### 3.2 Calcul de la valeur

- [ ] Vérifier la formule RP :
  - [ ] RP ≤ 100 000 → valeur par RP = 3
  - [ ] RP > 100 000 → valeur par RP = 10 
- [x] XP total contribue 1 valeur par XP
- [x] Points de comptage (PC) contribuent 1 valeur par PC
- [x] Chaque trophée contribue selon sa rareté :
  - [x] Commune = 300, Rare = 1 000, Épique = 2 500
  - [x] Légendaire = 5 000, Mythique = 10 000, Goatesque = 25 000, Halloween = 15 000

### 3.3 Affichage (`/valeur profil`)

- [x] Affiche la valeur totale de l'utilisateur
- [x] Le détail (breakdown) est visible : RP, XP, PC, Trophées
- [x] On peut consulter le profil d'un autre membre

### 3.4 Classement (`/valeur classement`)

- [x] Affiche le TOP des joueurs par valeur

### 3.5 Guildes (`/valeur guildes`)

- [❌] Affiche le classement des guildes par valeur totale // pas faire de classement + mzttre l'info dans profil guilde
- [❌] La valeur d'une guilde = somme des valeurs de ses membres // pas correct

### 3.6 Recalcul automatique

- [⚠️] Le recalcul se lance toutes les 2 heures
- [x] Le recalcul initial s'exécute 10s après le ready
- [⚠️] `recalculateAllValues()` met à jour `users.total_value` et `guilds.total_value`

### 3.7 Condition d'upgrade guilde basée sur la valeur

- [ ] L'upgrade de guilde vérifie : `required_level × 300 = valeur requise` au lieu de faire ce calcul chiant, met en dur le sueils de valeur qu'il faut, on a plus besoin des levels de guilde vu que ce n'est plus utilisé

- [⚠️] Si la valeur de la guilde est insuffisante → message d'erreur

---

## 4. 📝 Changements Supplémentaires

### 4.1 Suppression Quête de Serveur

- [x] La commande `/avancement-quete-serveur` n'existe plus
- [x] La commande `/set-quest-end` n'existe plus
- [x] Les boutons `vote_reward_*` ne sont plus gérés dans interactionCreate
- [x] Aucune erreur liée aux server_quests dans les logs

### 4.2 Suppression Skip/Ultra Quest

- [⚠️] `skip_niveau`, `skip_pallier`, `ultra_quest` n'apparaissent plus dans :
  - [⚠️] Canvas du battle pass suppresion du battle pass
  - [⚠️] Tutoriel (toutes les parties) suppression totale du battlepass
  - [⚠️] `fixedRewardSources` dans db-users.js
- [⚠️] Aucune référence résiduelle dans le codebase 

### 4.3 Inventaire cliquable dans le profil

- [:x: ] Le bouton "📦 Inventaire" apparaît sur son propre profil pas bon, ça doit afficher en epehemere l'UI de /inventaire
- [⚠️] Le bouton n'apparaît PAS sur le profil d'un autre joueur
- [⚠️] Cliquer dessus affiche la liste des items (max 10, hors passifs) ça doit juste afficher le resultat de /inventaire
- [⚠️] Le bouton "Retour" ramène au profil principal
- [ ]] Si l'inventaire est vide → message approprié

### 4.4 Renommage Succès → Trophées

- [x] Le bouton du profil affiche "🏆 Trophées" (et non "Succès")
- [x] Le contenu de l'onglet trophées fonctionne toujours correctement

---

## 5. ⚙️ Tests de Régression

> S'assurer que les fonctionnalités existantes ne sont pas cassées.

### 5.1 Système de base

- [x] `/profile` — s'affiche correctement
- [x] `/daily` — fonctionne, donne les récompenses
- [x] `/boutique` — affiche la boutique du jour
- [x] `/inventaire` — affiche l'inventaire, les boutons "Utiliser" marchent
- [x] `/classement` — affiche les classements

### 5.2 Système de niveau et rang

- [x] Envoyer des messages donne XP/RP/Starss
- [x] Le vocal donne XP/RP (avec soft/hard caps)
- [x] Le level up fonctionne (rôles attribués)
- [x] Le rank up fonctionne (rôles attribués, notification)
- [⚠️] Le decay fonctionne (Émeraude+ seulement)

### 5.3 Battle Pass (ancien système)

- [ ] `/battlepass afficher` — fonctionne toujours
- [ ] `/battlepass claim` — les récompenses sont données
- [ ] Le battle pass et le puits coexistent sans conflit
A supprimer 

### 5.4 Guildes

- [ ] Créer / dissoudre une guilde
- [ ] Inviter / exclure des membres
- [ ] Trésorerie (dépôt, retrait, distribution)
- [ ] Guerres (déclaration, combat, fin)
- [ ] Upgrade de guilde (vérifier que la valeur est vérifiée)

### 5.5 Quêtes individuelles

- [ ] Les quêtes progressent normalement
- [ ] La complétion donne le badge + le trophée (nouveau)
- [ ] Les quêtes Halloween/Noël sont exclues de l'affichage normal

### 5.6 Échanges et prêts

- [ ] `/echange` fonctionne
- [ ] `/payer` fonctionne
- [ ] `/starss-preter` et `/rembourser` fonctionnent

### 5.7 Streaks

- [ ] Le streak daily fonctionne
- [ ] `streak_keeper` fonctionne toujours
- [ ] Le reset de streak mensuel s'exécute

### 5.8 Événements saisonniers

- [ ] Halloween (si actif) fonctionne
- [ ] Noël (si actif) fonctionne
- [ ] Saint-Valentin (si actif) fonctionne

---

## 6. 🔒 Tests de sécurité / edge cases

- [ ] Un utilisateur peut-il tirer plus que le max (50 Free / 70 VIP) ?
- [ ] Un utilisateur peut-il acheter sa propre annonce marketplace ?
- [ ] Un utilisateur peut-il vendre un item qu'il ne possède pas ?
- [ ] Un utilisateur peut-il annuler l'annonce d'un autre ?
- [ ] Que se passe-t-il si un utilisateur est supprimé du serveur avec des annonces actives ?
- [ ] La valeur négative est-elle possible ? (non — minimum 0)
- [ ] Le marketplace gère-t-il correctement les transactions concurrentes ? (SQLite = pas de vrai concurrency)
- [ ] Les index DB sont-ils créés ? Vérifier les performances sur de gros datasets

---

## 7. 📊 Tests de performance

- [x] Le bot démarre en < 30 secondes
- [ ] `recalculateAllValues()` s'exécute en < 10 secondes (pour ~1000 users)
- [ ] `cleanupExpiredListings()` s'exécute rapidement
- [ ] Les commandes répondent en < 3 secondes
- [ ] Le canvas (profil, battle pass) génère en < 5 secondes

---

## 8. ✅ Validation finale

- [ ] Toutes les sections ci-dessus sont validées
- [ ] Aucune erreur dans la console pendant les tests
- [ ] Le bot tourne stable pendant 1h minimum sans crash
- [ ] Les tâches planifiées s'exécutent correctement (vérifier les logs)

**Signature du testeur :** ____Richard___________  
**Date de validation :** _______________  
**Prêt pour la production :** ☐ Oui / ☐ Non  



