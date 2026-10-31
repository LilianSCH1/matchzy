#!/usr/bin/env bash
# Installe la config Nginx et le service systemd de matchzy depuis /home/matchzy/app/deploy. À lancer À LA MAIN,
# en root, quand deploy.sh signale qu'un de ces fichiers a changé dans le dépôt.
#
# setup-deploy-user.sh en copie une version figée dans /usr/local/sbin/matchzy-install-config (propriété de root) :
# lancer cette copie, jamais celle du dossier de l'app, que l'utilisateur deploy peut réécrire.
# Chaque fichier est affiché (diff) et n'est installé qu'après confirmation : un service ou une config Nginx
# malveillants donneraient root.
# Usage : matchzy-install-config
set -euo pipefail

APP_DIR=/home/matchzy/app
NGINX_CONF=/etc/nginx/sites-available/matchzy.conf
UNIT=/etc/systemd/system/matchzy.service

[ "$(id -u)" -eq 0 ] || { echo "À lancer en root" >&2; exit 1; }

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# Copie d'abord le fichier dans un dossier de root : ce qui est relu est exactement ce qui sera installé.
# Renvoie 0 si le fichier a changé et que l'installation est confirmée.
review() {
  local source=$1 target=$2 copy="$work/$(basename "$1")"
  cp "$source" "$copy"
  if cmp -s "$copy" "$target"; then
    echo "$target : à jour"
    return 1
  fi
  diff -u "$([ -f "$target" ] && echo "$target" || echo /dev/null)" "$copy" || true
  read -rp "Installer cette version dans $target ? [o/N] " answer
  [ "$answer" = o ]
}

if review "$APP_DIR/deploy/nginx/matchzy.conf" "$NGINX_CONF"; then
  [ -f "$NGINX_CONF" ] && cp "$NGINX_CONF" "$NGINX_CONF.bak"
  install -m 644 "$work/matchzy.conf" "$NGINX_CONF"
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

if review "$APP_DIR/deploy/matchzy.service" "$UNIT"; then
  install -m 644 "$work/matchzy.service" "$UNIT"
  systemctl daemon-reload
  systemctl enable -q matchzy
  # Avant le premier déploiement, le serveur n'est pas encore là : il démarrera au premier restart.
  if [ -f "$APP_DIR/server/server.js" ]; then
    systemctl restart matchzy
    echo "Service matchzy mis à jour et relancé"
  fi
fi
