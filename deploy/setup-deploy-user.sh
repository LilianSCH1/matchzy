#!/usr/bin/env bash
# Autorise l'utilisateur non-root « deploy » (partagé avec Bingezy) à déployer matchzy. À lancer UNE fois,
# en root, pour migrer depuis un déploiement en root. Relançable sans risque : chaque étape vérifie l'existant.
#
# Droits de deploy sur matchzy :
# - écriture dans /home/matchzy/app (rsync) ; l'app garde l'écriture dans server/ (cache disque de Next) ;
# - sudo sans mot de passe pour « systemctl restart matchzy », rien d'autre.
# La config Nginx et le service systemd s'installent à la main (matchzy-install-config, en root).
#
# Usage : bash setup-deploy-user.sh "ssh-ed25519 AAAA… github-actions-matchzy"
set -euo pipefail

DEPLOY_USER=deploy
APP_USER=matchzy
APP_DIR=/home/matchzy/app
DATA_DIR=/home/matchzy/data
HERE=$(cd "$(dirname "$0")" && pwd)
PUBLIC_KEY=${1:-}

[ "$(id -u)" -eq 0 ] || { echo "À lancer en root" >&2; exit 1; }
id "$APP_USER" >/dev/null 2>&1 || { echo "Lancer d'abord setup.sh" >&2; exit 1; }
case "$PUBLIC_KEY" in
  ssh-ed25519\ *) ;;
  *) echo "Usage : bash setup-deploy-user.sh \"ssh-ed25519 AAAA… commentaire\"" >&2; exit 1 ;;
esac

# 1. Utilisateur deploy (normalement déjà créé pour Bingezy), membre du groupe de l'app
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$DEPLOY_USER"
  passwd -l "$DEPLOY_USER" >/dev/null
fi
usermod -aG "$APP_USER" "$DEPLOY_USER"

# 2. Clé SSH de GitHub Actions pour ce dépôt, limitée à l'exécution de commandes
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
KEYS="/home/$DEPLOY_USER/.ssh/authorized_keys"
touch "$KEYS"
grep -qF "$PUBLIC_KEY" "$KEYS" || echo "restrict $PUBLIC_KEY" >> "$KEYS"
chown "$DEPLOY_USER:$DEPLOY_USER" "$KEYS"
chmod 600 "$KEYS"

# 3. Le code appartient à deploy. server/ reste modifiable par l'app (Next y écrit son cache),
# deploy/ est en lecture seule pour elle. La base reste à l'app seule.
mkdir -p "$APP_DIR" "$DATA_DIR"
chmod g+x /home/matchzy
chown -R "$DEPLOY_USER:$APP_USER" "$APP_DIR"
chmod -R u=rwX,g=rX,o= "$APP_DIR"
[ -d "$APP_DIR/server" ] && chmod -R g+w "$APP_DIR/server"
[ -f "$APP_DIR/.env" ] && chmod 640 "$APP_DIR/.env"
chown -R "$APP_USER:$APP_USER" "$DATA_DIR"
chmod 700 "$DATA_DIR"

# 4. sudo restreint à une commande exacte
command -v sudo >/dev/null || apt-get install -y sudo
SUDOERS=/etc/sudoers.d/matchzy-deploy
cat > "$SUDOERS.new" <<EOF
# Généré par deploy/setup-deploy-user.sh (matchzy) : droits root de l'utilisateur de déploiement
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart matchzy
EOF
chmod 440 "$SUDOERS.new"
visudo -cf "$SUDOERS.new" >/dev/null
mv "$SUDOERS.new" "$SUDOERS"

# 5. Installation de la config système : copie figée appartenant à root, hors de portée de deploy
install -m 755 "$HERE/install-config.sh" /usr/local/sbin/matchzy-install-config

echo "Utilisateur $DEPLOY_USER autorisé pour matchzy."
echo "Installer maintenant le service mis à jour (UMask) : matchzy-install-config"
