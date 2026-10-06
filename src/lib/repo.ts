import { many, one, run } from './db';
import { newId, now } from './ids';

export type Race = {
  id: string; name: string; brand: string; status: 'draft' | 'open' | 'closed';
  race_date: string | null; location: string | null; team_price: number; runner_fee: number;
  team_size: number; capacity_teams: number; categories: string; bib_start: number;
  waiver: string | null; created_at: string; team_sizes: string; hold_slots: number; start_groups: string;
  slug: string | null; access_code: string | null; page: string | null;
};
export type Team = {
  id: string; race_id: string; name: string; category: string | null; captain_name: string;
  captain_email: string; captain_phone: string | null; amount: number;
  payment_status: 'pending' | 'paid'; payment_method: string | null; paid_at: string | null;
  stripe_session_id: string | null; claim_code: string; password_hash: string | null; created_at: string;
  team_size: number | null; extra_slots: number; notes: string | null; half_avg_min: number | null; logo: string | null; reg_type: string;
};
export type Runner = {
  id: string; race_id: string; team_id: string; bib: number | null; first_name: string; last_name: string;
  email: string; phone: string | null; birth_date: string | null; gender: string | null; shirt_size: string | null;
  emergency_name: string | null; emergency_phone: string | null; waiver_accepted_at: string | null;
  waiver_text: string | null; fee: number; payment_status: 'pending' | 'paid'; payment_method: string | null;
  paid_at: string | null; stripe_session_id: string | null; lang: string | null; created_at: string; notes: string | null;
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
// Accepts the id or the page slug (/r/baja-crossing-2026 works too).
export const getRace = (id: string) => one<Race>('SELECT * FROM races WHERE id = ? OR lower(slug) = lower(?) ORDER BY (id = ?) DESC LIMIT 1', [id, id, id]);
export const setRacePage = (id: string, p: { slug: string | null; access_code: string | null; page: string }) =>
  run('UPDATE races SET slug = ?, access_code = ?, page = ? WHERE id = ?', [p.slug, p.access_code, p.page, id]);

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

export type RaceInput = Omit<Race, 'id' | 'created_at' | 'start_groups' | 'slug' | 'access_code' | 'page'>;
export async function createRace(input: RaceInput) {
  const id = newId();
  await run(
    `INSERT INTO races (id, name, brand, status, race_date, location, team_price, runner_fee, team_size, capacity_teams, categories, bib_start, waiver, team_sizes, hold_slots, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, input.name, input.brand, input.status, input.race_date, input.location, input.team_price, input.runner_fee,
      input.team_size, input.capacity_teams, input.categories, input.bib_start, input.waiver, input.team_sizes, input.hold_slots, now()]
  );
  return id;
}
export async function updateRace(id: string, input: RaceInput) {
  await run(
    `UPDATE races SET name=?, brand=?, status=?, race_date=?, location=?, team_price=?, runner_fee=?, team_size=?,
       capacity_teams=?, categories=?, bib_start=?, waiver=?, team_sizes=?, hold_slots=? WHERE id=?`,
    [input.name, input.brand, input.status, input.race_date, input.location, input.team_price, input.runner_fee,
      input.team_size, input.capacity_teams, input.categories, input.bib_start, input.waiver, input.team_sizes, input.hold_slots, id]
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

type NewTeam = Omit<Team, 'id' | 'created_at' | 'stripe_session_id' | 'password_hash' | 'team_size' | 'extra_slots' | 'notes' | 'half_avg_min' | 'logo' | 'reg_type'> &
  { password_hash?: string | null; team_size?: number | null; notes?: string | null; created_at?: string; half_avg_min?: number | null; reg_type?: string };
export async function createTeam(t: NewTeam) {
  const id = newId();
  await run(
    `INSERT INTO teams (id, race_id, name, category, captain_name, captain_email, captain_phone, amount, payment_status,
       payment_method, paid_at, claim_code, password_hash, team_size, notes, half_avg_min, reg_type, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, t.race_id, t.name, t.category, t.captain_name, t.captain_email, t.captain_phone, t.amount, t.payment_status,
      t.payment_method, t.paid_at, t.claim_code, t.password_hash ?? null, t.team_size ?? null, t.notes ?? null, t.half_avg_min ?? null, t.reg_type || 'presale', t.created_at || now()]
  );
  return id;
}

const TEAM_FIELDS = ['name', 'category', 'captain_name', 'captain_email', 'captain_phone', 'amount', 'payment_status',
  'payment_method', 'paid_at', 'stripe_session_id', 'claim_code', 'password_hash', 'team_size', 'extra_slots', 'notes', 'half_avg_min', 'logo', 'reg_type'] as const;
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
export async function createRunner(race: Race, teamId: string, input: RunnerInput, extra: { lang: string; fee: number; covered?: boolean }) {
  const fee = extra.fee;
  for (let attempt = 0; attempt < 6; attempt++) {
    const top = await one<{ bib: number | null }>('SELECT max(bib) AS bib FROM runners WHERE race_id = ?', [race.id]);
    const bib = Math.max(race.bib_start - 1, top?.bib || 0) + 1 + attempt;
    const id = newId();
    try {
      await run(
        `INSERT INTO runners (id, race_id, team_id, bib, first_name, last_name, email, phone, birth_date, gender, shirt_size,
           emergency_name, emergency_phone, waiver_accepted_at, waiver_text, fee, payment_status, payment_method, lang, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, race.id, teamId, bib, input.first_name, input.last_name, input.email, input.phone, input.birth_date, input.gender,
          input.shirt_size, input.emergency_name, input.emergency_phone, now(), race.waiver || '', fee,
          fee > 0 ? 'pending' : 'paid', extra.covered ? 'team' : null, extra.lang, now()]
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

/* ---------------- slots & payments ---------------- */
// Hold model: a paid team covers race.hold_slots runners plus every extra
// slot paid since. Classic model (hold_slots = 0): every runner pays
// runner_fee (0 = included in the team price) and slots aren't used.
export const isHoldRace = (r: Pick<Race, 'hold_slots'>) => (r.hold_slots || 0) > 0;
export const teamSizeOf = (t: Pick<Team, 'team_size'>, r: Pick<Race, 'team_size'>) => t.team_size || r.team_size;
export const paidSlots = (t: Pick<Team, 'payment_status' | 'extra_slots'>, r: Pick<Race, 'hold_slots'>) =>
  (t.payment_status === 'paid' ? r.hold_slots || 0 : 0) + (t.extra_slots || 0);
export function sizeOptions(r: Pick<Race, 'team_sizes' | 'team_size'>) {
  const xs = (r.team_sizes || '').split(',').map((x) => parseInt(x.trim(), 10)).filter((n) => n > 0);
  return xs.length ? Array.from(new Set(xs)).sort((a, b) => a - b) : [r.team_size];
}
// What a runner joining this team now owes: 0 if a paid slot is free.
export async function feeForNewRunner(race: Race, team: Team) {
  if (!isHoldRace(race)) return { fee: race.runner_fee || 0, covered: false };
  const n = await countRunners(team.id);
  return n < paidSlots(team, race) ? { fee: 0, covered: true } : { fee: race.runner_fee || 0, covered: false };
}

export type Payment = {
  id: string; race_id: string; team_id: string | null; runner_id: string | null; kind: 'team' | 'slots' | 'runner';
  source: string; external_id: string | null; quantity: number; amount: number; payer_name: string | null;
  payer_email: string | null; payer_phone: string | null; comment: string | null; paid_at: string; created_at: string; notes: string | null;
};
export const paymentsOfRace = (raceId: string) => many<Payment>('SELECT * FROM payments WHERE race_id = ? ORDER BY paid_at DESC', [raceId]);
export const listPayments = () => many<Payment>('SELECT * FROM payments');
export const getPayment = (id: string) => one<Payment>('SELECT * FROM payments WHERE id = ?', [id]);

type PaymentIn = Omit<Payment, 'id' | 'created_at' | 'notes' | 'paid_at' | 'runner_id' | 'team_id' | 'payer_name' | 'payer_email' | 'payer_phone' | 'comment' | 'external_id'> &
  Partial<Pick<Payment, 'paid_at' | 'runner_id' | 'team_id' | 'payer_name' | 'payer_email' | 'payer_phone' | 'comment' | 'external_id'>>;

// Records a payment once (external_id dedupes webhooks, redirects and
// re-imports) and applies its effect. Returns false if already recorded.
export async function recordPayment(p: PaymentIn): Promise<boolean> {
  const id = newId();
  const res = await run(
    `INSERT INTO payments (id, race_id, team_id, runner_id, kind, source, external_id, quantity, amount, payer_name, payer_email, payer_phone, comment, paid_at, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (external_id) DO NOTHING`,
    [id, p.race_id, p.team_id ?? null, p.runner_id ?? null, p.kind, p.source, p.external_id ?? null, p.quantity, p.amount,
      p.payer_name ?? null, p.payer_email ?? null, p.payer_phone ?? null, p.comment ?? null, p.paid_at || now(), now()]
  );
  if (!res.rowCount) return false;
  await applyPayment(p);
  return true;
}

async function applyPayment(p: PaymentIn) {
  const paid = { payment_status: 'paid' as const, payment_method: p.source, paid_at: p.paid_at || now() };
  if (p.kind === 'team' && p.team_id) await updateTeam(p.team_id, paid);
  if (p.kind === 'runner' && p.runner_id) {
    await updateRunner(p.runner_id, paid);
    const race = await getRace(p.race_id);
    if (race && isHoldRace(race) && p.team_id) await run('UPDATE teams SET extra_slots = extra_slots + 1 WHERE id = ?', [p.team_id]);
  }
  if (p.kind === 'slots' && p.team_id) await addSlots(p.team_id, p.quantity, p.source);
}

// Adds paid slots to a team, covers runners still owing their fee, and
// grows the team size if it paid for more than it picked (up to the max).
export async function addSlots(teamId: string, qty: number, method: string) {
  await run('UPDATE teams SET extra_slots = extra_slots + ? WHERE id = ?', [qty, teamId]);
  if (qty > 0) {
    await run(
      `UPDATE runners SET payment_status = 'paid', payment_method = ?, paid_at = ?
       WHERE id IN (SELECT id FROM runners WHERE team_id = ? AND payment_status = 'pending' ORDER BY bib NULLS LAST LIMIT ?)`,
      [method === 'manual' ? 'manual' : 'team', now(), teamId, qty]
    );
  }
  const team = await getTeam(teamId);
  const race = team && (await getRace(team.race_id));
  if (team && race) {
    const max = Math.max(...sizeOptions(race));
    const slots = paidSlots(team, race);
    if (slots > teamSizeOf(team, race)) await updateTeam(teamId, { team_size: Math.min(max, slots) });
  }
}

// Moves an imported payment to a team (or back to unassigned) and moves
// its effect with it: slots follow the payment; a hold marks the team paid.
export async function assignPayment(paymentId: string, teamId: string | null) {
  const p = await getPayment(paymentId);
  if (!p || p.team_id === teamId) return;
  if (p.team_id) {
    if (p.kind === 'slots') await run('UPDATE teams SET extra_slots = GREATEST(0, extra_slots - ?) WHERE id = ?', [p.quantity, p.team_id]);
    if (p.kind === 'team') {
      const other = await one('SELECT 1 FROM payments WHERE team_id = ? AND kind = ? AND id <> ?', [p.team_id, 'team', p.id]);
      if (!other) await updateTeam(p.team_id, { payment_status: 'pending', payment_method: 'manual', paid_at: null });
    }
  }
  await run('UPDATE payments SET team_id = ? WHERE id = ?', [teamId, paymentId]);
  if (!teamId) return;
  if (p.kind === 'slots') await addSlots(teamId, p.quantity, p.source);
  if (p.kind === 'team') await updateTeam(teamId, { payment_status: 'paid', payment_method: p.source, paid_at: p.paid_at });
}
export const deletePayment = async (id: string) => {
  await assignPayment(id, null);
  await run('DELETE FROM payments WHERE id = ?', [id]);
};

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
export const setRaceGroups = (id: string, json: string) => run('UPDATE races SET start_groups = ? WHERE id = ?', [json, id]);
export const setPaymentNotes = (id: string, notes: string | null) => run('UPDATE payments SET notes = ? WHERE id = ?', [notes, id]);
export const setRunnerNotes = (id: string, notes: string | null) => run('UPDATE runners SET notes = ? WHERE id = ?', [notes, id]);
export const updateUserPassword = (id: string, passwordHash: string) => run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
export const getUserById = (id: string) => one<User>('SELECT * FROM users WHERE id = ?', [id]);
