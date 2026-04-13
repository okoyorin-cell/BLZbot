# 🗄️ Schéma de Base de Données — BLZbot V5.3

> Documentation de toutes les tables et colonnes de la base de données.  
> Dernière mise à jour : 28/02/2026

---

## Fichiers SQLite

| Fichier | Contenu | Module d'accès |
|---|---|---|
| `blzbot.sqlite` | Base principale | `database/database.js` |
| `Haloween.sqlite` | Événement Halloween | `database/db-halloween.js` |
| `Noël.sqlite` | Événement Noël | `database/db-noel.js` |
| `Valentin.sqlite` | Événement Valentine | `database/db-valentin.js` |
| `badges.sqlite` | Badges utilisateurs | `database/db-badges.js` |
| `giveaway.sqlite` | Giveaways | `utils/db-giveaway.js` |

---

## Base principale (`blzbot.sqlite`)

### `users`

> Table principale des utilisateurs.

| Colonne | Type | Défaut | Description |
|---|---|---|---|
| `id` | TEXT | PK | Discord user ID |
| `username` | TEXT | NOT NULL | Nom d'utilisateur Discord |
| `xp` | INTEGER | 0 | XP totale accumulée |
| `level` | INTEGER | 1 | Niveau actuel |
| `xp_needed` | INTEGER | 100 | XP nécessaire pour le prochain niveau |
| `points` | INTEGER | 0 | Rank Points (RP) |
| `stars` | INTEGER | 0 | Starss (monnaie) |
| `daily_last_claimed` | INTEGER | 0 | Timestamp du dernier daily |
| `seasonal_xp` | INTEGER | 0 | XP saisonnière (battle pass) |
| `streak` | INTEGER | 0 | Streak actuel |
| `last_streak_timestamp` | INTEGER | 0 | Timestamp du dernier streak |
| `streak_lost_timestamp` | INTEGER | 0 | Timestamp de perte du streak |
| `previous_streak` | INTEGER | 0 | Streak avant perte |
| `last_decay_timestamp` | INTEGER | 0 | Timestamp du dernier decay |
| `xp_boost_until` | INTEGER | 0 | Fin du boost XP (timestamp) |
| `xp_boost_x4_until` | INTEGER | 0 | Fin du boost XP ×4 |
| `points_boost_until` | INTEGER | 0 | Fin du boost RP |
| `stars_boost_until` | INTEGER | 0 | Fin du boost Starss |
| `counting_boost_until` | INTEGER | 0 | Fin du boost Comptage |
| `last_activity_timestamp` | INTEGER | 0 | Dernière activité (pour decay) |
| `last_xp_boost` | INTEGER | 0 | Timestamp du dernier achat boost XP |
| `last_points_boost` | INTEGER | 0 | Timestamp du dernier achat boost RP |
| `last_stars_boost` | INTEGER | 0 | Timestamp du dernier achat boost Starss |
| `last_counting_boost` | INTEGER | 0 | Timestamp du dernier achat boost Comptage |
| `points_comptage` | INTEGER | 0 | Points de comptage accumulés |
| `hacker_item_timestamp` | TEXT | NULL | Dernier claim item hacker |
| `peak_rank` | TEXT | NULL | Plus haut rang atteint (pour lock) |
| `daily_voice_xp` | INTEGER | 0 | XP vocal gagné aujourd'hui |
| `daily_voice_last_reset` | INTEGER | 0 | Dernier reset des caps vocaux |
| `daily_voice_points` | INTEGER | 0 | RP vocal gagné aujourd'hui |
| `minigames_won` | INTEGER | 0 | Mini-jeux gagnés |
| `max_points` | INTEGER | 0 | Record de RP (historique) |
| `max_stars` | INTEGER | 0 | Record de Starss (historique) |
| `notify_rank_up` | INTEGER | 1 | Notification rank up (0/1) |
| `notify_level_up` | INTEGER | 1 | Notification level up |
| `notify_streak` | INTEGER | 1 | Notification streak |
| `notify_guild_invite` | INTEGER | 1 | Notification invitation guilde |
| `notify_quest_complete` | INTEGER | 1 | Notification quête complétée |
| `notify_trade` | INTEGER | 1 | Notification échange |
| `notify_minigame_invite` | INTEGER | 1 | Notification mini-jeu |
| `notify_debt_reminder` | INTEGER | 1 | Notification rappel dette |
| `is_vip` | INTEGER | 0 | Statut VIP (0/1) |
| `vip_expires_at` | INTEGER | 0 | Expiration VIP (timestamp) |
| `tirage_points` | INTEGER | 0 | 🆕 Points de Tirage (Puits) |
| `total_tirages` | INTEGER | 0 | 🆕 Nombre de tirages effectués cette saison |
| `total_value` | INTEGER | 0 | 🆕 Valeur totale calculée |

