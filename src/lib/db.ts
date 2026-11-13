import { Pool, type QueryResultRow } from 'pg';

// Postgres via node-postgres — same setup as Optimist Vendors. Works against
// any standard Postgres (Neon / Vercel Postgres, Supabase, local). Use a
// *pooled* connection string as DATABASE_URL in production.

const globalForDb = globalThis as unknown as { __pgPool?: Pool };

function buildPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Point it at a Postgres connection string (see .env.example).');
  }
  const isLocal = /localhost|127\.0\.0\.1|host=\/tmp/.test(connectionString);
  return new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: process.env.NODE_ENV === 'production' ? 3 : 10,
  });
}

function getPool(): Pool {
  if (!globalForDb.__pgPool) globalForDb.__pgPool = buildPool();
  return globalForDb.__pgPool;
}

export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const real = getPool();
    const value = Reflect.get(real, prop, real);
    return typeof value === 'function' ? value.bind(real) : value;
  },
});

// Query text uses `?` placeholders; converted to $1, $2… in order.
function toPg(text: string) {
  let n = 0;
  return text.replace(/\?/g, () => `$${++n}`);
}

export async function run(text: string, params: unknown[] = []) {
  await ensureSchema();
  return pool.query(toPg(text), params);
}

export async function one<T extends QueryResultRow = any>(text: string, params: unknown[] = []): Promise<T | null> {
  await ensureSchema();
  const res = await pool.query<T>(toPg(text), params);
  return res.rows[0] ?? null;
}

export async function many<T extends QueryResultRow = any>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  const res = await pool.query<T>(toPg(text), params);
  return res.rows;
}

let migratePromise: Promise<void> | null = null;

export async function ensureSchema() {
  if (migratePromise) return migratePromise;
  migratePromise = doMigrate().catch((err) => {
    migratePromise = null;
    throw err;
  });
  return migratePromise;
}

