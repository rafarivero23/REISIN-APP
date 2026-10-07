'use server';

// Staff actions. Every one re-checks the login first.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { getCurrentUser } from '@/lib/auth-guard';
import { createSession, destroySession } from '@/lib/session';
import {
  createRace, updateRace, deleteRace, getRace, getTeam, getRunner, createTeam, updateTeam, deleteTeam, updateRunner, deleteRunner,
  recordPayment, assignPayment, deletePayment, getPayment, findUserByEmail, createUser, deleteUser, getUserById, updateUserPassword,
  sizeOptions, captainSizeOptions, setPaymentResolution, setCodeSent, setRaceGroups, setPaymentNotes, setRunnerNotes, type RaceInput, type RunnerInput,
} from '@/lib/repo';
import { importCsvText, rematch } from '@/lib/importers';
import { parseHalf } from '@/lib/groups';
import { cleanLogo } from '@/lib/logo';
import { newClaimCode, newId, now } from '@/lib/ids';

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
    team_sizes: str(f.team_sizes, 40).split(',').map((x) => parseInt(x, 10)).filter((n) => n > 0).join(','),
    hold_slots: Math.max(0, int(f.hold_slots)),
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
  const race = await getRace(raceId);
  if (!race) return { error: 'not_found' };
  const sizes = captainSizeOptions(race);
  const team_size = sizes.includes(int(f.team_size)) ? int(f.team_size) : sizes[sizes.length - 1];
  const base = { name, category: str(f.category, 60) || null, captain_name, captain_email, captain_phone: str(f.captain_phone, 40) || null,
    amount: Math.max(0, int(f.amount)), team_size, notes: str(f.notes, 1000) || null,
    half_avg_min: parseHalf(str(f.half_avg, 12)), reg_type: f.reg_type === 'full' ? 'full' : 'presale' };
  let wasPaid = false;
  if (id) {
    const prev = await getTeam(id);
    if (!prev) return { error: 'not_found' };
    wasPaid = prev.payment_status === 'paid';
    await updateTeam(id, base);
  } else {
    id = await createTeam({ ...base, race_id: raceId, payment_status: 'pending', payment_method: 'manual', paid_at: null, claim_code: newClaimCode(race.brand) });
  }
  if (payment_status === 'paid' && !wasPaid) {
    await recordPayment({ race_id: raceId, team_id: id, kind: 'team', source: 'manual', external_id: 'manual:' + newId(), quantity: 1, amount: base.amount, payer_name: captain_name, payer_email: captain_email });
  }
  refresh();
  return { id };
}
export async function teamMarkPaid(id: string): Promise<Result> {
  await guard();
  const t = await getTeam(id);
  if (!t) return { error: 'not_found' };
  await recordPayment({ race_id: t.race_id, team_id: t.id, kind: 'team', source: 'manual', external_id: 'manual:' + newId(), quantity: 1, amount: t.amount, payer_name: t.captain_name, payer_email: t.captain_email });
  refresh();
  return {};
}
// Records slots paid outside the app (transfer, cash).
export async function teamAddSlots(id: string, qty: number, amount: number): Promise<Result> {
  await guard();
  const t = await getTeam(id);
  const n = Math.round(Number(qty));
  if (!t || !n || n < 1 || n > 20) return { error: 'required' };
  await recordPayment({ race_id: t.race_id, team_id: t.id, kind: 'slots', source: 'manual', external_id: 'manual:' + newId(), quantity: n, amount: Math.max(0, Math.round(Number(amount) || 0)), payer_name: t.captain_name, payer_email: t.captain_email });
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
  const r = await getRunner(id);
  if (!r) return { error: 'not_found' };
  await recordPayment({ race_id: r.race_id, team_id: r.team_id, runner_id: r.id, kind: 'runner', source: 'manual', external_id: 'manual:' + newId(), quantity: 1, amount: r.fee, payer_name: `${r.first_name} ${r.last_name}`, payer_email: r.email });
  refresh();
  return {};
}

export async function setTeamLogoAdmin(id: string, dataUrl: string | null): Promise<Result> {
  await guard();
  const logo = dataUrl ? cleanLogo(dataUrl) : null;
  if (dataUrl && !logo) return { error: 'logo_bad' };
  await updateTeam(id, { logo });
  refresh();
  return {};
}

