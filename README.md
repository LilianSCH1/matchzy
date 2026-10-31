# Matchzy — gestion sportive d'un tournoi le jour J

Application web mobile d'abord pour dérouler un tournoi : création, poules, planning, saisie des scores au bord du terrain, classements en direct et phase finale. Pas d'inscriptions, de budget ni de logistique : uniquement le sportif.

**Stack :** Next.js 15 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 · SQLite intégré à Node (`node:sqlite`, aucune dépendance), comme Team Sezen.

---

## Démarrage

```bash
npm install
cp .env.example .env         # puis compléter
npm run db:migrate           # facultatif : crée la base et les sports (l'app le fait aussi au démarrage)
npm run dev                  # http://localhost:3000
```

### Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `DATA_DIR` | Dossier de la base SQLite `matchzy.db`. Vide en développement : `./data` à la racine du projet |
| `ORGANIZER_PASSWORD` | Mot de passe de l'organisateur |
| `SESSION_SECRET` | Secret de signature des cookies de session (chaîne aléatoire longue) |

### Base de données (SQLite)

La base est un simple fichier, `DATA_DIR/matchzy.db`, géré par le module SQLite intégré à Node (≥ 22.13), sans serveur ni dépendance à installer. Elle est créée au premier démarrage avec son schéma (`lib/server/schema.ts`) et les **9 préréglages de sports** ; les préréglages déjà présents ne sont jamais écrasés.

Le client (`lib/server/db.ts`) garde une syntaxe de requêtes en gabarits (`` sql`select … ${valeur}` ``), convertit les colonnes JSON et booléennes, et sérialise les transactions.

La base n'est jamais exposée au navigateur : toutes les lectures et écritures passent par le serveur Next.js.

### Données de démo

- **`npm run seed`** (lit `.env`, puis `.env.local` s'il existe), ou le bouton **« Créer les tournois de démo »** sur l'accueil une fois connecté comme organisateur.
- Cela crée un **tournoi de foot à 14 équipes** (4 poules de 4-4-3-3, 3 terrains, 2 qualifiés par poule, quarts, petite finale) et un **tournoi de volley à 10 équipes** (2 poules de 5, 2 terrains, demies et finale).
- Le coup d'envoi est fixé à « il y a 70 minutes » : il y a donc déjà des matchs terminés, des matchs en cours et des matchs à venir.
- Les codes arbitres s'affichent dans la console, ou dans **Organiser → Règles & accès**.

### Tests

```bash
npm test           # logique métier (Berger, poules, tableau, scores, classements, recalculs, règles, assistant)
npm run typecheck  # vérification TypeScript
npm run lint       # ESLint (règles Next.js et React)
```

La CI GitHub (`.github/workflows/ci.yml`) lance ces trois commandes puis `next build` à chaque push et pull request.

```bash
```

---

## Accès

| Rôle | Accès | Ce qu'il peut faire |
| --- | --- | --- |
| **Organisateur** | `/login` avec `ORGANIZER_PASSWORD` | Créer des tournois, configurer les sports, tableau de bord, planning, équipes, corrections, saisie sur tous les terrains |
| **Arbitre / table de marque** | `/t/<tournoi>/arbitre` avec le **code à 6 chiffres de son terrain** | Voir les matchs de son terrain, saisir et corriger les scores, déclarer un forfait |
| **Participants et public** | Accueil → « Rejoindre un tournoi » avec le **nom du tournoi** (son identifiant, ex. `tournoi-volley-nancy`) et le **code participant** à 6 caractères | Même affichage pour tous, en lecture seule et en direct : `/t/<tournoi>` et l'écran géant `/t/<tournoi>/ecran`. Aucune saisie de score |

Le nom du tournoi et le code participant sont donnés à l'organisateur à la création (tableau de bord et **Règles & accès**, avec un message prêt à copier). Le code est stocké à part (table `tournament_access`), comme les codes arbitres. Une fois le code saisi, l'appareil est mémorisé (cookie signé longue durée) et le tournoi rejoint s'ajoute à **« Mes tournois »**, une liste gardée dans le navigateur (`localStorage`) : elle reste tant que l'on garde le même appareil, et chaque tournoi peut en être retiré. Les visiteurs ne voient jamais la liste complète des tournois.

Les sessions sont des cookies `httpOnly` signés en HMAC. Les codes arbitres (6 chiffres tirés au hasard cryptographique) sont dans la table `court_codes` et ne sont affichés que dans l'espace organisateur.

Les connexions sont limitées (table `login_attempts`) : 8 essais de mot de passe organisateur par adresse IP et par quart d'heure ; pour les codes arbitres, 10 essais par adresse IP et par quart d'heure, et 200 par tournoi et par heure ; pour les codes participants, 20 essais par adresse IP et par quart d'heure. Les règles envoyées par le navigateur sont validées côté serveur (`lib/rules.ts`).

---

## Fonctionnalités

### 1. Création d'un tournoi (`/nouveau`)

L'assistant se déroule en 4 étapes :

1. **Tournoi** : nom, date, heure de début, sport (préréglage ou « Personnalisé »), nombre de terrains, durée d'un match, pause entre deux matchs, repos minimum d'une équipe.
2. **Équipes** : saisie ou collage (une par ligne), de 3 à 64 équipes. L'ordre de la liste sert de classement des têtes de série.
3. **Format** :
   - **Poules seules**, **poules + phase finale** (qualifiés par poule et meilleurs Nᵉˢ éventuels, petite finale en option) ou **élimination directe**.
   - L'application propose un nombre de poules pour une taille visée de 3, 4 ou 5 équipes. Seules les répartitions où chaque poule compte entre 3 et 5 équipes sont proposées, avec des poules équilibrées (écart d'une équipe au plus).
   - La répartition peut être **aléatoire**, **par têtes de série** (en serpentin) ou modifiée **à la main par glisser-déposer**, qui fonctionne aussi au toucher.
   - L'aperçu affiche en direct le nombre de matchs, la **durée totale estimée**, l'heure de fin et la taille du tableau avec ses exemptions. Il s'appuie sur le vrai planificateur.
