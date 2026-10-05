'use server';

// Staff actions. Every one re-checks the login first.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { getCurrentUser } from '@/lib/auth-guard';
import { createSession, destroySession } from '@/lib/session';
import {
  createRace, updateRace, deleteRace, getRace, getTeam, createTeam, updateTeam, deleteTeam, updateRunner, deleteRunner,
  markPaid, findUserByEmail, createUser, deleteUser, type RaceInput, type RunnerInput,
} from '@/lib/repo';
import { newClaimCode, now } from '@/lib/ids';

type Result = { error?: string; id?: string };
const int = (v: unknown, d = 0) => (Number.isFinite(Number(v)) && String(v) !== '' ? Math.round(Number(v)) : d);
const str = (v: unknown, max = 200) => (v == null ? '' : String(v).trim().slice(0, max));

async function guard() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not signed in');
  return user;
}
const refresh = () => revalidatePath('/admin', 'layout');

/* ---------------- auth ---------------- */
export async function login(_prev: unknown, form: FormData): Promise<{ error?: string }> {
  const email = str(form.get('email'), 160);
  const password = String(form.get('password') || '');
  const user = await findUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return { error: 'badLogin' };
  await createSession({ userId: user.id, name: user.name, email: user.email });
  const next = str(form.get('next'), 200);
  redirect(next.startsWith('/admin') ? next : '/admin');
}

export async function logout() {
  destroySession();
  redirect('/login');
}

export async function addTeammate(input: { name: string; email: string; password: string }): Promise<Result> {
  await guard();
  const name = str(input.name, 120), email = str(input.email, 160);
  if (!name || !email || (input.password || '').length < 8) return { error: 'required' };
  if (await findUserByEmail(email)) return { error: 'exists' };
  await createUser({ name, email, passwordHash: await bcrypt.hash(input.password, 10) });
  refresh();
  return {};
}
export async function removeTeammate(id: string): Promise<Result> {
  const me = await guard();
  if (me.userId === id) return { error: 'self' };
  await deleteUser(id);
  refresh();
  return {};
}

/* ---------------- races ---------------- */
function raceInput(f: Record<string, unknown>): RaceInput | null {
  const name = str(f.name, 120), race_date = str(f.race_date, 10);
  if (!name || !race_date) return null;
  const status = ['draft', 'open', 'closed'].includes(String(f.status)) ? (f.status as RaceInput['status']) : 'draft';
  return {
    name, brand: str(f.brand, 40) || 'Reisin', status, race_date, location: str(f.location, 160) || null,
    team_price: Math.max(0, int(f.team_price)), runner_fee: Math.max(0, int(f.runner_fee)),
    team_size: Math.max(1, int(f.team_size, 1)), capacity_teams: Math.max(1, int(f.capacity_teams, 1)),
    categories: str(f.categories, 300), bib_start: Math.max(1, int(f.bib_start, 1)), waiver: str(f.waiver, 8000) || null,
  };
}
export async function saveRace(id: string | null, f: Record<string, unknown>): Promise<Result> {
  await guard();
  const input = raceInput(f);
  if (!input) return { error: 'required' };
  if (id) await updateRace(id, input);
  else id = await createRace(input);
  refresh();
  return { id };
}
export async function removeRace(id: string): Promise<Result> {
  await guard();
  await deleteRace(id);
  refresh();
  return {};
}

/* ---------------- teams ---------------- */
export async function saveTeam(id: string | null, raceId: string, f: Record<string, unknown>): Promise<Result> {
  await guard();
  const name = str(f.name, 80), captain_name = str(f.captain_name, 120), captain_email = str(f.captain_email, 160);
  if (!name || !captain_name || !captain_email) return { error: 'required' };
  const payment_status = f.payment_status === 'paid' ? 'paid' : 'pending';
  const base = { name, category: str(f.category, 60) || null, captain_name, captain_email, captain_phone: str(f.captain_phone, 40) || null, amount: Math.max(0, int(f.amount)), payment_status } as const;
  if (id) {
    const prev = await getTeam(id);
    if (!prev) return { error: 'not_found' };
    const extra = payment_status === 'paid' && prev.payment_status !== 'paid' ? { payment_method: 'manual', paid_at: now() } : {};
    await updateTeam(id, { ...base, ...extra });
  } else {
    const race = await getRace(raceId);
    if (!race) return { error: 'not_found' };
    id = await createTeam({ ...base, race_id: raceId, payment_method: 'manual', paid_at: payment_status === 'paid' ? now() : null, claim_code: newClaimCode(race.brand) });
  }
  refresh();
  return { id };
}
export async function teamMarkPaid(id: string): Promise<Result> {
  await guard();
  await markPaid('team', id, 'manual');
  refresh();
  return {};
}
export async function teamNewCode(id: string): Promise<Result> {
  await guard();
  const team = await getTeam(id);
  const race = team && (await getRace(team.race_id));
  if (!race) return { error: 'not_found' };
  await updateTeam(id, { claim_code: newClaimCode(race.brand) });
  refresh();
  return {};
}
export async function teamClearPassword(id: string): Promise<Result> {
  await guard();
  await updateTeam(id, { password_hash: null });
  refresh();
  return {};
}
export async function removeTeam(id: string): Promise<Result> {
  await guard();
  await deleteTeam(id);
  refresh();
  return {};
}

/* ---------------- runners ---------------- */
export async function saveRunner(id: string, f: RunnerInput & { bib?: unknown }): Promise<Result> {
  await guard();
  const patch = {
    first_name: str(f.first_name, 80), last_name: str(f.last_name, 120), email: str(f.email, 160), phone: str(f.phone, 40),
    birth_date: str(f.birth_date, 10) || null, gender: str(f.gender, 2), shirt_size: str(f.shirt_size, 4),
    emergency_name: str(f.emergency_name, 120), emergency_phone: str(f.emergency_phone, 40), bib: int(f.bib) || null,
  };
  if (!patch.first_name || !patch.last_name || !patch.email) return { error: 'required' };
  try {
    await updateRunner(id, patch);
  } catch (e: any) {
    if (e?.code === '23505') return { error: 'bib_taken' };
    throw e;
  }
  refresh();
  return {};
}
export async function runnerMarkPaid(id: string): Promise<Result> {
  await guard();
  await markPaid('runner', id, 'manual');
  refresh();
  return {};
}
export async function removeRunner(id: string): Promise<Result> {
  await guard();
  await deleteRunner(id);
  refresh();
  return {};
}