// Start groups: label, limit in minutes (blank = no limit), color, start time.
export async function saveGroups(raceId: string, groups: { label: string; max: string | number | null; color: string; start: string }[]): Promise<Result> {
  await guard();
  const clean = (groups || []).slice(0, 10).map((g) => ({
    label: str(g.label, 20) || '?', max: g.max === '' || g.max == null ? null : Math.max(1, int(g.max)),
    color: /^#[0-9a-f]{6}$/i.test(String(g.color)) ? String(g.color) : '#5b6370', start: str(g.start, 10),
  }));
  if (!clean.length) return { error: 'required' };
  await setRaceGroups(raceId, JSON.stringify(clean));
  refresh();
  return {};
}

export async function resolvePayment(id: string, resolution: string | null): Promise<Result> {
  await guard();
  const r = resolution && ['not_formed', 'credit', 'refunded'].includes(resolution) ? resolution : null;
  await setPaymentResolution(id, r);
  refresh();
  return {};
}

/* ---------------- captain codes ---------------- */
export async function markCodesSent(ids: string[], sent: boolean): Promise<Result> {
  await guard();
  await setCodeSent((ids || []).slice(0, 500).map(String), sent ? now() : null);
  refresh();
  return {};
}

/* ---------------- notes ---------------- */
export async function savePaymentNotes(id: string, notes: string): Promise<Result> {
  await guard();
  await setPaymentNotes(id, str(notes, 2000) || null);
  refresh();
  return {};
}
export async function saveTeamNotes(id: string, notes: string): Promise<Result> {
  await guard();
  await updateTeam(id, { notes: str(notes, 2000) || null });
  refresh();
  return {};
}
export async function saveRunnerNotes(id: string, notes: string): Promise<Result> {
  await guard();
  await setRunnerNotes(id, str(notes, 2000) || null);
  refresh();
  return {};
}

/* ---------------- payments & import ---------------- */
// Someone paid the apartado but never formed a team: create the team with
// the payer as captain and put the payment on it. The captain then signs
// in with the code, names the team and picks its size.
export async function teamFromPayment(paymentId: string): Promise<Result> {
  await guard();
  const p = await getPayment(paymentId);
  if (!p || p.team_id) return { error: 'not_found' };
  const race = await getRace(p.race_id);
  if (!race) return { error: 'not_found' };
  const sizes = sizeOptions(race);
  const payer = (p.payer_name || p.payer_email || 'Capitán').trim();
  const order = p.external_id?.startsWith('ecwid:') ? ` #${p.external_id.slice(6)}` : '';
  const id = await createTeam({
    race_id: race.id, name: `Equipo de ${payer.split(/\s+/).slice(0, 2).join(' ')}`, category: null,
    captain_name: payer, captain_email: (p.payer_email || '').toLowerCase(), captain_phone: p.payer_phone || null,
    amount: race.team_price, payment_status: 'pending', payment_method: 'manual', paid_at: null,
    claim_code: newClaimCode(race.brand), team_size: sizes[sizes.length - 1], notes: `Creado desde el pago${order}. Falta que el capitán ponga nombre y tamaño.`,
  });
  await assignPayment(p.id, id);
  refresh();
  return { id };
}

export async function setPaymentTeam(paymentId: string, teamId: string | null): Promise<Result> {
  await guard();
  await assignPayment(paymentId, teamId || null);
  refresh();
  return {};
}
export async function removePayment(paymentId: string): Promise<Result> {
  await guard();
  await deletePayment(paymentId);
  refresh();
  return {};
}
export async function importCsv(raceId: string, text: string) {
  await guard();
  try {
    const r = await importCsvText(raceId, text);
    refresh();
    return r;
  } catch (e: any) {
    return { error: e?.message === 'unknown_csv' ? 'unknown_csv' : String(e?.message || e) };
  }
}
export async function rematchPayments(raceId: string) {
  await guard();
  const left = await rematch(raceId);
  refresh();
  return { left };
}

export async function changePassword(current: string, next: string): Promise<Result> {
  const me = await guard();
  const u = await getUserById(me.userId);
  if (!u || !(await bcrypt.compare(String(current || ''), u.password_hash))) return { error: 'badCurrent' };
  if (String(next || '').length < 8) return { error: 'passMin8' };
  await updateUserPassword(u.id, await bcrypt.hash(next, 10));
  return {};
}
export async function removeRunner(id: string): Promise<Result> {
  await guard();
  await deleteRunner(id);
  refresh();
  return {};
}