---

### `user_inventory`

> Inventaire des items par utilisateur.

| Colonne | Type | Description |
|---|---|---|
| `user_id` | TEXT | PK, FK → users.id |
| `item_id` | TEXT | PK, ID de l'item |
| `quantity` | INTEGER | Quantité possédée |

---

### `guilds`

> Guildes du serveur.

| Colonne | Type | Défaut | Description |
|---|---|---|---|
| `id` | INTEGER | PK AUTO | ID unique de la guilde |
| `name` | TEXT | UNIQUE | Nom de la guilde |
| `owner_id` | TEXT | NOT NULL | Discord ID du propriétaire |
| `level` | INTEGER | 0 | Niveau de la guilde |
| `member_slots` | INTEGER | 3 | Nombre de places (3-12) |
| `upgrade_level` | INTEGER | 1 | Niveau d'upgrade (1-10) |
| `treasury` | INTEGER | 0 | Trésorerie actuelle |
| `treasury_capacity` | INTEGER | 0 | Capacité max de trésorerie |
| `sub_chiefs` | TEXT | '[]' | JSON array des sous-chefs |
| `boost_level` | INTEGER | 0 | Niveau de boost guilde |
| `treasury_multiplier_level` | INTEGER | 0 | Multiplicateur trésorerie |
| `guild_boost_until` | INTEGER | 0 | Fin du boost guilde |
| `channel_id` | TEXT | NULL | ID du canal privé |
| `emoji` | TEXT | '🛡️' | Emoji de la guilde |
| `custom_roles` | TEXT | '[]' | JSON des rôles custom |
| `overstaffed_since` | INTEGER | NULL | Début du sureffectif |
| `wars_won` | INTEGER | 0 | Guerres gagnées (total) |
| `wars_won_70` | INTEGER | 0 | Guerres gagnées à 70%+ |
| `wars_won_80` | INTEGER | 0 | Guerres gagnées à 80%+ |
| `wars_won_90` | INTEGER | 0 | Guerres gagnées à 90%+ |
| `joker_guilde_uses` | INTEGER | 0 | Utilisations de Joker (max 3) |
| `total_treasury_generated` | INTEGER | 0 | Total trésorerie générée |
| `xp_boost_purchased` | INTEGER | 0 | Boost XP achetés via guild tools |
| `points_boost_purchased` | INTEGER | 0 | Boost RP achetés |
| `stars_boost_purchased` | INTEGER | 0 | Boost Starss achetés |
| `treasury_multiplier_purchased` | INTEGER | 0 | Multi. trésorerie achetés |
| `created_at` | INTEGER | 0 | Timestamp de création |
| `last_penalty_check` | INTEGER | 0 | Dernier check pénalité |
| `custom_roles_config` | TEXT | '[]' | Config rôles custom |
| `total_value` | INTEGER | 0 | 🆕 Valeur totale de la guilde |

---

### `guild_members`

> Appartenance des utilisateurs aux guildes.

