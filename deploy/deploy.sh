#!/usr/bin/env bash
# Exécuté sur le VPS (en root) par GitHub Actions, après le rsync du serveur compilé
# dans /home/matchzy/app/server. Le premier déploiement suppose que setup.sh a été lancé
# et que /home/matchzy/app/.env existe.
set -euo pipefail

APP_DIR=/home/matchzy/app
APP_USER=matchzy
PORT=3009
PM2="runuser -u $APP_USER -- env HOME=/home/matchzy/home PM2_HOME=/home/matchzy/home/.pm2 pm2"
NGINX_CONF=/etc/nginx/sites-available/matchzy.conf

if [ ! -f "$APP_DIR/.env" ]; then
  echo "$APP_DIR/.env manquant : DATABASE_URL, ORGANIZER_PASSWORD et SESSION_SECRET (voir .env.example)" >&2
  exit 1
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod 600 "$APP_DIR/.env"

# Nginx : n'installer et recharger que si la config du dépôt a changé
if ! cmp -s "$APP_DIR/deploy/nginx/matchzy.conf" "$NGINX_CONF"; then
  [ -f "$NGINX_CONF" ] && cp "$NGINX_CONF" "$NGINX_CONF.bak"
  cp "$APP_DIR/deploy/nginx/matchzy.conf" "$NGINX_CONF"
  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/matchzy.conf
  if nginx -t; then
    systemctl reload nginx
    echo "Nginx : configuration mise à jour"
  else
    if [ -f "$NGINX_CONF.bak" ]; then
      mv "$NGINX_CONF.bak" "$NGINX_CONF"
    else
      rm -f "$NGINX_CONF" /etc/nginx/sites-enabled/matchzy.conf
    fi
    echo "Nginx : configuration invalide, ancienne version restaurée" >&2
    exit 1
  fi
fi

cd "$APP_DIR"
# Recharge l'ecosystem (et donc les options node) à chaque déploiement.
$PM2 delete matchzy >/dev/null 2>&1 || true
$PM2 start deploy/ecosystem.config.js
$PM2 save

# Next met quelques secondes à démarrer sur ce petit VPS.
for i in $(seq 1 20); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/health"; then
    echo "Matchzy en ligne"
    exit 0
  fi
  sleep 1
done
echo "Matchzy ne répond pas sur 127.0.0.1:$PORT" >&2
$PM2 logs matchzy --lines 40 --nostream >&2 || true
exit 1
