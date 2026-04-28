# BLZ Verification

Bot Discord de **vérification OAuth** + **capture IP**, avec logs séparés (sans IP en salon, **avec IP en DM aux owners**).

Adapté du système Killua (`Killua bot verif`) — partie modération/antiraid retirée car gérée par le bot `modération` du repo principal.

---

## Comment ça marche

1. Un admin lance **`/setup-verification`** sur son serveur. Un panneau éphémère s'affiche pour configurer :
   - Salon où poster le panneau public
   - Rôle attribué après vérification
   - Salon des logs **sans IP** (publics, visibles par le staff)
   - (Optionnel) Personnaliser titre/description/couleur de l'embed
   - Bouton **Publier / mettre à jour le panneau**
2. Le panneau public contient un embed + un bouton **"🔐 Vérifier"**.
3. Quand un membre clique, il reçoit un **lien éphémère** vers `${PUBLIC_BASE_URL}/oauth/start?state=...`.
4. Le membre est redirigé vers Discord OAuth2 (scope `identify email`), accepte, revient sur `/oauth/callback`.
5. Le serveur :
   - vérifie que le compte Discord est le bon (anti-spoof),
   - vérifie que l'email Discord est confirmé,
   - hashe l'email (anti double-compte sur la guilde),
   - donne le rôle vérifié,
   - log dans les 2 canaux (salon sans IP + DM owners avec IP).

Tout ce que la DB stocke par membre = `(guild_id, discord_user_id, email_hash, verified_at)`. **Aucun email en clair, aucune IP** ne sont persistés en base.

---

## 1. Installation locale

```bash
cd verification
npm install
```

Si tu as un souci `better-sqlite3` / `NODE_MODULE_VERSION` :

```bash
npm rebuild better-sqlite3
```

---

## 2. Application Discord

