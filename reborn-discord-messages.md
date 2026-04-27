# MAJ REBORN — guide simple (ce qu'on code)

Texte de spec condensé : **économie**, **ranked**, **guilde**, **boutique**, **arbre**, **temple**, **staff**, etc. En **gras** = l'idée clé ; le reste c'est le **détail** à implémenter.

---

# 1) Pourquoi on fait ça
- **Refonte large** : on repart comme si le bot repart de zéro, pour **rallonger la durée de jeu** (plus de tryhard 1 semaine puis vide).
- **Objectif** : règles **claires**, monnaies & systèmes **reliés** (boutique, quêtes, guilde, ranked, temple).

---

# 2) Starss (monnaie)
- C'est la **devise** principale (surtout **boutique** + gros coûts guilde).
- **Gains** : **15** par message, **40** par **minute** de vocal.
- Tout le monde a un **inventaire** d'**items** (rareté = **prix** au catalogue, voir § boutique).

**À coder** : comptage msg/voc, crédit starss, gros nombres cohérents (souvent **BigInt**).

---

# 3) Niveau & XP
- **10** XP / message, **25** XP / minute de vocal.
- **Courbe** (comme en doc) : passage **0 → 1** = **1** XP, **1 → 2** = **99** XP, puis chaque palier **+100** (niveau 2 = 100 XP à grinder, 3 = 200, etc.).
- Chaque **niveau gagné** = **+1 point** pour l'**arbre de compétences** (sauf règles spéciales).

**À coder** : XP, niveaux, passation des points d'arbre quand le niveau augmente.

---

# 4) Arbre (5 branches) + classes + temple
- Cinq branches : **Quête**, **Guilde**, **Boutique**, **Ranked**, **Événement** — chaque branche a **5 étapes**, à prendre **dans l'ordre**.
- **Coût d'une étape** = en général le **numéro de l'étape** en **points d'arbre** (sauf compétence **unique** = **5** points, à part sur la doc guilde / séparation).
- **Terminer une branche** = une **classe** (Classe quête, Classe guilde, etc.) ; les **classes** deviennent vraiment utiles quand tu as **les 5**.
- Quand **toutes les branches sont à 5/5** → le joueur **débloque le Temple** (et peut enfin **voir** correctement le total de **points temple** s'il avait déjà des prérequis remplis avant).

**À coder** : stockage arbre, achat d'étape, appliquer les **perks** (voir **chaque** branche ci-dessous), flag **temple débloqué**.

## 4.1) Branche Quête
1. Chaque semaine : **1 skip daily** + **1 skip hebdo** gratuits  
2. Récupérer **les deux** récompenses (daily + hebdo) quand c'est prévu par la règle  
3. **+1 emplacement** de quête (ex. 3 → **4**)  
4. **+1** skip de quête / semaine  
5. **+1** slot (ex. 4 → **5**)  
+ compétence **unique** (coût **5**) : bonus côté **séparation** (camp **séparatiste**) — selon spec exacte.

**À coder** : règles de quêtes, skips, **slots** UI, bonus séparation lié à l'arbre.

## 4.2) Branche Guilde
1. **+1** membre "gratuit" (cap)  
2. **+10 % GXP**  
3. **+1** membre  
4. **+10 % GRP** (en guilde)  
5. **+20 % GRP** pendant la **séparation** côté **guilde d'origine**  

**À coder** : multiplicateurs GXP/GRP, conditions **guerre de séparation**.

## 4.3) Branche Boutique
1. **+1** "reset boutique" **gratuit** / semaine (skip)  
2. **×2** de "contenu" coffre **vs** coffre classique (selon ta spec loot)  
3. **2ᵉ** rotation de shop à **midi** (heure **France** / Paris)  
4. **100 %** de spawn **CATL** toutes les **3 h** (au lieu du 50/50)  
5. **−30 %** sur toute la boutique (permanent)  

**À coder** : génération shop, timers midi, proba **CATL**, appliquer la remise.

## 4.4) Branche Ranked
1. **+10 %** RP (bonus permanent)  
2. **+1** RP par **message** (flat, en plus du gain de base)  
3. Passe le bonus de **10 %** à **20 %**  
4. **+2** RP par **minute** voc (flat)  
5. Passe le bonus de **20 %** à **30 %**  

**À coder** : le doc dit souvent **pas** de boosts RP ailleurs que cette logique de paliers — **à respecter** selon ta version finale.

## 4.5) Branche Événement
1. **+10 %** de gain de **monnaie d'évent** (définitif)  
2. Passe le **boost "déf"** (event) de **10 %** à **20 %** (si ce système existe)  
3. Passe **20 %** → **30 %**  
4. **−20 %** sur **coffres d'évent**  
5. **1** Event **Spawner** offert / **semaine**  

**À coder** : toute la couche "évent + monnaie d'évent + coffres évent + spawner" (très lié BDD + timers).

---

# 5) Ranked (RP perso)
- Seulement en **message** + **vocal** — taux de gain qui **baisse** quand l'ELO (RP) **monte** (table par paliers sur ton doc, ex. jusqu'à **100k+**).
- **Décrépitude** : si inactif **24 h**, **perte** de RP selon la **tranche** ; pour **casser** l'inactif = **1 message** ou **≥ 1 min** de vocal.
- Paliers de **rang** (Argent, Or, …, **Goat**, **Star**) = **grosses** récompenses en **starss** + **coffres** (ligne "étape 3 à 12" sur ton screen).

