#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# setup-vps.sh — installe Caddy via Docker et configure le reverse proxy
# ─────────────────────────────────────────────────────────────────────────────
# Cible : Oracle Cloud Free Tier (Ubuntu 22.04+) ou Hetzner / DigitalOcean.
# Usage :
#   ssh ubuntu@<IP_DU_VPS>
#   wget https://raw.githubusercontent.com/<TON_REPO>/main/modération/deploy/reverse-proxy/setup-vps.sh
#   chmod +x setup-vps.sh
#   sudo DOMAIN=verif.tondomaine.com PEBBLE_IP=1.2.3.4 PEBBLE_PORT=3782 SECRET=$(openssl rand -hex 32) ./setup-vps.sh
#
# Ce script :
#  - installe Docker + Compose
#  - télécharge Caddyfile + docker-compose.yml
#  - injecte tes valeurs (DOMAIN, PEBBLE_IP, SECRET)
#  - démarre le proxy
#  - configure le firewall (ports 80/443)
#  - imprime la valeur du SECRET à coller côté Pebble (.env)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ─── Vérification des variables d'environnement ──────────────────────────
require_env() {
    local name="$1"
    if [[ -z "${!name:-}" ]]; then
        echo "❌ Variable manquante : $name"
        echo "   Exemple : sudo DOMAIN=verif.tondomaine.com PEBBLE_IP=1.2.3.4 SECRET=\$(openssl rand -hex 32) ./setup-vps.sh"
        exit 1
    fi
}
require_env DOMAIN
require_env PEBBLE_IP
require_env SECRET
PEBBLE_PORT="${PEBBLE_PORT:-3782}"
INSTALL_DIR="${INSTALL_DIR:-/opt/verif-proxy}"

if [[ "$EUID" -ne 0 ]]; then
    echo "❌ Lance ce script avec sudo."
    exit 1
fi

echo "🔧 Configuration :"
echo "   DOMAIN      = $DOMAIN"
echo "   PEBBLE_IP   = $PEBBLE_IP"
echo "   PEBBLE_PORT = $PEBBLE_PORT"
echo "   INSTALL_DIR = $INSTALL_DIR"
echo "   SECRET      = (longueur ${#SECRET}, OK)"
echo ""

# ─── 1. Mise à jour + dépendances de base ────────────────────────────────
echo "📦 Mise à jour APT…"
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg ufw jq

# ─── 2. Docker ────────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
    echo "🐳 Installation de Docker…"
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
else
    echo "🐳 Docker déjà installé."
fi

# ─── 3. Création du dossier + fichiers ───────────────────────────────────
echo "📁 Préparation de $INSTALL_DIR…"
mkdir -p "$INSTALL_DIR"
mkdir -p /var/log/caddy

# Caddyfile (avec valeurs interpolées)
cat > "$INSTALL_DIR/Caddyfile" <<EOF
$DOMAIN {
    encode zstd gzip

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "no-referrer"
        X-Robots-Tag "noindex, nofollow, noarchive"
        -Server
    }

    reverse_proxy http://$PEBBLE_IP:$PEBBLE_PORT {
        header_up X-Verif-Proxy-Secret "$SECRET"
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up Host {host}

        transport http {
            dial_timeout 10s
            response_header_timeout 30s
            read_timeout 30s
        }
    }

    log {
        output file /var/log/caddy/verif.log {
            roll_size 10mb
            roll_keep 5
        }
        format json
        level INFO
    }
}
EOF

# docker-compose.yml
cat > "$INSTALL_DIR/docker-compose.yml" <<'EOF'
services:
  caddy:
    image: caddy:2-alpine
    container_name: verif-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
      - /var/log/caddy:/var/log/caddy
    networks:
      - verif-net

networks:
  verif-net:
    driver: bridge

volumes:
  caddy_data:
  caddy_config:
EOF

# ─── 4. Firewall ─────────────────────────────────────────────────────────
echo "🛡️  Configuration UFW (ports 22/80/443)…"
ufw --force allow 22/tcp || true
ufw --force allow 80/tcp || true
ufw --force allow 443/tcp || true
ufw --force enable || true

# ─── 5. Démarrage ────────────────────────────────────────────────────────
echo "🚀 Démarrage Caddy…"
cd "$INSTALL_DIR"
docker compose pull
docker compose up -d

sleep 3
docker compose ps

# ─── 6. Récap ────────────────────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────────────────────────────────"
echo "✅ Reverse proxy installé."
echo ""
echo "🌐 URL publique : https://$DOMAIN"
echo "   (HTTPS sera prêt en quelques secondes — Caddy demande le certif)"
echo ""
echo "🔑 SECRET à coller dans le .env de ton bot Pebble :"
echo "   VERIFY_PROXY_SECRET=$SECRET"
echo ""
echo "Et mets aussi côté Pebble :"
echo "   PUBLIC_BASE_URL=https://$DOMAIN"
echo "   HTTP_PORT=$PEBBLE_PORT   # déjà là probablement"
echo ""
echo "Logs en temps réel :  docker compose -f $INSTALL_DIR/docker-compose.yml logs -f"
echo "Logs Caddy fichier :  /var/log/caddy/verif.log"
echo "Restart proxy      :  docker compose -f $INSTALL_DIR/docker-compose.yml restart"
echo "─────────────────────────────────────────────────────────────────────"