Sur le **portail développeur Discord** (https://discord.com/developers/applications) :

1. Crée (ou réutilise) une application + un bot.
2. **Bot → Reset Token** → copie dans `.env` (`BOT_TOKEN`).
3. **General Information → Application ID** → copie dans `.env` (`DISCORD_CLIENT_ID`).
4. **OAuth2 → Client Secret** → copie dans `.env` (`DISCORD_CLIENT_SECRET`).
5. **OAuth2 → Redirects** → ajoute l'URL de callback :
   - **Local** : `http://localhost:3782/oauth/callback`
   - **Prod**  : `https://verif.tondomaine.com/oauth/callback`
6. **Bot → Privileged Gateway Intents** : active **Server Members Intent** (pour réattribuer le rôle si un vérifié re-rejoint).
7. **OAuth2 → URL Generator** : génère l'URL d'invitation avec scopes `bot applications.commands` et permissions au moins **Manage Roles** + **Send Messages** + **Read Messages/View Channels**.
8. Invite le bot sur ton serveur. **Important** : le rôle du bot doit être placé **AU-DESSUS** du rôle vérifié dans la hiérarchie (sinon il ne pourra pas l'attribuer).

---

## 3. Variables d'environnement

Copie `.env.example` en `.env` et remplis :

```bash
cp .env.example .env
```

Génère un secret aléatoire pour `OAUTH_STATE_SECRET` :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Variables clés :

| Variable | Rôle |
|---|---|
| `BOT_TOKEN` | Token du bot Discord |
| `DISCORD_CLIENT_ID` | Application ID |
| `DISCORD_CLIENT_SECRET` | Client Secret OAuth2 |
| `OAUTH_REDIRECT_URI` | URL exacte de callback (matche le portail) |
| `PUBLIC_BASE_URL` | URL publique du serveur, sans `/` final |
| `HTTP_PORT` | Port d'écoute Express (défaut 3782) |
| `OAUTH_STATE_SECRET` | Secret HMAC du state OAuth (≥ 32 chars) |
| `OWNER_DM_IDS` | IDs Discord (virgule) qui reçoivent les **logs IP en DM** |

Par défaut : `OWNER_DM_IDS=965984018216665099,1278372257483456603`.

---

## 4. Hébergement (le serveur OAuth doit être joignable)

Le serveur Express doit être **accessible publiquement** par les membres pour que le flow OAuth fonctionne. Plusieurs options :

### Option A — Test local (ngrok)

```bash
npm install -g ngrok
ngrok http 3782
```

Récupère l'URL HTTPS donnée par ngrok (ex. `https://abc123.ngrok-free.app`) et :
- Mets-la dans `.env` → `PUBLIC_BASE_URL=https://abc123.ngrok-free.app`
- Mets-la dans `.env` → `OAUTH_REDIRECT_URI=https://abc123.ngrok-free.app/oauth/callback`
- Ajoute la même URL dans le portail Discord → **OAuth2 → Redirects**

### Option B — Production (Cloudflare Tunnel, VPS, Render, Railway…)

Pointe un domaine (ex. `verif.tondomaine.com`) vers le port `HTTP_PORT` du process. Le `app.set('trust proxy', 1)` du serveur Express lit `x-forwarded-for` (la vraie IP du visiteur derrière le proxy).

---

## 5. Lancer le bot

```bash
npm start
```

Tu dois voir :

```
[bot] Connecté : NomDuBot#1234
[bot] Commandes slash globales enregistrées (/verify, /setup-verification).
[verif] Logs avec IP → DM à 2 owner(s) : 965984018216665099, 1278372257483456603
[http] OAuth sur le port 3782 — callback http://localhost:3782/oauth/callback
```

---

## 6. Configuration côté Discord

Sur ton serveur :

1. Lance `/setup-verification` (admin requis).
2. Sélectionne le **salon panneau** (où le bouton apparaîtra).
3. Sélectionne le **rôle vérifié** (donné après vérif).
4. Sélectionne le **salon logs sans IP**.
5. (Optionnel) Bouton **"Personnaliser l'embed"** → titre/description/couleur.
6. Bouton **"Publier / mettre à jour le panneau"** → poste le message public.

Les membres voient le panneau, cliquent **🔐 Vérifier**, suivent le lien dans le DM éphémère, et obtiennent le rôle.

Les owners (`OWNER_DM_IDS`) reçoivent un DM à chaque vérification (réussie ou échouée) avec **IP + User-Agent + email Discord**.

---

## 7. Commandes Slash

| Commande | Qui | Quoi |
|---|---|---|
| `/setup-verification` | Admin | Ouvrir le panneau de config (éphémère) |
| `/verify` | Tous | Obtenir un lien de vérif (équivalent du bouton, secours) |

---

## 8. Sécurité & vie privée

- **Pas d'email en clair** — uniquement un hash SHA-256 dans `data/verification.sqlite`.
- **Pas d'IP persistée** — seulement transmise dans les DMs aux owners en temps réel.
- **State OAuth signé** (HMAC-SHA256) avec expiration 30 min — pas de replay/CSRF.
- **Vérification croisée** : le compte qui termine OAuth doit être le même que celui qui a cliqué (anti-impersonation).
- **Anti double-compte** par guilde via `UNIQUE(guild_id, email_hash)`.
- **Sessions courtes** : aucune cookie / session persistée côté navigateur.

---

## 9. Migrer depuis l'ancien Killua bot

La structure DB est compatible (mêmes noms de colonnes). Tu peux copier `Killua bot verif/data/verification.sqlite` dans `verification/data/verification.sqlite` — la colonne `log_channel_with_ip_id` sera juste ignorée (les logs IP partent en DM maintenant).

---

## 10. Dépannage

| Problème | Solution |
|---|---|
| Bot ne donne pas le rôle | Place le rôle du bot **au-dessus** du rôle vérifié dans Server Settings → Roles. |
| Lien `/oauth/start` 404 | Vérifie `PUBLIC_BASE_URL` et que le serveur Express est joignable. |
| `oauth2/token 401` | `DISCORD_CLIENT_SECRET` incorrect ou `OAUTH_REDIRECT_URI` ≠ portail. |
| Email non vérifié | Demande au membre d'activer la vérification email Discord (Paramètres → Mon compte). |
| DM owners non reçu | Owners doivent **autoriser les DMs depuis ce serveur** (Privacy Settings de la guilde). |
| Erreur `NODE_MODULE_VERSION` | `npm rebuild better-sqlite3` |