4. **Validation** : l'application génère les poules, les matchs, le tableau et le planning.

### 2. Règles par sport

Chaque sport stocke un objet `SportRules` en JSON (voir `lib/types.ts`). Il est modifiable dans **Sports & règles** pour les modèles et dans **Règles & accès** pour un tournoi donné, qui garde sa propre copie des règles. Ces règles pilotent :

- le **type de score** : buts, points ou sets, et les boutons « + » (+1 ; +1/+2/+3 au basket ; +2/+3/+5/+7 au rugby) ;
- l'autorisation du **match nul** ;
- le **barème** : victoire, nul, défaite, forfait, et barème volley au set décisif (3-0/3-1 → 3-0 pts, 3-2 → 2-1 pts) ;
- les **sets** : sets gagnants, points par set, set décisif écourté, écart minimum, plafond ;
- le **départage en phase finale** : tirs au but, prolongation, prolongation puis tirs au but, ou set décisif ;
- les **critères de départage du classement**, dans un ordre modifiable : points, confrontation directe, différence, marqués, différence et quotient de sets, quotient de points, victoires, fair-play. Le **tirage au sort** reste le dernier recours ;
- le **score de forfait** par défaut ;
- les **libellés** : but/point, terrain/court/table, set/manche.

**Préréglages fournis :** football, futsal, handball, basketball, volleyball, badminton, tennis de table, rugby à 7 et personnalisé.

### 3. Génération des matchs

