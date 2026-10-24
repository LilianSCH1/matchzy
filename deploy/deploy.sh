#!/usr/bin/env bash
# Exécuté sur le VPS (en root) par GitHub Actions, après le rsync du serveur compilé
# dans /home/matchzy/app/server. Le premier déploiement suppose que setup.sh a été lancé
# et que /home/matchzy/app/.env existe.
set -euo pipefail

APP_DIR=/home/matchzy/app
DATA_DIR=/home/matchzy/data
APP_USER=matchzy
PORT=3009
UNIT=/etc/systemd/system/matchzy.service
NGINX_CONF=/etc/nginx/sites-available/matchzy.conf

if [ ! -f "$APP_DIR/.env" ]; then
  echo "$APP_DIR/.env manquant : DATA_DIR, ORGANIZER_PASSWORD et SESSION_SECRET (voir .env.example)" >&2
  exit 1
fi
mkdir -p "$DATA_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR" "$DATA_DIR"
chmod 700 "$DATA_DIR"
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

# Service systemd : n'installer que si l'unité du dépôt a changé, puis redémarrer
if ! cmp -s "$APP_DIR/deploy/matchzy.service" "$UNIT"; then
  cp "$APP_DIR/deploy/matchzy.service" "$UNIT"
  systemctl daemon-reload
  systemctl enable -q matchzy
fi
systemctl restart matchzy

# Next met quelques secondes à démarrer sur ce petit VPS.
for i in $(seq 1 20); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/health"; then
    echo "Matchzy en ligne"
    exit 0
  fi
  sleep 1
done
echo "Matchzy ne répond pas sur 127.0.0.1:$PORT" >&2
journalctl -u matchzy -n 40 --no-pager >&2 || true
exit 1
