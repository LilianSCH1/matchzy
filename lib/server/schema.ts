// Schéma SQLite de Matchzy, appliqué à l'ouverture de la base (idempotent : « if not exists »).
// Identifiants en UUID (texte), horodatages en chaînes ISO UTC, dates en « AAAA-MM-JJ »,
// colonnes JSON en texte (décodées par lib/server/db.ts), booléens en 0/1.

const NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const SCHEMA = /* sql */ `
-- Règles de chaque sport (JSON piloté par l'application, voir lib/types.ts > SportRules)
create table if not exists sports (
  id text primary key,
  slug text not null unique,
  name text not null,
  rules text not null,
  is_preset integer not null default 0,
  created_at text not null default ${NOW},
  updated_at text not null default ${NOW}
);

create table if not exists tournaments (
  id text primary key,
  slug text not null unique,
  name text not null,
  date text not null,
  sport_id text references sports(id) on delete set null,
  sport_name text not null,
  -- Copie des règles du sport au moment de la création (modifiable pour ce tournoi)
  rules text not null,
  format text not null check (format in ('pools', 'pools_knockout', 'knockout')),
  timezone text not null default 'Europe/Paris',
  start_at text not null,
  match_duration integer not null check (match_duration > 0),
  break_duration integer not null default 0 check (break_duration >= 0),
  min_rest integer not null default 0 check (min_rest >= 0),
  qualifiers_per_pool integer not null default 0,
  best_extra integer not null default 0,
  third_place integer not null default 0,
  created_at text not null default ${NOW}
);

create table if not exists pools (
  id text primary key,
  tournament_id text not null references tournaments(id) on delete cascade,
  name text not null,
  position integer not null default 0
);
create index if not exists pools_tournament_idx on pools(tournament_id);

create table if not exists courts (
  id text primary key,
  tournament_id text not null references tournaments(id) on delete cascade,
  name text not null,
  position integer not null default 0
);
create index if not exists courts_tournament_idx on courts(tournament_id);

-- Codes arbitres : table séparée, jamais envoyée aux vues publiques
create table if not exists court_codes (
  court_id text primary key references courts(id) on delete cascade,
  tournament_id text not null references tournaments(id) on delete cascade,
  code text not null,
  unique (tournament_id, code)
);

-- Code participant de chaque tournoi (accès en lecture seule des participants et spectateurs).
create table if not exists tournament_access (
  tournament_id text primary key references tournaments(id) on delete cascade,
  code text not null
);

-- Tentatives de connexion (organisateur, codes arbitres et participants) : limite les essais par fenêtre de temps
create table if not exists login_attempts (
  key text primary key,
  count integer not null default 0,
  window_start integer not null
);

create table if not exists teams (
  id text primary key,
  tournament_id text not null references tournaments(id) on delete cascade,
  pool_id text references pools(id) on delete set null,
  name text not null,
  seed integer,
  -- Tirage au sort figé à la création : dernier critère de départage
  draw_lot real not null default (abs(random()) / 9223372036854775807.0),
  withdrawn integer not null default 0,
  fair_play integer not null default 0,
  created_at text not null default ${NOW}
);
create index if not exists teams_tournament_idx on teams(tournament_id);

create table if not exists matches (
  id text primary key,
  tournament_id text not null references tournaments(id) on delete cascade,
  phase text not null check (phase in ('pool', 'knockout')),
  pool_id text references pools(id) on delete cascade,
  round integer not null default 0,
  bracket_round integer,
  bracket_slot integer,
  label text,
  home_team_id text references teams(id) on delete set null,
  away_team_id text references teams(id) on delete set null,
  -- Provenance des équipes en phase finale : {type:'pool',poolId,rank} | {type:'best',rank,index}
  -- | {type:'winner'|'loser',matchId} | {type:'team',teamId}
  home_source text,
  away_source text,
  court_id text references courts(id) on delete set null,
  scheduled_at text,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'finished')),
  home_score integer,
  away_score integer,
  sets text,       -- [{home, away}, …]
  shootout text,   -- {home, away} : tirs au but / départage
  forfeit text check (forfeit in ('home', 'away', 'both')),
  winner_team_id text references teams(id) on delete set null,
  is_bye integer not null default 0,
  started_at text,
  finished_at text,
  updated_at text not null default ${NOW}
);
create index if not exists matches_tournament_idx on matches(tournament_id);
create index if not exists matches_court_idx on matches(court_id, scheduled_at);

create trigger if not exists matches_touch after update on matches for each row
  when new.updated_at = old.updated_at
  begin update matches set updated_at = ${NOW} where id = new.id; end;
create trigger if not exists sports_touch after update on sports for each row
  when new.updated_at = old.updated_at
  begin update sports set updated_at = ${NOW} where id = new.id; end;
`;
