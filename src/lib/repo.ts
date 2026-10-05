import { many, one, run } from './db';
import { newId, now } from './ids';

export type Race = {
  id: string; name: string; brand: string; status: 'draft' | 'open' | 'closed';
  race_date: string | null; location: string | null; team_price: number; runner_fee: number;
  team_size: number; capacity_teams: number; categories: string; bib_start: number;
  waiver: string | null; created_at: string;
};
export type Team = {
  id: string; race_id: string; name: string; category: string | null; captain_name: string;
  captain_email: string; captain_phone: string | null; amount: number;
  payment_status: 'pending' | 'paid'; payment_method: string | null; paid_at: string | null;
  stripe_session_id: string | null; claim_code: string; password_hash: string | null; created_at: string;
};
export type Runner = {
  id: string; race_id: string; team_id: string; bib: number | null; first_name: string; last_name: string;
  email: string; phone: string | null; birth_date: string | null; gender: string | null; shirt_size: string | null;
  emergency_name: string | null; emergency_phone: string | null; waiver_accepted_at: string | null;
  waiver_text: string | null; fee: number; payment_status: 'pending' | 'paid'; payment_method: string | null;
  paid_at: string | null; stripe_session_id: string | null; lang: string | null; created_at: string;
};

// A team "counts" once it's paid, was added by staff, or a checkout for it
// started in the last 30 minutes (so two people can't buy the last spot).
// Abandoned checkouts drop out after 30 min and never show in the admin.
export const LIVE_TEAM_SQL = `(payment_status = 'paid' OR payment_method = 'manual' OR created_at > ?)`;
const holdSince = () => new Date(Date.now() - 30 * 60 * 1000).toISOString();
export const isListedTeam = (t: Pick<Team, 'payment_status' | 'payment_method'>) =>
  t.payment_status === 'paid' || t.payment_method === 'manual';

/* ---------------- races ---------------- */
export const listRaces = () => many<Race>('SELECT * FROM races ORDER BY race_date NULLS LAST, created_at');
export const getRace = (id: string) => one<Race>('SELECT * FROM races WHERE id = ?', [id]);

export async function liveTeamCount(raceId: string) {
  const r = await one<{ n: string }>(`SELECT count(*) AS n FROM teams WHERE race_id = ? AND ${LIVE_TEAM_SQL}`, [raceId, holdSince()]);
  return Number(r?.n || 0);
}

export async function listOpenRaces() {
  const races = await many<Race & { live: string }>(
    `SELECT r.*, (SELECT count(*) FROM teams t WHERE t.race_id = r.id AND ${LIVE_TEAM_SQL.replace(/payment_|created_at/g, (m) => 't.' + m)}) AS live
     FROM races r WHERE r.status = 'open' ORDER BY r.race_date NULLS LAST`,
    [holdSince()]
  );
  return races.map((r) => ({ ...r, teams_left: Math.max(0, r.capacity_teams - Number(r.live)) }));
}

export type RaceInput = Omit<Race, 'id' | 'created_at'>;
export async function createRace(input: RaceInput) {
  const id = newId();
  await run(
    `INSERT INTO races (id, name, brand, status, race_date, location, team_price, runner_fee, team_size, capacity_teams, categories, bib_start, waiver, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, input.name, input.brand, input.status, input.race_date, input.location, input.team_price, input.runner_fee,
      input.team_size, input.capacity_teams, input.categories, input.bib_start, input.waiver, now()]
  );
  return id;
}
export async function updateRace(id: string, input: RaceInput) {
  await run(
    `UPDATE races SET name=?, brand=?, status=?, race_date=?, location=?, team_price=?, runner_fee=?, team_size=?,
       capacity_teams=?, categories=?, bib_start=?, waiver=? WHERE id=?`,
    [input.name, input.brand, input.status, input.race_date, input.location, input.team_price, input.runner_fee,
      input.team_size, input.capacity_teams, input.categories, input.bib_start, input.waiver, id]
  );
}
export const deleteRace = (id: string) => run('DELETE FROM races WHERE id = ?', [id]);

/* ---------------- teams ---------------- */
export const getTeam = (id: string) => one<Team>('SELECT * FROM teams WHERE id = ?', [id]);
export const teamsOfRace = (raceId: string) => many<Team>('SELECT * FROM teams WHERE race_id = ? ORDER BY name', [raceId]);
export const listTeams = () => many<Team>('SELECT * FROM teams');
export const findTeamByCode = (raceId: string, code: string) =>
  one<Team>('SELECT * FROM teams WHERE race_id = ? AND claim_code = ?', [raceId, code]);

export async function listedTeamsWithCounts(raceId: string) {
  return many<Team & { members: string }>(
    `SELECT t.*, (SELECT count(*) FROM runners r WHERE r.team_id = t.id) AS members
     FROM teams t WHERE t.race_id = ? AND (t.payment_status = 'paid' OR t.payment_method = 'manual') ORDER BY t.name`,
    [raceId]
  );
}

export async function createTeam(t: Omit<Team, 'id' | 'created_at' | 'stripe_session_id' | 'password_hash'> & { password_hash?: string | null }) {
  const id = newId();
  await run(
    `INSERT INTO teams (id, race_id, name, category, captain_name, captain_email, captain_phone, amount, payment_status,
       payment_method, paid_at, claim_code, password_hash, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, t.race_id, t.name, t.category, t.captain_name, t.captain_email, t.captain_phone, t.amount, t.payment_status,
      t.payment_method, t.paid_at, t.claim_code, t.password_hash ?? null, now()]
  );
  return id;
}