| Colonne | Type | Description |
|---|---|---|
| `user_id` | TEXT | PK, FK → users.id |
| `guild_id` | INTEGER | FK → guilds.id |
| `role_id` | TEXT | ID du rôle Discord attribué |
| `custom_role` | TEXT | Rôle custom dans la guilde |

---

### `guild_wars`

> Guerres entre guildes.

| Colonne | Type | Description |
|---|---|---|
| `id` | INTEGER | PK AUTO |
| `guild1_id` | INTEGER | FK → guilds.id |
| `guild2_id` | INTEGER | FK → guilds.id |
| `start_time` | INTEGER | Timestamp début |
| `end_time` | INTEGER | Timestamp fin |
| `duration_type` | TEXT | '12h', '48h', '7d' |
| `status` | TEXT | 'ongoing', 'ended' |
| `winner_id` | INTEGER | FK → guilds.id (NULL si en cours) |
| `declared_by` | INTEGER | FK → guilds.id |
| `forced` | BOOLEAN | 0/1 (Coup d'État) |
| `guild1_initial_treasury` | INTEGER | Trésorerie G1 au début |
| `guild2_initial_treasury` | INTEGER | Trésorerie G2 au début |

---

### `guild_war_members`

> Statistiques individuelles de guerre.

| Colonne | Type | Description |
|---|---|---|
| `war_id` | INTEGER | PK, FK → guild_wars.id |
| `user_id` | TEXT | PK, FK → users.id |
| `guild_id` | INTEGER | FK → guilds.id |
| `war_messages` | INTEGER | Messages envoyés pendant la guerre |
| `war_counting_messages` | INTEGER | Messages de comptage |
| `war_voice_minutes` | INTEGER | Minutes vocales |
| `war_points` | INTEGER | Points de guerre totaux |
| `initial_pc` | INTEGER | Points comptage au début |

---

### `guild_war_declarations`

> Déclarations de guerre en attente.

| Colonne | Type | Description |
|---|---|---|
| `id` | INTEGER | PK AUTO |
| `from_guild_id` | INTEGER | Guilde déclarante |
| `to_guild_id` | INTEGER | Guilde ciblée |
| `duration_type` | TEXT | Durée proposée |
| `forced` | BOOLEAN | Coup d'État |
| `timestamp` | INTEGER | Timestamp de déclaration |
| `status` | TEXT | 'pending', 'accepted', 'declined' |

---

### `guild_invitations`

> Invitations de guilde en cours.

| Colonne | Type | Description |
|---|---|---|
| `guild_id` | INTEGER | FK → guilds.id |
| `target_user_id` | TEXT | Joueur invité |
| `inviter_user_id` | TEXT | Joueur qui invite |
| `timestamp` | INTEGER | Timestamp d'invitation |

---

### `guild_quests`

> Définition des quêtes de guilde.

| Colonne | Type | Description |
|---|---|---|
| `id` | INTEGER | PK AUTO |
| `type` | TEXT | Type de quête |
| `target` | INTEGER | Objectif numérique |
| `reward_type` | TEXT | Type de récompense |
| `reward_amount` | INTEGER | Montant de récompense |
| `rarity` | TEXT | Rareté de la quête |
| `description` | TEXT | Description |

---

### `guild_quest_progress`

> Progression des quêtes de guilde par guilde.

| Colonne | Type | Description |
|---|---|---|
| `guild_id` | INTEGER | PK, FK → guilds.id |
| `quest_id` | INTEGER | PK, FK → guild_quests.id |
| `completed` | BOOLEAN | Complétée (0/1) |
| `completed_at` | INTEGER | Timestamp de complétion |

---

### `guild_application_refusals`

| Colonne | Type | Description |
|---|---|---|
| `guild_id` | INTEGER | PK |
| `user_id` | TEXT | PK |

---

### `custom_roles`

> Rôles personnalisés de guilde.

| Colonne | Type | Description |
|---|---|---|
| `role_id` | TEXT | PK, Discord role ID |
| `guild_id` | INTEGER | FK → guilds.id |
| `owner_id` | TEXT | Créateur du rôle |
| `members` | TEXT | JSON array des membres |

---

### `battle_pass`

> Progression du battle pass par utilisateur et palier.

| Colonne | Type | Description |
|---|---|---|
| `user_id` | TEXT | PK |
| `tier` | INTEGER | PK, palier (1-50) |
| `claimed_free` | BOOLEAN | Récompense free réclamée |
| `claimed_vip` | BOOLEAN | Récompense VIP réclamée |

---

### `quest_progress`

> Progression des quêtes individuelles.

| Colonne | Type | Description |
|---|---|---|
| `user_id` | TEXT | PK, FK → users.id |
| `quest_id` | TEXT | PK, ID de la quête |
| `progress` | INTEGER | Progrès actuel |
| `completed` | INTEGER | Complétée (0/1) |

---

### `puits_tirages` 🆕

> Historique des tirages du Puits de Combat.

| Colonne | Type | Description |
|---|---|---|
| `id` | INTEGER | PK AUTO |
| `user_id` | TEXT | FK → users.id |
| `tirage_number` | INTEGER | Numéro du tirage (1-70) |
| `reward_type` | TEXT | Type de récompense (starss, item, role) |
| `reward_id` | TEXT | ID de l'item/rôle (NULL si starss) |
| `reward_amount` | INTEGER | Montant (si starss) |
| `timestamp` | INTEGER | Timestamp du tirage |

---

### `marketplace_listings` 🆕

> Annonces du marketplace P2P.

| Colonne | Type | Description |
|---|---|---|
| `id` | INTEGER | PK AUTO |
| `seller_id` | TEXT | FK → users.id |
| `item_id` | TEXT | ID de l'item vendu |
| `quantity` | INTEGER | Quantité vendue |
| `price_type` | TEXT | 'starss' (ou futur : item) |
| `price_item_id` | TEXT | NULL (réservé) |
| `price_amount` | INTEGER | Prix en Starss |
| `created_at` | INTEGER | Timestamp de création |
| `expires_at` | INTEGER | Timestamp d'expiration (+7j) |
| `status` | TEXT | 'active', 'sold', 'cancelled', 'expired' |
| `buyer_id` | TEXT | FK → users.id (NULL si pas vendu) |
| `bought_at` | INTEGER | Timestamp d'achat (NULL si pas vendu) |

**Index :** `idx_marketplace_status` sur (status, expires_at)

---

### `user_trophies` 🆕

> Trophées obtenus par les utilisateurs.

| Colonne | Type | Description |
|---|---|---|
| `user_id` | TEXT | PK, FK → users.id |
| `trophy_id` | TEXT | PK, ID du trophée (= quest_id) |
| `rarity` | TEXT | Rareté (Commune, Rare, Épique, Légendaire, Mythique, Goatesque, Halloween) |
| `earned_at` | INTEGER | Timestamp d'obtention |

---

### `loans`

> Prêts entre utilisateurs.

| Colonne | Type | Description |
|---|---|---|
| `id` | INTEGER | PK AUTO |
| `lenderId` | TEXT | Prêteur |
| `borrowerId` | TEXT | Emprunteur |
| `amount` | INTEGER | Montant du prêt |
| `interest` | INTEGER | Taux d'intérêt (%) |
| `createdAt` | DATETIME | Date de création |
| `expiresAt` | DATETIME | Date d'échéance |
| `accepted` | BOOLEAN | Accepté par l'emprunteur |
| `repaid` | BOOLEAN | Remboursé |
| `repaid_amount` | INTEGER | Montant remboursé |

---

### `user_badges`

> Badges obtenus (prédécesseur de user_trophies).

| Colonne | Type | Description |
|---|---|---|
| `user_id` | TEXT | PK |
| `badge_id` | TEXT | PK |
| `earned_at` | INTEGER | Timestamp |

---

### `war_mvps`

> MVPs des guerres de guildes.

| Colonne | Type | Description |
|---|---|---|
| `war_id` | INTEGER | PK |
| `user_id` | TEXT | PK |
| `guild_id` | INTEGER | Guilde du MVP |
| `points_contributed` | INTEGER | Points contribués |
| `rewarded_at` | INTEGER | Timestamp |

---

### `shop_info`

> Métadonnées de la boutique.

| Colonne | Type | Description |
|---|---|---|
| `id` | INTEGER | PK (toujours 1) |
| `last_generated` | TEXT | Dernière génération |
| `last_legendary_chest_check` | INTEGER | Dernier check coffre légendaire |
| `legendary_chest_available` | INTEGER | Coffre légendaire dispo (0/1) |

---

### `shop_alerts`

> Alertes boutique (notification quand un item apparaît).

| Colonne | Type | Description |
|---|---|---|
| `user_id` | TEXT | PK |
| `item_id` | TEXT | PK |
| `created_at` | INTEGER | Timestamp |

---

### `resource_history`

> Historique des modifications de ressources (pour diagnostic).

| Colonne | Type | Description |
|---|---|---|
| `id` | INTEGER | PK AUTO |
| `user_id` | TEXT | FK → users.id |
| `resource_type` | TEXT | 'xp', 'points', 'stars' |
| `amount` | INTEGER | Montant (+ ou -) |
| `source` | TEXT | Source de la modification |
| `timestamp` | INTEGER | Timestamp |

---

### `bot_settings`

> Paramètres globaux du bot (key-value).

| Colonne | Type | Description |
|---|---|---|
| `key` | TEXT | PK, clé du paramètre |
| `value` | TEXT | Valeur |

---

### `ranked_daily_activity`

> Activité journalière pour le système ranked.

| Colonne | Type | Description |
|---|---|---|
| `id` | INTEGER | PK AUTO |
| `user_id` | TEXT | FK → users.id |
| `date` | TEXT | Date (YYYY-MM-DD) |
| `messages` | INTEGER | Messages du jour |
| `voice_minutes` | INTEGER | Minutes vocales du jour |

**Index unique :** (user_id, date)

---

### `server_quests` ⚠️ Déprécié

> Quêtes de serveur (système supprimé en MAJ Mars 2026).

| Colonne | Type | Description |
|---|---|---|
| `id` | INTEGER | PK AUTO |
| `objective` | TEXT | Type d'objectif |
| `target` | INTEGER | Objectif numérique |
| `progress` | INTEGER | Progrès actuel |
| `status` | TEXT | 'inactive', 'active', 'voting' |
| `start_time` | DATETIME | Début |
| `end_time` | DATETIME | Fin |

---

### `server_quest_votes` ⚠️ Déprécié

> Votes de récompense des quêtes de serveur.

| Colonne | Type | Description |
|---|---|---|
| `quest_id` | INTEGER | PK |
| `user_id` | TEXT | PK |
| `reward` | TEXT | Choix de récompense |

---

## Diagramme des relations

```
users ──────┬──── user_inventory
            ├──── quest_progress
            ├──── user_badges
            ├──── user_trophies 🆕
            ├──── battle_pass
            ├──── puits_tirages 🆕
            ├──── marketplace_listings 🆕 (seller_id, buyer_id)
            ├──── loans (lenderId, borrowerId)
            ├──── resource_history
            ├──── shop_alerts
            ├──── ranked_daily_activity
            └──── guild_members ──── guilds
                                      ├──── guild_invitations
                                      ├──── guild_quests ──── guild_quest_progress
                                      ├──── guild_wars ──── guild_war_members
                                      │                 └── guild_war_declarations
                                      ├──── war_mvps
                                      ├──── custom_roles
                                      └──── guild_application_refusals
```