**À coder** : tick décroissance, grilles de gain, remises de récompenses de palier.

---

# 6) Guilde (remplace l'esprit "wars" par du **GR**)
### Gains GXP
- Taux de **GXP** selon **niveau joueur** (doc = paliers, ex. à partir de **niveaux hauts** 7/14 par msg, etc. jusqu'à 10/20 en 100+).
- Le **niveau de guilde** suit une **courbe** proche de celle du **joueur** (1, 99, +100, …) → sert le **max de membres** + déblocages de **grade**.

### GRP
- C'est le **ladder** "guilde sur le serveur" = **1** GRP / msg, **3** GRP / min voc = **1/10** du taux "ranked normal" (doc).
- **Visible** sur fiche guilde + profil comme le GXP.

### Trésor & permissions
- Tout le monde peut théoriquement lier de l'**argent** à la guilde ; le **chef** + rôles assignés peuvent **déposer** / **retirer** / **kick** / s'occuper des **rôles internes** / lancer le **focus** (selon **grade** doc).

### Grades (Bronze → … → **Star**)
- Chaque grade a des **requis** : gros **montants** en starss, avoir atteint tel **niveau** côté **GR**, parfois **N** items mythiques, **cristaux** goatesque, **Diamant** (unique) pour le haut du **ladder**.
- **Avantages** (doc) : **+ places**, **tréso**, **focus**, **salon** perso, **rôles** custom, **+ slots**, **anti-séparation** au **haut** du ladder, etc.

### Focus (sabotage d'autres guildes)
- **500 000** depuis la **tréso** ; **CD 7 j** (**168 h**).  
- **3 modes** : pénalité GRP ciblée par **tête**, pénalité GRP en **masse** répartie, ou **÷2** sur le **gain** GRP des cibles pendant **2 h**.

**À coder** : toute la **fiche** guilde, GXP, GRP, grades, tréso, perms, focus **réel** (zéro placeholder sur le mode 3).

### Anti-séparation
- Un **haut** grade (doc) **empêche** le flux de **séparation** sur la guilde.

### Séparation (scission)
- Système en **phases** (adhésion, snapshots GRP, résolution) ; sert le **PVP d'orga** + des **perks** d'arbre + des **points temple** (défense / victoire).

**À coder** : state machine, anti-doublon, intégration GRP, **temple** + rôles si besoin.

---

# 7) Temple — **11** points
Points types (1 point = une grande ligne) : **arbre fini**, **rang** ranked **max**, posséder le **Diamant**, **grade Star** de guilde, **rang** GRP **star**, **réussir** une **défense** en **séparation**, **réussir** une **séparation**, finir l'**index d'item**, **+1** point par **index d'évent** complété, rôle **Hacker** Discord, etc. (selon ton **doc final**).
- **Classement** : **Top 1** = rôle type **Roi du serveur** ; **11/11** = **Légende** + autre ligue "full point".

**À coder** : moteur de **points** + rôles auto + (optionnel) un **leaderboard** dédié.

---

# 8) Boutique
- **Ligne 1** : **5** items ; **proba** de rareté (50 % communs → 1 % staresque) ; **égalité** entre items **de la même rareté** sur le slot.  
- **Ligne 2** : **coffres** (Classic, CATM, CATL, CATS) avec règles d'**achat** / **limites** / **spawns** toutes les **3 h** pour **CATL/CATS**.  
- **Ligne 3** : boosts **1 h** (×2 **XP** / **GXP** / **starss**) à **30k** (pas 10k même si c'est un item "commun").  
- **Reset** quotidien **minuit** (doc) + effets d'arbre (midi, skip, proba, **−30%**).

**À coder** : génération 3 rangées, shop **reset**, intégration arbre, loot coffres.

---

# 9) Index d'items
- Paliers **10 %** → **100 %** = **gros** **starss** + coffres ; à **100 %** souvent un **gros** **rôle** (doc).
- Tes **screens** mappent aussi les paliers aux **paliers de ranked** & **exigences de** **grade** guilde — c'est de la **matrice** de progression **croisée**.

**À coder** : %, réclamations, rewards, rôle, lien avec **raretés** / "collection".

---

# 10) Quêtes
- **Défis lourds** (ex. 400k **ou** gros coffre) ; **définitives** (étapes 10 → 1000 **messages** avec récompenses) ; grosse nouveauté d'**UX** = **quêtes de sélection** (menu) — c'est le **cœur** de la V2 du **menu** quêtes.
- **Skips** & **slots** = l'**arbre quête** (voir **§4.1**).

**À coder** : moteur de quêtes, compteurs, intégrations minijeux / comptage / vocal, etc.

---

# 11) Items (sélection)
**Exemples doc** : **Double daily**, **Streak keeper**, **reset boutique**, **remboursement** dette, **Event spawner** (cooldown perso + **plancher** global 1h), **×2 XP / GXP / starss 1h**, **Cristal** (goaetsque, loot rare), **Diamant** **unique** serveur (1 seul possédé, puis reroll s'il est **détruit** / perdu), **skips** quête/daily/hebdo, et les items **thématiques** (corail, etc.) + cosmétique (planètes, etc.).

**À coder** : chaque item = **effet** + **limites** + (pour le Diamant) **verrou** global + migration **safe**.

---

# 12) Staff
- **`/passeport`** remplace l'ancien profil staff compétitif. **Tout le monde** peut lire. Affiche : nom, rôle, **avertissements/TOs**, suivi **tests mod** / **candidature staff**, et **points de** **sécu** (départ **10**), récup **+2** / **30 j** si t'es pas full.
- **Warns** : **−1** / **−2** / **−5** selon **gravités** (léger, moyen, fort) — c'est le **cœur** de la "sanction graduelle".

**À coder** : BDD, UI, intégration modération (et évent. **TO** si tu les comptes sur la même fiche).

---

# 13) Échange / hasard
- Systèmes d'**économie** qui **recyclent** l'inflation (échanges, coffres, events) — côté dev : **règles d'écart** de **valeur**, idempotence, **anti** multi-comptes si tu vises le **fairness**.

---

# 14) Ce que l'équipe doit vraiment **foutre** (résumé 6 lignes)
- **1)** **BDD** propre (tout le monde : joueurs, items, guilde, GRP, séparations, arbre, temple, warns).  
- **2)** Tous les **gains** passifs (msg/voc) + **décroissance** ranked + **reset** de **saison** GRP.  
- **3)** Toute la **saga** guilde (grades, tréso, perms, focus, anti-sépa, GXP, GRP, salon & rôles).  
- **4)** L'**arbre** (toutes les branches) + **temple** + rôles **légendaires** si c'est voulu à la sortie.  
- **5)** **Boutique** + **index** + **quêtes** (dont **sélections** + slots).  
- **6)** **Déploiement** sûr : preprod, migrations, feature flags, reset communiqué, monitoring.

---

**Bonne pratique** : chaque gros bloc = **1** epic / **1** dev **owner** + des **sous** tickets. Si tu me dis **MVP = quoi** (3 mois vs 1 an), on peut griser ce qui part en **V2** dans le même texte.
