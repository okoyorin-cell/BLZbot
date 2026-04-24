# Tutoriel — bot de test REBORN (`reborn-test-bot`)

Ce bot est un **sandbox** : données SQLite locales (`data/reborn.sqlite`), **pas** la même base que BLZbot prod. Les commandes avec la même **nom** que le bot principal peuvent avoir un **comportement différent** (économie REBORN simplifiée, guildes « joueur », etc.).

---

## Avant de commencer

1. **`.env`** dans `reborn-test-bot/` (ou variables `REBORN_*` à la racine du repo — voir `src/config.js`) :
   - `REBORN_TEST_BOT_TOKEN` — token de **l’application Discord** du bot de test  
   - `REBORN_TEST_BOT_CLIENT_ID`  
   - `REBORN_TEST_GUILD_ID` *(recommandé)* — déploiement des slash **sur cette guilde** (plus rapide qu’en global)  
2. **`REBORN_MIRROR_NIVEAU_SLASH=1`** *(défaut)* — enregistre aussi les slash du module **niveau** (bot principal) sur la même appli Discord ; sans code local → réponse « utiliser BLZbot ». Désactive avec `0` si tu veux **uniquement** les commandes du sandbox.  
3. **Node** : aligne la version avec celle pour laquelle `better-sqlite3` est compilé (souvent **Node 22 LTS**), sinon `npm run reinstall:sqlite` dans ce dossier.  
4. Lancer : `npm start` (ou `npm run reborn-test-bot:start` depuis la racine du repo). Redémarre après changement de slash.

---

## Économie & progression

| Commande | Rôle |
|-----------|------|
| `/solde` | Starss, points, XP, boosts actifs, ligne guilde joueur + GRP sur le serveur. |
| `/daily` | Daily test (+ starss), cooldown ~24 h. |
| `/payer` | Transférer des starss à un joueur. |
| `/money` | Admin serveur / owner : `give`, `remove`, `set` (starss ou points). |

**Gains passifs** (sans commande) : messages et temps en vocal sur un serveur → starss, XP, GXP/GRP (voir `/grp`).

---

## Boutique & inventaire

| Commande | Rôle |
|-----------|------|
| `/boutique` | Shop du jour (slots), boosts, coffres ; achats via **boutons** sous le message. |
| `/inventaire` | Liste des items possédés. |

**Coffres** : loot (starss, XP, items) selon le type (classique, CATM, CATL, CATS) — diamant / jeton hacker selon les règles du module test.

---

## Guildes « joueur » (REBORN)

Système **à part** des guildes BLZbot (`db-guilds`). Une guilde = une entité sur **ce serveur Discord** (hub).

| Sous-commande `/guilde` | Rôle |
|------------------------|------|
| `creer` | Créer une guilde (niveau joueur **≥ 15**). |
| `rejoindre` | Rejoindre avec l’**ID** guilde (`liste`). |
| `quitter` | Quitter (pas le chef → transfert ou dissolution avant). |
| `info` | Infos (chef, membres, GXP, trésorerie, grade…). |
| `liste` | Guildes du serveur. |
| `inviter` | Chef **ou** permission **« invitations »** (`roles`). |
| `tresor_depot` | Dépôt starss (permission **dépôt** ou chef). |
| `tresor_retrait` | Retrait (chef **ou** permission **retrait**). |
| `tresor_voir` | Solde trésorerie. |
| `grade_up` | Chef : achat du prochain **grade** guilde (conditions doc simplifiées). |
| `perm_voir` / `perm_set` | Voir / définir **depot, retrait, kick, roles, focus** pour un membre (chef). |
| `expulser` | Chef **ou** **kick**. |
| `transferer_chef` | Donner le lead à un membre. |
| `dissoudre` | Supprimer la guilde (chef). |
| `focus` | Chef **ou** **focus** : action GRP sur une guilde cible (coût trésorerie + CD). |

### `/profil-guilde`

Fiche **embed** de la guilde joueur : sans option = ta guilde sur ce serveur ; option **`nom`** = partie du nom ou **ID** exact. Ce n’est **pas** le canvas `/profil-guilde` du bot principal.

---

## GRP & saison

| Commande | Rôle |
|-----------|------|
| `/grp voir` | Ton GRP (ou un membre), rang, pics de saison (mois UTC). |
| `/grp classement` | Top 15 GRP du serveur. |

Reset mensuel **automatique** côté code (clé mois UTC).

---

## Séparation & échanges

| Commande | Rôle |
|-----------|------|
| `/separation` | `lancer`, `rejoindre`, `statut` — événement test + tick serveur. |
| `/echange` | `proposer` / `accepter` — starss + optionnel **`objets_donnes`** / **`objets_recus`** (`item_id:qty`, ex. `corail:2`). Règle **40 %** de valeur max. |

---

## Index items

| Sous-commande `/itemindex` | Rôle |
|----------------------------|------|
| `voir` | % complétion (option membre). |
| `definir` | Définir le % (tests). |
| `reclamer` | Palier suivant → starss. |

---

## Quêtes sandbox

| Sous-commande `/quete` | Rôle |
|------------------------|------|
| `voir` | Messages du jour, hebdo, quête à choix, total messages suivis. |
| `quotidienne` | Récompense si assez de **messages** aujourd’hui sur le serveur. |
| `hebdo` | Récompense si assez de **points** semaine (1 pt = 1 message). |
| `choisir` | **Une** quête à choix par semaine : *Chasse 20 messages* ou *Offre 1 corail*. |
| `reclamer_selection` | Valider et recevoir la récompense (corail retiré à la réclamation si besoin). |

---

## Trophées & Hacker

| Commande | Rôle |
|-----------|------|
| `/trophees` | `voir` : liste + critères ; `verifier` : revérifie les déblocages. |
| `/hacker` | Tirage salon (cooldown 12 h sauf mode test ; rôle optionnel `REBORN_HACKER_ROLE_ID`). |

---

## Staff léger

| Commande | Rôle |
|-----------|------|
| `/passeport` | `voir` : points sécu, warns, tests mod, candidature ; `maj_staff` : admin/owner. |
| `/warn` | Avertir (points sécu). |
| `/purge` | Purge messages (mod). |

---

## Utilitaires

| Commande | Rôle |
|-----------|------|
| `/ping` | Latence. |
| `/server` | Infos serveur (debug). |
| `/reborn-ref` | Récap des modules + rappel **miroir slash** niveau. |

---

## Miroir des commandes BLZbot (niveau)

Si `REBORN_MIRROR_NIVEAU_SLASH=1` : les slash des dossiers **core / guilde / admin / misc** du projet **niveau** sont **déployés** sur la même application Discord **quand** le `require` du fichier réussit (souvent besoin du même Node que pour la prod + binaire SQLite OK).

- Si une commande a le **même nom** qu’une commande **locale** du sandbox (`/guilde`, `/boutique`, `/money`, …) → **la version REBORN l’emporte**.  
- Sinon → menu comme sur BLZbot, mais l’exécution renvoie un message pour **utiliser le bot principal**.  
- Plafond **100** commandes par application Discord : au-delà, seules les locales + un complément miroir sont gardées.

---

## Bonnes pratiques

- Tester d’abord sur un **serveur dédié** avec le bot de test.  
- Après ajout de fichiers dans `src/commands/`, **redémarre** le bot ou `npm run deploy` dans `reborn-test-bot`.  
- Pour la doc produit « officielle » REBORN, se référer au document métier ; ce tutoriel décrit **uniquement** ce que fait **ce dépôt** dans `reborn-test-bot`.
