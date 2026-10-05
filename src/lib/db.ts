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
`);
}
