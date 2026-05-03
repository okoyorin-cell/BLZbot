# BLZ Verification — bot Discord standalone

Bot Discord **séparé** dédié à la vérification des membres :

- OAuth Discord avec récupération de l'**email vérifié** du membre (anti double-compte)
- Capture de l'**IP** du visiteur
- Détection **VPN/proxy/datacenter** (refus auto)
- Détection des **alts** par IP partagée
- Logs séparés : **embed sans IP/email en salon** + **DM aux owners avec IP + email + UA**
- Verrou **reverse proxy** (header `X-Verif-Proxy-Secret`) pour cacher l'IP du serveur

> ⚠️ Ce bot a son **propre token Discord** et sa **propre application Discord**, séparés du bot modération. Ils tournent en parallèle sur le même hébergement (Pebble).

---

## Architecture 2 bots

```
┌─────────────────────────────────────────────────────┐
│                    Hébergement Pebble                │
│                                                       │
│  ┌──────────────────┐      ┌──────────────────┐     │
│  │ Bot modération   │      │ Bot vérification │     │
│  │ (token A)        │      │ (token B)        │     │
│  │                  │      │                  │     │
│  │ - /ban /mute     │      │ - /verify        │     │
│  │ - /tickets       │      │ - /setup-verif   │     │
│  │ - /panel-deban   │      │ - bouton 🔐      │     │
│  │ - logs           │      │ - serveur OAuth  │     │
│  │ - anti-raid      │      │   port 3782      │     │
│  └──────────────────┘      └──────────────────┘     │
│         │                          │                 │
│         └────────┬─────────────────┘                 │
│                  ▼                                   │
│            Orchestrator                              │
│         (1 process, fork les 2)                      │
└─────────────────────────────────────────────────────┘
                  │
                  ▼ (port 3782, optionnellement derrière reverse proxy)
            Membres Discord
```

Pourquoi 2 bots séparés ?

- **Sessions Discord propres** : pas de conflit entre les boutons `verify:go` du panneau de vérif et le reste de la modération.
- **Permissions minimales** : le bot vérif n'a besoin que de `Manage Roles` + lecture, pas des perms de modération.
- **OAuth isolé** : le `DISCORD_CLIENT_SECRET` est dangereux — il vit dans une app Discord dédiée.
- **Crash isolé** : si le bot vérif crash, la modération continue de tourner (et inversement).

---

## 1. Installation

```bash
# Depuis la racine du repo BLZbot-main :
npm run verification:install
```

Ou depuis le dossier `verification/` :

```bash
cd verification
npm install
```

---

## 2. Création de l'app Discord (à faire UNE FOIS)

Sur https://discord.com/developers/applications :

1. Clique **New Application** → nom au choix (ex. « BLZ Verification »).
2. Onglet **Bot** :
   - **Reset Token** → copie → c'est `BOT_TOKEN`.
   - **Privileged Gateway Intents** → active **Server Members Intent**.
3. Onglet **General Information** :
   - **Application ID** → copie → c'est `DISCORD_CLIENT_ID`.
4. Onglet **OAuth2** :
   - **Reset Secret** → copie → c'est `DISCORD_CLIENT_SECRET`.
   - **Redirects** → ajoute l'URL de callback (cf. choix de l'URL ci-dessous).
5. Onglet **OAuth2 → URL Generator** :
   - Scopes : `bot`, `applications.commands`
   - Permissions : `Manage Roles`, `View Channels`, `Send Messages`, `Read Message History`
   - Copie l'URL → ouvre-la → invite le bot sur ton serveur.
6. Sur ton serveur Discord : place le **rôle du bot AU-DESSUS** du rôle vérifié dans Server Settings → Roles (sinon il ne pourra pas attribuer le rôle).

---

## 3. Choix de l'URL publique

Le serveur OAuth tourne sur le port `3782` (par défaut). Il doit être joignable depuis Internet pour que les membres puissent terminer le flow OAuth.

| Option | URL exemple | Setup | Cache l'IP de Pebble ? |
|---|---|---|---|
| **A. IP + port direct** | `http://145.239.X.X:3782/oauth/callback` | 0 min | ❌ Non |
| **B. Cloudflare Tunnel** ⭐ | `https://verify.tonsite.com/oauth/callback` | 30 min, gratuit | ✅ Oui |
| **C. VPS + Caddy + Cloudflare** | `https://verify.tonsite.com/oauth/callback` | 1h, ~3 €/mois | ✅ Oui |
| **D. ngrok (test local)** | `https://abc123.ngrok-free.app/oauth/callback` | 5 min | ✅ Oui (mais URL change) |

