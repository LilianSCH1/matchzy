#!/usr/bin/env bash
# Exécuté sur le VPS par GitHub Actions, en tant qu'utilisateur deploy (non-root), après le rsync du serveur
# compilé dans /home/matchzy/app/server. Suppose que setup.sh et setup-deploy-user.sh ont été lancés
# et que /home/matchzy/app/.env existe.
#
# deploy n'a droit, via sudo, qu'à « systemctl restart matchzy ». La config Nginx et le service systemd
# s'installent à la main (matchzy-install-config, en root) : les laisser écrire par deploy lui donnerait root.
set -euo pipefail

APP_DIR=/home/matchzy/app
PORT=3009
UNIT=/etc/systemd/system/matchzy.service
NGINX_CONF=/etc/nginx/sites-available/matchzy.conf

if [ ! -f "$APP_DIR/.env" ]; then
  echo "$APP_DIR/.env manquant : DATA_DIR, ORGANIZER_PASSWORD et SESSION_SECRET (voir .env.example)" >&2
  exit 1
fi
# .env : lisible par l'app seule (rsync ne le touche pas, il est hors des dossiers envoyés)
[ -O "$APP_DIR/.env" ] && chmod 640 "$APP_DIR/.env"

# Config système modifiée dans le dépôt : avertissement dans GitHub Actions, à installer en root
for pair in "deploy/nginx/matchzy.conf:$NGINX_CONF" "deploy/matchzy.service:$UNIT"; do
  if ! cmp -s "$APP_DIR/${pair%%:*}" "${pair#*:}"; then
    echo "::warning::${pair%%:*} diffère de ${pair#*:} : lancer en root « matchzy-install-config » après relecture"
  fi
done

sudo -n systemctl restart matchzy

# Next met quelques secondes à démarrer sur ce petit VPS.
for i in $(seq 1 20); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/health"; then
    echo "Matchzy en ligne"
    exit 0
  fi
  sleep 1
done
echo "Matchzy ne répond pas sur 127.0.0.1:$PORT" >&2
# Nécessite que deploy soit dans le groupe systemd-journal (optionnel)
journalctl -u matchzy -n 40 --no-pager >&2 || true
exit 1