- **Toutes rondes (Berger)** dans chaque poule, par la méthode du cercle. Une équipe fictive est ajoutée si le nombre d'équipes est impair, avec alternance domicile/extérieur (`lib/roundrobin.ts`).
- **Planning automatique** (`lib/schedule.ts`) : créneaux de *durée + pause* répartis sur les terrains. Une équipe ne joue jamais deux matchs à la fois et respecte son repos minimum. Les rondes sont jouées dans l'ordre. Chaque match va sur le terrain que ses deux équipes ont le moins utilisé.
- **Tableau** (`lib/bracket.ts`) :
  - placement standard des têtes de série (1 contre N, 2 contre N−1…) ;
  - **exemptions** pour les meilleures têtes de série quand le nombre de qualifiés n'est pas une puissance de 2 ;
  - **croisement des poules** (1ᵉʳ A contre 2ᵉ D…), avec échange automatique si deux équipes d'une même poule se retrouvent face à face au premier tour ;
  - petite finale en option, jouée juste avant la finale.
- Les matchs de phase finale sont planifiés tour par tour après les poules.
- **Planning modifiable** (Organiser → Planning) : changer l'horaire ou le terrain d'un match, décaler aussi les matchs suivants du même terrain, échanger deux matchs (⇄). Les conflits (même équipe ou même terrain sur des créneaux qui se chevauchent) sont signalés.

### 4. Pendant le tournoi

- **Saisie des scores** (`/t/<tournoi>/match/<id>`) :
  - grand écran tactile avec de gros boutons +/−, ou saisie **set par set** avec détection de la fin du set ;
  - statut *Programmé → En cours → Terminé* ;
  - pendant le match, le score est enregistré en direct, ce qui rafraîchit l'écran public ;
  - en phase finale, un match nul fait apparaître la saisie des tirs au but, ou impose la prolongation selon le sport ;
  - **forfait** simple ou double, avec le score par défaut du sport.
- **Classements** recalculés à chaque affichage à partir des résultats, avec les critères du sport. La confrontation directe est calculée sur le mini-championnat des équipes à égalité et réappliquée en cascade. Les égalités parfaites sont tranchées par un tirage au sort figé à la création de l'équipe (🎲).
- **Recalcul automatique** (`lib/resolve.ts`) après chaque score, correction, forfait ou abandon :
  - quand toutes les poules sont terminées, les qualifiés (y compris les meilleurs Nᵉˢ) remplissent le tableau ;
  - les vainqueurs avancent et les perdants des demies vont en petite finale ;
  - les exemptés passent directement au tour suivant.
- **Écritures concurrentes** : chaque score, forfait ou correction est enregistré et recalculé dans une seule transaction qui verrouille le tournoi (`withTournamentLock`, les transactions SQLite sont exécutées l'une après l'autre). Deux terrains qui valident en même temps ne peuvent pas produire un tableau incohérent.
- **Corrections** : un score corrigé met à jour le classement et le tableau. Si le qualifié ou le vainqueur change, les matchs de phase finale qui en dépendent sont remis à « Programmé » avec les bonnes équipes.
- **Abandon** d'une équipe (Organiser → Équipes) : ses matchs non joués sont perdus par forfait et elle est classée dernière de sa poule. Une réintégration reste possible.
- **Retards** : le tableau de bord affiche le retard de chaque terrain et propose un bouton « Décaler +5 » qui repousse le prochain match et tous les suivants.

### 5. Vues