const TEAM_FIELDS = ['name', 'category', 'captain_name', 'captain_email', 'captain_phone', 'amount', 'payment_status',
  'payment_method', 'paid_at', 'stripe_session_id', 'claim_code', 'password_hash'] as const;
export async function updateTeam(id: string, patch: Partial<Pick<Team, (typeof TEAM_FIELDS)[number]>>) {
  const keys = TEAM_FIELDS.filter((k) => k in patch);
  if (!keys.length) return;
  await run(`UPDATE teams SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => patch[k]), id]);
}
export const deleteTeam = (id: string) => run('DELETE FROM teams WHERE id = ?', [id]);

/* ---------------- runners ---------------- */
export const getRunner = (id: string) => one<Runner>('SELECT * FROM runners WHERE id = ?', [id]);
export const runnersOfTeam = (teamId: string) => many<Runner>('SELECT * FROM runners WHERE team_id = ? ORDER BY bib NULLS LAST', [teamId]);
export const runnersOfRace = (raceId: string) => many<Runner>('SELECT * FROM runners WHERE race_id = ? ORDER BY bib NULLS LAST', [raceId]);
export const listRunners = () => many<Runner>('SELECT * FROM runners ORDER BY created_at DESC');
export async function countRunners(teamId: string) {
  const r = await one<{ n: string }>('SELECT count(*) AS n FROM runners WHERE team_id = ?', [teamId]);
  return Number(r?.n || 0);
}

export type RunnerInput = Pick<Runner, 'first_name' | 'last_name' | 'email' | 'phone' | 'birth_date' | 'gender' |
  'shirt_size' | 'emergency_name' | 'emergency_phone'>;

// Assigns the next bib for the race. The unique (race_id, bib) index makes
// two simultaneous sign-ups collide instead of sharing a number; we retry.
export async function createRunner(race: Race, teamId: string, input: RunnerInput, extra: { lang: string }) {
  const fee = race.runner_fee || 0;
  for (let attempt = 0; attempt < 6; attempt++) {
    const top = await one<{ bib: number | null }>('SELECT max(bib) AS bib FROM runners WHERE race_id = ?', [race.id]);
    const bib = Math.max(race.bib_start - 1, top?.bib || 0) + 1 + attempt;
    const id = newId();
    try {
      await run(
        `INSERT INTO runners (id, race_id, team_id, bib, first_name, last_name, email, phone, birth_date, gender, shirt_size,
           emergency_name, emergency_phone, waiver_accepted_at, waiver_text, fee, payment_status, lang, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, race.id, teamId, bib, input.first_name, input.last_name, input.email, input.phone, input.birth_date, input.gender,
          input.shirt_size, input.emergency_name, input.emergency_phone, now(), race.waiver || '', fee,
          fee > 0 ? 'pending' : 'paid', extra.lang, now()]
      );
      return (await getRunner(id))!;
    } catch (e: any) {
      if (e?.code !== '23505') throw e;
    }
  }
  throw new Error('Could not assign a bib number, try again.');
}

const RUNNER_FIELDS = ['first_name', 'last_name', 'email', 'phone', 'birth_date', 'gender', 'shirt_size', 'emergency_name',
  'emergency_phone', 'bib', 'payment_status', 'payment_method', 'paid_at', 'stripe_session_id'] as const;
export async function updateRunner(id: string, patch: Partial<Pick<Runner, (typeof RUNNER_FIELDS)[number]>>) {
  const keys = RUNNER_FIELDS.filter((k) => k in patch);
  if (!keys.length) return;
  await run(`UPDATE runners SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => patch[k]), id]);
}
export const deleteRunner = (id: string) => run('DELETE FROM runners WHERE id = ?', [id]);

export async function markPaid(kind: 'team' | 'runner', id: string, method: string, sessionId?: string) {
  const patch = { payment_status: 'paid' as const, payment_method: method, paid_at: now(), ...(sessionId ? { stripe_session_id: sessionId } : {}) };
  if (kind === 'team') await updateTeam(id, patch);
  else await updateRunner(id, patch);
}

/* ---------------- users ---------------- */
export type User = { id: string; name: string; email: string; password_hash: string; role: string; created_at: string };
export const findUserByEmail = (email: string) => one<User>('SELECT * FROM users WHERE lower(email) = lower(?)', [email]);
export const listUsers = () => many<User>('SELECT * FROM users ORDER BY created_at');
export async function createUser(u: { name: string; email: string; passwordHash: string; role?: string }) {
  const id = newId();
  await run('INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?,?,?,?,?,?)',
    [id, u.name, u.email.toLowerCase(), u.passwordHash, u.role || 'admin', now()]);
  return id;
}
export const deleteUser = (id: string) => run('DELETE FROM users WHERE id = ?', [id]);