// Idempotent migrations, run once per warm instance on first query.
// Add new columns below with ALTER TABLE … ADD COLUMN IF NOT EXISTS.
async function doMigrate() {
  await pool.query(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL
);

-- One row per race edition (e.g. "Sal a Valle 2027"). Money is whole MXN.
-- runner_fee = 0 means registration is included in the team price.
CREATE TABLE IF NOT EXISTS races (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT 'Reisin',
  status TEXT NOT NULL DEFAULT 'draft',
  race_date TEXT,
  location TEXT,
  team_price INTEGER NOT NULL DEFAULT 0,
  runner_fee INTEGER NOT NULL DEFAULT 0,
  team_size INTEGER NOT NULL DEFAULT 6,
  capacity_teams INTEGER NOT NULL DEFAULT 50,
  categories TEXT NOT NULL DEFAULT 'Varonil, Femenil, Mixto',
  bib_start INTEGER NOT NULL DEFAULT 100,
  waiver TEXT,
  created_at TEXT NOT NULL
);

-- A team bought for a race. claim_code is the captain's code (SAV-7K2QX);
-- password_hash is the bcrypt hash of the team password runners use.
-- payment_method: stripe | test | manual | free.
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  captain_name TEXT NOT NULL,
  captain_email TEXT NOT NULL,
  captain_phone TEXT,
  amount INTEGER NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  paid_at TEXT,
  stripe_session_id TEXT,
  claim_code TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_teams_race ON teams(race_id);

CREATE TABLE IF NOT EXISTS runners (
  id TEXT PRIMARY KEY,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  bib INTEGER,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  birth_date TEXT,
  gender TEXT,
  shirt_size TEXT,
  emergency_name TEXT,
  emergency_phone TEXT,
  waiver_accepted_at TEXT,
  waiver_text TEXT,
  fee INTEGER NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'paid',
  payment_method TEXT,
  paid_at TEXT,
  stripe_session_id TEXT,
  lang TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_runners_race_bib ON runners(race_id, bib) WHERE bib IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_runners_team ON runners(team_id);
CREATE INDEX IF NOT EXISTS idx_runners_race ON runners(race_id);
-- Hold model (Baja Crossing): team_price is a deposit that covers
-- hold_slots runners; every extra slot costs runner_fee. team_sizes lists
-- the sizes a captain can pick (e.g. "4,5,6"); empty = fixed team_size.
ALTER TABLE races ADD COLUMN IF NOT EXISTS team_sizes TEXT NOT NULL DEFAULT '';
ALTER TABLE races ADD COLUMN IF NOT EXISTS hold_slots INTEGER NOT NULL DEFAULT 0;

-- team_size: size the captain picked (NULL = race.team_size).
-- extra_slots: runner slots paid on top of the hold. notes: free text
-- (e.g. the buyer's order comment from Ecwid).
ALTER TABLE teams ADD COLUMN IF NOT EXISTS team_size INTEGER;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS extra_slots INTEGER NOT NULL DEFAULT 0;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS notes TEXT;

-- Every money movement, whatever the source (Stripe, test mode, manual,
-- Ecwid import). external_id makes imports and webhooks idempotent.
-- kind: team (hold / team purchase) | slots (extra runner slots) | runner.
-- team_id NULL = imported payment not yet matched to a team.
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  runner_id TEXT REFERENCES runners(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  source TEXT NOT NULL,
  external_id TEXT UNIQUE,
  quantity INTEGER NOT NULL DEFAULT 1,
  amount INTEGER NOT NULL DEFAULT 0,
  payer_name TEXT,
  payer_email TEXT,
  payer_phone TEXT,
  comment TEXT,
  paid_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_race ON payments(race_id);
CREATE INDEX IF NOT EXISTS idx_payments_team ON payments(team_id);

-- Source record id for imported runners (e.g. RedPodium registrant id),
-- so re-importing the same file never duplicates anyone.
ALTER TABLE runners ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_runners_external ON runners(external_id) WHERE external_id IS NOT NULL;

-- Team half-marathon average in minutes (sets the start group), logo as a
-- small data: URL (resized in the browser, so no file storage needed), and
-- registration type: presale (deposit + balance) | full (paid at once).
ALTER TABLE teams ADD COLUMN IF NOT EXISTS half_avg_min INTEGER;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS reg_type TEXT NOT NULL DEFAULT 'presale';

-- Start groups: JSON array of {label, max (minutes, null = no limit), color, start}.
ALTER TABLE races ADD COLUMN IF NOT EXISTS start_groups TEXT NOT NULL DEFAULT '[{"label":"1","max":99,"color":"#2f7d4f","start":""},{"label":"2","max":115,"color":"#c2571b","start":""},{"label":"3","max":null,"color":"#1d4ed8","start":""}]';

-- Internal staff notes (follow-up status) on payments and runners.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE runners ADD COLUMN IF NOT EXISTS notes TEXT;
-- Team notes are now shown in the teams table: drop the import placeholder.
UPDATE teams SET notes = NULL WHERE notes = 'Importado de RedPodium';

-- "Busco equipo": runners looking for a team (e.g. their team fell apart
-- after paying). Contact info is only shown to captains and staff.
-- status: open | matched | closed. paid_claim = says they already paid a spot.
CREATE TABLE IF NOT EXISTS free_agents (
  id TEXT PRIMARY KEY,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  gender TEXT,
  half_avg_min INTEGER,
  city TEXT,
  message TEXT,
  paid_claim BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'open',
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_free_agents_race ON free_agents(race_id);

-- Race landing page: shareable short URL (/slug), an optional access
-- password for the page (plain text on purpose: staff share it), and the
-- page content as JSON {intro, links[], agenda[], sections[]}.
ALTER TABLE races ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE races ADD COLUMN IF NOT EXISTS access_code TEXT;
ALTER TABLE races ADD COLUMN IF NOT EXISTS page TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_races_slug ON races(lower(slug)) WHERE slug IS NOT NULL;

-- When staff sent the captain their code (null = not yet).
ALTER TABLE teams ADD COLUMN IF NOT EXISTS code_sent_at TEXT;

-- Unassigned payments that won't go to a team: not_formed (team never
-- formed) | credit (kept as credit, e.g. for another event) | refunded.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS resolution TEXT;

-- Solo runners: a "team" of one (is_solo). Same code / portal flow as a
-- captain, but kept out of team counts, capacity and the join list.
ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_solo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_teams_external ON teams(external_id) WHERE external_id IS NOT NULL;

-- Live timing. Checkpoints per race (num 0 = start line is implicit: each
-- team's start is a check-in at the start). timing_code = staff passcode
-- for the check-in page. team_no = number on the team's car / bib.
CREATE TABLE IF NOT EXISTS race_checkpoints (
  id TEXT PRIMARY KEY,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  num INTEGER NOT NULL,
  name TEXT NOT NULL,
  km NUMERIC,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_checkpoints_race ON race_checkpoints(race_id);
CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  checkpoint_id TEXT NOT NULL,
  at TEXT NOT NULL,
  by_name TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (team_id, checkpoint_id)
);
CREATE INDEX IF NOT EXISTS idx_checkins_race ON checkins(race_id);
ALTER TABLE races ADD COLUMN IF NOT EXISTS timing_code TEXT;
ALTER TABLE races ADD COLUMN IF NOT EXISTS board_public BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS team_no INTEGER;

-- Photos uploaded per race (resized in the browser, stored as JPEG bytes).
CREATE TABLE IF NOT EXISTS race_photos (
  id TEXT PRIMARY KEY,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  lg BYTEA NOT NULL,
  sm BYTEA NOT NULL,
  w INTEGER NOT NULL,
  h INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_race_photos_race ON race_photos(race_id);

-- Team settlement ("liquidación"): fixed amount per team size set by staff
-- (JSON {"4":20000,...}); a paid settlement marks the team fully paid.
ALTER TABLE races ADD COLUMN IF NOT EXISTS settle_amounts TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS settled_at TEXT;

-- Staff guide per race (password-protected public page /guia/[raceId]).
CREATE TABLE IF NOT EXISTS staff_guides (
  race_id TEXT PRIMARY KEY REFERENCES races(id) ON DELETE CASCADE,
  password TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_invites (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES free_agents(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  UNIQUE (agent_id, team_id)
);

-- Sponsor logos shown at the bottom of the race page. img = trimmed PNG.
CREATE TABLE IF NOT EXISTS race_sponsors (
  id TEXT PRIMARY KEY,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  url TEXT,
  img BYTEA NOT NULL,
  w INTEGER NOT NULL,
  h INTEGER NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_race_sponsors_race ON race_sponsors(race_id);
ALTER TABLE races ADD COLUMN IF NOT EXISTS sponsor_mono BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE races ADD COLUMN IF NOT EXISTS settle_deadline TEXT;
-- Solo Runner sales from the race page: price (0 = not for sale) and optional cap.
ALTER TABLE races ADD COLUMN IF NOT EXISTS solo_price INTEGER NOT NULL DEFAULT 0;
ALTER TABLE races ADD COLUMN IF NOT EXISTS solo_capacity INTEGER;

-- Race store (merch). Products with size/color options, each with its own stock
-- (options JSON [{"label":"M","stock":10}]; empty = one stock in "stock").
CREATE TABLE IF NOT EXISTS store_products (
  id TEXT PRIMARY KEY,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  options TEXT NOT NULL DEFAULT '[]',
  images TEXT NOT NULL DEFAULT '[]',
  active BOOLEAN NOT NULL DEFAULT true,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_store_products_race ON store_products(race_id);
CREATE TABLE IF NOT EXISTS store_images (
  id TEXT PRIMARY KEY,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  lg BYTEA NOT NULL,
  sm BYTEA NOT NULL,
  w INTEGER NOT NULL,
  h INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
-- status: pending (checkout open) | paid | delivered | canceled.
-- items JSON [{"product_id","name","option","qty","price"}]; delivery: pickup | ship.
CREATE TABLE IF NOT EXISTS store_orders (
  id TEXT PRIMARY KEY,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  order_no INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  delivery TEXT NOT NULL DEFAULT 'pickup',
  address TEXT,
  items TEXT NOT NULL DEFAULT '[]',
  subtotal INTEGER NOT NULL DEFAULT 0,
  shipping INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_session_id TEXT,
  paid_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_store_orders_race ON store_orders(race_id);
-- Store settings per race: on/off, pickup on/off, shipping fee (null = no shipping).
ALTER TABLE races ADD COLUMN IF NOT EXISTS store_on BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE races ADD COLUMN IF NOT EXISTS store_pickup BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE races ADD COLUMN IF NOT EXISTS store_ship_fee INTEGER;
-- Optional password to enter the shop (empty = public).
ALTER TABLE races ADD COLUMN IF NOT EXISTS store_code TEXT;
-- Full-screen cover image for the shop page (store_images id; empty = compact header).
ALTER TABLE races ADD COLUMN IF NOT EXISTS store_hero TEXT;
-- Team won't race (DNS): stays in admin, hidden from leaderboard / check-in / numbering.
ALTER TABLE teams ADD COLUMN IF NOT EXISTS no_race BOOLEAN NOT NULL DEFAULT false;
-- Race-day check-in at kit pickup (staff link): when, by whom, how many showed up, notes.
ALTER TABLE teams ADD COLUMN IF NOT EXISTS kit_at TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS kit_by TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS kit_count INTEGER;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS kit_note TEXT;

-- Solos have their own number series (S1, S2…). Races numbered before that
-- (Solos at 46+) are shifted back to start at 1, keeping their order.
WITH s AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY race_id ORDER BY team_no, name) AS n FROM teams
  WHERE is_solo AND team_no IS NOT NULL AND race_id IN (SELECT race_id FROM teams WHERE is_solo AND team_no IS NOT NULL GROUP BY race_id HAVING MIN(team_no) > 1)
) UPDATE teams SET team_no = s.n FROM s WHERE teams.id = s.id;

-- Repair names imported from UTF-8 CSVs read as Latin-1 ("GarcÃa" → "García").
DO $$
DECLARE r record; f text; v text;
BEGIN
  FOR r IN SELECT 'runners' AS t, unnest(ARRAY['first_name','last_name','emergency_name']) AS c
           UNION ALL SELECT 'teams', unnest(ARRAY['name','captain_name']) LOOP
    FOR f, v IN EXECUTE format('SELECT id, %I FROM %I WHERE %I ~ ''[ÃÂ]''', r.c, r.t, r.c) LOOP
      BEGIN
        EXECUTE format('UPDATE %I SET %I = $1 WHERE id = $2', r.t, r.c) USING convert_from(convert_to(v, 'LATIN1'), 'UTF8'), f;
      EXCEPTION WHEN others THEN NULL;
      END;
    END LOOP;
  END LOOP;
END $$;
`);
}
