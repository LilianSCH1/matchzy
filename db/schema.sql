-- Matchzy : schéma PostgreSQL (Neon ou tout Postgres ≥ 13).
-- Idempotent : appliqué par `npm run db:migrate`, qui ajoute aussi les préréglages de sports.


-- Règles de chaque sport (JSON piloté par l'application, voir lib/types.ts > SportRules)
create table if not exists public.sports (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  rules jsonb not null,
  is_preset boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  date date not null,
  sport_id uuid references public.sports(id) on delete set null,
  sport_name text not null,
  -- Copie des règles du sport au moment de la création (modifiable pour ce tournoi)
  rules jsonb not null,
  format text not null check (format in ('pools', 'pools_knockout', 'knockout')),
  timezone text not null default 'Europe/Paris',
  start_at timestamptz not null,
  match_duration int not null check (match_duration > 0),
  break_duration int not null default 0 check (break_duration >= 0),
  min_rest int not null default 0 check (min_rest >= 0),
  qualifiers_per_pool int not null default 0,
  best_extra int not null default 0,
  third_place boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.pools (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null,
  position int not null default 0
);
create index if not exists pools_tournament_idx on public.pools(tournament_id);

create table if not exists public.courts (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null,
  position int not null default 0
);
create index if not exists courts_tournament_idx on public.courts(tournament_id);

-- Codes arbitres : table séparée, jamais envoyée aux vues publiques
create table if not exists public.court_codes (
  court_id uuid primary key references public.courts(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  code text not null,
  unique (tournament_id, code)
);

-- Tentatives de connexion (organisateur, codes arbitres) : limite les essais par fenêtre de temps
create table if not exists public.login_attempts (
  key text primary key,
  count int not null default 0,
  window_start timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  pool_id uuid references public.pools(id) on delete set null,
  name text not null,
  seed int,
  -- Tirage au sort figé à la création : dernier critère de départage
  draw_lot double precision not null default random(),
  withdrawn boolean not null default false,
  fair_play int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists teams_tournament_idx on public.teams(tournament_id);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  phase text not null check (phase in ('pool', 'knockout')),
  pool_id uuid references public.pools(id) on delete cascade,
  round int not null default 0,
  bracket_round int,
  bracket_slot int,
  label text,
  home_team_id uuid references public.teams(id) on delete set null,
  away_team_id uuid references public.teams(id) on delete set null,
  -- Provenance des équipes en phase finale : {type:'pool',poolId,rank} | {type:'best',rank,index}
  -- | {type:'winner'|'loser',matchId} | {type:'team',teamId}
  home_source jsonb,
  away_source jsonb,
  court_id uuid references public.courts(id) on delete set null,
  scheduled_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'finished')),
  home_score int,
  away_score int,
  sets jsonb,       -- [{home, away}, …]
  shootout jsonb,   -- {home, away} : tirs au but / départage
  forfeit text check (forfeit in ('home', 'away', 'both')),
  winner_team_id uuid references public.teams(id) on delete set null,
  is_bye boolean not null default false,
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists matches_tournament_idx on public.matches(tournament_id);
create index if not exists matches_court_idx on public.matches(court_id, scheduled_at);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists matches_touch on public.matches;
create trigger matches_touch before update on public.matches
  for each row execute function public.touch_updated_at();
drop trigger if exists sports_touch on public.sports;
create trigger sports_touch before update on public.sports
  for each row execute function public.touch_updated_at();