**Recommandation : Cloudflare Tunnel (gratuit + cache l'IP)**.

```bash
# Installer cloudflared sur Pebble (ou ton hosting) :
# https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/

cloudflared tunnel login
cloudflared tunnel create blz-verify
cloudflared tunnel route dns blz-verify verify.tonsite.com
cloudflared tunnel run --url http://localhost:3782 blz-verify
```

L'URL publique devient `https://verify.tonsite.com`. Reporte-la dans le portail Discord (OAuth2 → Redirects → `https://verify.tonsite.com/oauth/callback`).

---

## 4. Configuration `.env`

```bash
cd verification
cp .env.example .env
```

Édite `verification/.env` :

```env
# Obligatoire
BOT_TOKEN=<token de la nouvelle app Discord>
DISCORD_CLIENT_ID=<application ID>
DISCORD_CLIENT_SECRET=<client secret OAuth>
OAUTH_REDIRECT_URI=https://verify.tonsite.com/oauth/callback
PUBLIC_BASE_URL=https://verify.tonsite.com
HTTP_PORT=3782
HTTP_HOST=0.0.0.0

# Génère avec : node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
OAUTH_STATE_SECRET=<≥ 32 caractères aléatoires>

# Owners qui reçoivent les logs IP+email en DM (séparés par virgule)
OWNER_DM_IDS=965984018216665099,1278372257483456603

# Optionnel : verrou reverse proxy
# Génère avec : node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
VERIFY_PROXY_SECRET=
```

Si tu utilises Cloudflare Tunnel :

- `PUBLIC_BASE_URL=https://verify.tonsite.com`
- `OAUTH_REDIRECT_URI=https://verify.tonsite.com/oauth/callback`
- `HTTP_HOST=127.0.0.1` (le tunnel boucle en localhost, donc le port n'est plus exposé sur Internet)
- `VERIFY_PROXY_SECRET=` peut rester vide (le tunnel chiffre + cloisonne déjà — pas de port public à protéger)

---

## 5. Démarrage

### Option A — Avec l'orchestrator BLZ (recommandé sur Pebble)

Le bot vérif est ajouté au registre `orchestrator/maintemp.js` et démarre automatiquement avec les autres :

```bash
npm start
# Lance : modération + niveau + ia + verification
```

Pour ne lancer QUE le bot vérif :

```bash
BLZ_FORK_SERVICES=verification npm start
```

### Option B — Standalone (test local)

```bash
npm run verification:start
# ou
cd verification && npm start
```

Tu dois voir au boot :

```
[bot] Connecté : BLZVerification#0001
[bot] Commandes slash globales enregistrées (/verify, /setup-verification).
[verif] Logs avec IP → DM à 2 owner(s) : 965984018216665099, 1278372257483456603
[http] OAuth sur 0.0.0.0:3782 — callback https://verify.tonsite.com/oauth/callback
```

---

## 6. Configuration côté serveur Discord

Sur ton serveur :

1. Lance `/setup-verification` (admin requis).
2. Sélectionne :
   - **Salon panneau** : où le bouton 🔐 Vérifier sera publié
   - **Rôle vérifié** : attribué après vérification réussie
   - **Salon logs sans IP** : embed public avec géoloc + alts (sans IP/email)
3. (Optionnel) Bouton **« Personnaliser l'embed »** pour modifier titre/desc/couleur.
4. Bouton **« Publier / mettre à jour le panneau »** → poste le message public.

Les membres voient le panneau, cliquent **🔐 Vérifier**, suivent le lien dans le DM éphémère, et obtiennent le rôle.

Les owners (`OWNER_DM_IDS`) reçoivent un DM à chaque vérification (réussie ou échouée) avec :
- 🛰️ **IP** brute
- 📧 **Email Discord** vérifié
- 🖥️ **User-Agent** du navigateur
- 🌐 **Géolocalisation** + ISP
- 🔗 **Comptes liés** (si alts détectés)

---

## 7. Reverse proxy (optionnel mais recommandé)

Pour cacher l'IP du serveur d'hébergement (Pebble) et chiffrer le trafic :

### Avec Cloudflare Tunnel (gratuit)

Voir section 3 ci-dessus. Cloudflare Tunnel chiffre le trafic et masque l'IP de Pebble. Pas besoin de `VERIFY_PROXY_SECRET` car le tunnel boucle en `localhost`.

### Avec Caddy/nginx sur VPS

Configure `verification/.env` :

```env
HTTP_HOST=0.0.0.0
VERIFY_PROXY_SECRET=<long random hex 64>
```

Puis configure ton VPS Caddy pour qu'il ajoute le header :

```Caddyfile
verify.tonsite.com {
    reverse_proxy IP_PEBBLE:3782 {
        header_up X-Verif-Proxy-Secret "<même valeur que VERIFY_PROXY_SECRET>"
    }
}
```

→ Toute requête arrivant sur Pebble:3782 sans le bon header est rejetée en `403 Forbidden`.

Voir aussi `modération/deploy/reverse-proxy/` pour les configs détaillées (les mêmes principes s'appliquent).

---

## 8. Commandes Slash

| Commande | Qui | Quoi |
|---|---|---|
| `/setup-verification` | Admin | Ouvrir le panneau de config (éphémère) |
| `/verify` | Tous | Obtenir un lien de vérif (équivalent du bouton, secours) |

---

## 9. Sécurité & vie privée

- **Email en clair JAMAIS persisté** — uniquement un hash SHA-256 dans `data/verification.sqlite`. L'email en clair n'apparaît que dans le DM en temps réel aux owners.
- **IP JAMAIS persistée en clair** — uniquement un hash SHA-256 (pour la détection d'alts par IP).
- **State OAuth signé** (HMAC-SHA256) avec expiration 30 min — anti-replay/CSRF.
- **Anti-impersonation** : le compte qui termine OAuth doit être le même que celui qui a cliqué.
- **Anti double-compte** par guilde via `UNIQUE(guild_id, email_hash)`.
- **Détection VPN/proxy/datacenter** : refus automatique avant même OAuth.
- **Verrou reverse proxy** : si `VERIFY_PROXY_SECRET` ou `VERIFY_PROXY_IPS` configuré, toute requête venant directement (hors proxy) est rejetée 403.
- **Bind interface** : `HTTP_HOST=127.0.0.1` rend le port invisible depuis Internet (utile si proxy local).

---

## 10. Dépannage

| Problème | Solution |
|---|---|
| Bot ne donne pas le rôle | Place le rôle du bot **AU-DESSUS** du rôle vérifié dans Server Settings → Roles. |
| Lien `/oauth/start` 404 | Vérifie `PUBLIC_BASE_URL` et que le port 3782 est joignable. |
| `oauth2/token 401` | `DISCORD_CLIENT_SECRET` incorrect ou `OAUTH_REDIRECT_URI` ≠ portail. |
| OAuth réussi mais `400 Mauvais compte Discord` | L'utilisateur a switché de compte Discord entre le clic et le callback. |
| Email non vérifié | Demande au membre d'activer la vérif email Discord (Paramètres → Mon compte). |
| DM owners non reçu | Owners doivent **autoriser les DMs depuis ce serveur** (Privacy Settings de la guilde). |
| Erreur `NODE_MODULE_VERSION` (better-sqlite3) | `npm rebuild better-sqlite3 --prefix verification` |
| `403 Forbidden` après config proxy | Vérifie que le proxy injecte bien `X-Verif-Proxy-Secret` avec la même valeur que dans `.env`. Tester : `curl https://verify.tonsite.com/health` (doit renvoyer `ok`). |
| Bouton 🔐 Vérifier ne fait rien | Vérifie que le bot vérif tourne (`/health` répond ok) et que c'est bien le bot vérif, pas le bot modération, qui est invité avec le scope `bot`. |

---

## 11. Migration depuis l'ancien système intégré (modération)

Le système de vérif était précédemment intégré au bot modération (`modération/src/lib/verification/`). Il a été **complètement retiré** au profit de ce bot standalone.

Conséquences :

- ✅ Les commandes `/verify`, `/setup-verification`, `/unverify` n'existent plus côté bot modération (auto-supprimées de Discord au prochain déploiement slash via `LEGACY_COMMAND_NAMES_TO_REMOVE`).
- ✅ Les variables `OAUTH_STATE_SECRET`, `PUBLIC_BASE_URL`, `HTTP_PORT`, `OWNER_DM_IDS` du `.env` modération **ne sont plus lues** — elles vivent maintenant dans `verification/.env`.
- ⚠️ La DB `data/verification.sqlite` du bot modération est **différente** de celle du bot vérif (`verification/data/verification.sqlite`). Si tu veux conserver les vérifications existantes, copie le fichier :

```bash
cp modération/data/verification.sqlite verification/data/verification.sqlite
```

(Vérifie l'emplacement exact selon ton setup — la DB modération peut être ailleurs.)
