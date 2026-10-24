#!/usr/bin/env bash
# Installation initiale, à lancer UNE fois sur le VPS (en root), après avoir créé
# l'enregistrement DNS matchzy.neoheberg.fr et copié le dossier deploy/ sur le serveur.
# Usage : bash setup.sh
set -euo pipefail

DOMAIN=matchzy.neoheberg.fr
APP_USER=matchzy
APP_DIR=/home/matchzy/app
# Base SQLite : hors du dossier déployé, jamais touchée par rsync
DATA_DIR=/home/matchzy/data
PORT=3009

if [ ! -f /etc/systemd/system/matchzy.service ] && ss -ltn | grep -q ":$PORT "; then
  echo "Le port $PORT est déjà utilisé sur ce serveur : changer PORT dans setup.sh, deploy.sh, matchzy.service et nginx/matchzy.conf" >&2
  exit 1
fi

# Utilisateur dédié (sans shell), comme pour les autres sites
if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /home/matchzy/home --shell /usr/sbin/nologin "$APP_USER"
fi
mkdir -p "$APP_DIR" "$DATA_DIR" /var/www/certbot
chown -R "$APP_USER:$APP_USER" /home/matchzy

# 1. Site HTTP seul, le temps d'obtenir le certificat
cat > /etc/nginx/sites-available/matchzy.conf <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 404; }
}
EOF
ln -sf /etc/nginx/sites-available/matchzy.conf /etc/nginx/sites-enabled/matchzy.conf
nginx -t && systemctl reload nginx

# 2. Certificat Let's Encrypt (renouvelé automatiquement par le timer certbot existant)
certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --keep-until-expiring

echo "Prêt : créer $APP_DIR/.env (voir .env.example), puis lancer deploy/deploy.sh (il installe le service systemd matchzy)."