| Vue | URL | Contenu |
| --- | --- | --- |
| Accueil | `/` | Liste des tournois, création, démo |
| Public | `/t/<tournoi>` | Onglets En direct, Classements, Phase finale, Programme (filtrable par équipe) |
| Écran géant | `/t/<tournoi>/ecran` | Matchs en cours, à suivre, classements et arbre qui défilent toutes les 15 s, horloge |
| Arbitre | `/t/<tournoi>/arbitre` | Matchs de son terrain (l'organisateur peut changer de terrain) |
| Organisateur | `/t/<tournoi>/admin` | Tableau de bord, Planning, Équipes, Règles & accès (codes arbitres, règles, suppression) |
| Sports | `/sports` | Édition des préréglages et création de sports |

Le **rafraîchissement en direct** recharge les données de la page toutes les 5 s (10 s dans l'espace organisateur), seulement quand l'onglet est visible, et immédiatement quand le téléphone se rallume. Seules les données sont rechargées : la page ne clignote pas et ne perd pas sa position. Les données d'un tournoi sont **mises en cache** côté serveur et invalidées à chaque écriture (`lib/server/page.ts`) : le nombre de spectateurs ne multiplie pas les requêtes à la base.

Sur l'écran de saisie, une coupure réseau n'efface rien : le score en direct est renvoyé automatiquement toutes les 3 s (« Hors ligne · nouvel essai… ») et le navigateur prévient avant de quitter la page tant qu'il n'est pas enregistré.

### 6. Interface intelligente

- **Assistant de l'organisateur** (`lib/insights.ts`, tableau de bord) : retard **projeté** de chaque terrain (un match en cours qui déborde retarde le suivant avant même son heure), proposition de décalage en un geste (« Décaler de 10 min »), match en cours depuis trop longtemps (« score à valider ? »), conflits d'équipe ou de terrain et repos trop court, terrain libre pendant qu'un autre accumule du retard, poules presque terminées, égalités tirées au sort, abandons, coup d'envoi imminent. Hors du jour du tournoi, aucun retard n'est calculé ; les matchs restés ouverts sont signalés.
- **Terrains en direct** : une carte par terrain avec le match en cours, les suivants, le retard et « +5 min ». Indicateurs : progression, matchs en cours, retard maximal, **fin projetée** comparée au planning.
- **Palette de commandes** (`Ctrl K`, `⌘K` ou `/`, partout) : recherche sans accents d'une page, d'une équipe ou d'un match (`lib/commands.ts`). Chaque page déclare ses commandes avec `<Commands groups={…} />`.
- **Mon équipe** (vue publique) : le spectateur choisit son équipe, mémorisée sur son téléphone, et voit son prochain match (avec compte à rebours), son dernier résultat, sa position et sa forme (`lib/follow.ts`).
- **Thème** clair, sombre ou système, mémorisé (`data-theme` sur `<html>`, sans flash au chargement).
- **Navigation** : barre latérale et barre d'onglets en bas d'écran sur mobile dans l'espace organisateur ; onglets à portée de pouce sur la vue publique ; programme regroupé par créneau horaire ; écran géant avec tableaux d'affichage par terrain et bandeau de résultats défilant.

### Cas limites gérés

| Cas | Traitement |
| --- | --- |
| Nombre d'équipes impair | Exemption tournante dans les rondes de Berger |
| Poules de tailles inégales | Le classement des meilleurs Nᵉˢ compare les moyennes par match |
| Égalités parfaites | Critères successifs, puis tirage au sort |
| Tableau incomplet | Exemptions (byes) |
| Forfait | Simple ou double |
| Abandon en cours de tournoi | Forfaits automatiques sur les matchs restants, équipe classée dernière |
| Correction d'un résultat en amont d'un match de phase finale déjà joué | Le match dépendant est remis à « Programmé » avec les bonnes équipes |

---

## Architecture

```
app/
  actions.ts              Server Actions (accès, création, scores, planning, équipes, règles)
  page.tsx                Accueil
  nouveau/                Assistant de création
  sports/                 Édition des sports
  t/[slug]/               Vue publique, écran géant, arbitre, saisie, organisation
components/               UI (ScoreScreen, TournamentWizard, Bracket, StandingsTable, …)
lib/
  types.ts                Modèle de données et SportRules
  sports.ts               Préréglages
  pools.ts                Proposition et répartition des poules
  roundrobin.ts           Tables de Berger
  schedule.ts             Planificateur créneaux × terrains
  bracket.ts              Tableau à élimination directe
  scoring.ts              Validation, vainqueur, barème, forfaits
  standings.ts            Classements et départages
  resolve.ts              Recalcul : forfaits, qualifiés, avancement du tableau
  insights.ts             Assistant : état des terrains, retards projetés, conflits, fin projetée
  follow.ts               Résumé par équipe pour « Mon équipe »
  commands.ts             Index et recherche de la palette de commandes
  build.ts                Construction complète d'un tournoi (pur, utilisé aussi pour l'aperçu)
  server/                 Connexion Postgres, sessions, persistance, démo
lib/server/schema.ts      Schéma SQLite (idempotent, appliqué à l'ouverture de la base)
scripts/migrate.ts        Applique le schéma et les préréglages
scripts/seed.ts           Jeu de démo
tests/                    Tests unitaires (Vitest)
```

Toute la logique sportive est écrite en **fonctions pures**, testables et partagées entre le client (aperçu de l'assistant) et le serveur. La base stocke les résultats bruts et la provenance des places du tableau (`home_source` / `away_source` : « 1ᵉʳ poule A », « vainqueur Quart 2 », « meilleur 3ᵉ n°1 »…). Les classements et l'avancement du tableau en sont toujours **déduits**, ce qui rend les corrections sûres.

Les préréglages de sports sont définis dans `lib/sports.ts` et insérés à l'ouverture de la base (seulement s'ils n'existent pas encore).

---

## Mise en ligne (VPS Neoheberg)

Production : **https://matchzy.neoheberg.fr**, sur le même VPS que Bingezy (Cloudflare → Nginx → systemd).

| | |
| --- | --- |
| Utilisateur Linux / dossier | `matchzy` · `/home/matchzy/app` |
| Port local | `3009` (Nginx en reverse proxy, HTTPS Let's Encrypt) |
| Serveur | Next en mode `standalone` dans `/home/matchzy/app/server`, lancé par le service systemd `matchzy` (`deploy/matchzy.service`, redémarrage auto, 300 Mo max) |
| Secrets | `/home/matchzy/app/.env` (`deploy:matchzy`, chmod 640), lu par `node --env-file` ; jamais envoyé par GitHub |
| Base | `/home/matchzy/data/matchzy.db` (SQLite, `DATA_DIR` dans le `.env`) |

Le VPS n'a que 512 Mo de mémoire : **le build se fait dans GitHub Actions** (`.github/workflows/deploy.yml`), qui envoie le serveur compilé par `rsync` puis lance `deploy/deploy.sh` (redémarrage du service, vérification de `/health`). Le déploiement part à chaque push sur `master`, ou à la main depuis l'onglet *Actions*.

Le workflow a besoin, dans les réglages du dépôt, des variables `SSH_HOST` et `SSH_HOST_FINGERPRINT` (mêmes valeurs que Bingezy) et du secret `SSH_PRIVATE_KEY_B64` (clé propre à ce dépôt).

**Déploiement non-root.** GitHub Actions se connecte avec l'utilisateur `deploy` (partagé avec Bingezy), jamais en root :
- `deploy` possède `/home/matchzy/app` et appartient au groupe `matchzy`. `server/` reste modifiable par l'app, car Next y écrit son cache ; le service a `UMask=0007` pour que `deploy` puisse remplacer ces fichiers ;
- sudo sans mot de passe pour `systemctl restart matchzy` uniquement (`/etc/sudoers.d/matchzy-deploy`) ;
- la config Nginx et le service systemd ne sont plus installés au déploiement (ils donneraient root à `deploy`). Quand ils changent, le workflow affiche un avertissement : lancer en root `matchzy-install-config`, qui montre le diff puis installe après confirmation.

Mise en place (une fois, en root) : `bash deploy/setup-deploy-user.sh "<clé publique ssh-ed25519>"`, puis `matchzy-install-config`.

La base SQLite est dans `/home/matchzy/data/matchzy.db`, hors du dossier déployé : un déploiement n'y touche jamais. Le schéma est appliqué par l'application à son démarrage. Sauvegarde à chaud, avec le Node du VPS (pas besoin du client `sqlite3`) :

```bash
node -e "new (require('node:sqlite').DatabaseSync)('/home/matchzy/data/matchzy.db').exec(\"VACUUM INTO '/root/matchzy-$(date +%F).db'\")"
```

```bash
systemctl status matchzy
journalctl -u matchzy -n 100 --no-pager
systemctl restart matchzy            # après une modif du .env
curl -i http://127.0.0.1:3009/health
```
