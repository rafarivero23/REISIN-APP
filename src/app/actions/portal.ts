'use server';

// Public portal actions (no staff login). Every step is validated here;
// captains and runners only ever hold signed, httpOnly cookies.
import { headers } from 'next/headers';
import bcrypt from 'bcryptjs';
import {
  getRace, getTeam, getRunner, liveTeamCount, countRunners, createTeam, updateTeam, createRunner, recordPayment,
  findTeamByCode, feeForNewRunner, isHoldRace, paidSlots, sizeOptions, teamSizeOf, type Race, type RunnerInput,
} from '@/lib/repo';
import { newClaimCode, now } from '@/lib/ids';
import { stripe } from '@/lib/stripe';
import { splitCats } from '@/lib/format';
import { parseHalf } from '@/lib/groups';
import { cleanLogo } from '@/lib/logo';
import { setCaptain, getCaptainTeamId, clearCaptain, setMember, getMemberTeamId, signPayToken, verifyPayToken } from '@/lib/team-session';

type Err = { error: string };
const clean = (v: unknown, max = 200) => (v == null ? '' : String(v).trim().slice(0, max));

function origin() {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const h = headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  const proto = h.get('x-forwarded-proto') || (host?.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

async function openRace(raceId: string): Promise<Race | Err> {
  const race = await getRace(raceId);
  if (!race) return { error: 'race_not_found' };
  if (race.status !== 'open') return { error: 'race_closed' };
  return race;
}

type Checkout = { url: string } | { simulated: true; payToken: string };
type Kind = 'team' | 'runner' | 'slots';
// kind/id: what the payment is for. slots → id is the team, qty = slots.
async function checkout(kind: Kind, id: string, unit: number, qty: number, label: string, email: string, successPath: string, cancelPath: string): Promise<Checkout> {
  const s = stripe();
  if (!s) return { simulated: true, payToken: await signPayToken(kind, id, qty) };
  const session = await s.checkout.sessions.create({
    mode: 'payment',
    customer_email: email || undefined,
    line_items: [{ quantity: qty, price_data: { currency: 'mxn', unit_amount: Math.round(unit * 100), product_data: { name: label } } }],
    metadata: { kind, id, qty: String(qty) },
    success_url: origin() + successPath + (successPath.includes('?') ? '&' : '?') + 'session_id={CHECKOUT_SESSION_ID}',
    cancel_url: origin() + cancelPath,
  });
  if (kind === 'team') await updateTeam(id, { stripe_session_id: session.id });
  return { url: session.url! };
}

// Turns a checkout result into a ledger entry (once). Shared with the webhook.
export async function settle(kind: Kind, id: string, qty: number, amount: number, source: string, externalId: string, payer?: { name?: string | null; email?: string | null }) {
  if (kind === 'team') {
    const t = await getTeam(id);
    if (!t) return false;
    if (!amount) amount = t.amount;
    return recordPayment({ race_id: t.race_id, team_id: t.id, kind, source, external_id: externalId, quantity: 1, amount, payer_name: payer?.name || t.captain_name, payer_email: payer?.email || t.captain_email });
  }
  if (kind === 'runner') {
    const r = await getRunner(id);
    if (!r) return false;
    if (!amount) amount = r.fee;
    return recordPayment({ race_id: r.race_id, team_id: r.team_id, runner_id: r.id, kind, source, external_id: externalId, quantity: 1, amount, payer_name: payer?.name || `${r.first_name} ${r.last_name}`, payer_email: payer?.email || r.email });
  }
  const t = await getTeam(id);
  if (!t) return false;
  if (!amount) amount = qty * ((await getRace(t.race_id))?.runner_fee || 0);
  return recordPayment({ race_id: t.race_id, team_id: t.id, kind: 'slots', source, external_id: externalId, quantity: qty, amount, payer_name: payer?.name || t.captain_name, payer_email: payer?.email || t.captain_email });
}

// Confirms a payment from a real Stripe session or a test-mode pay token.
async function confirmPayment(kind: Kind, id: string, proof: { sessionId?: string; payToken?: string }) {
  const s = stripe();
  if (s && proof.sessionId) {
    const session = await s.checkout.sessions.retrieve(proof.sessionId);
    if (session.metadata?.kind !== kind || session.metadata?.id !== id) return false;
    if (session.payment_status !== 'paid') return false;
    await settle(kind, id, Number(session.metadata?.qty || 1), Math.round((session.amount_total || 0) / 100), 'stripe', session.id,
      { name: session.customer_details?.name, email: session.customer_details?.email });
    return true;
  }
  if (!s && proof.payToken) {
    const v = await verifyPayToken(proof.payToken, kind, id);
    if (!v) return false;
    await settle(kind, id, v.qty, v.amount, 'test', 'test:' + proof.payToken.slice(-24));
    return true;
  }
  return false;
}

/* ---------------- buy a team ---------------- */
export async function buyTeam(input: { raceId: string; name: string; category: string; captainName: string; captainEmail: string; captainPhone: string; teamSize?: number; half?: string }):
  Promise<Err | ({ teamId: string; amount: number } & (Checkout | { free: true }))> {
  const race = await openRace(input.raceId);
  if ('error' in race) return race;
  const name = clean(input.name, 80), captainName = clean(input.captainName, 120), captainEmail = clean(input.captainEmail, 160), captainPhone = clean(input.captainPhone, 40);
  if (!name || !captainName || !captainEmail || !captainPhone) return { error: 'required' };
  if ((await liveTeamCount(race.id)) >= race.capacity_teams) return { error: 'p_fullRace' };
  const cats = splitCats(race.categories);
  const free = race.team_price <= 0;
  const sizes = sizeOptions(race);
  const team_size = sizes.includes(Number(input.teamSize)) ? Number(input.teamSize) : sizes[sizes.length - 1];
  const teamId = await createTeam({
    team_size, half_avg_min: parseHalf(input.half), reg_type: 'presale',
    race_id: race.id, name, category: cats.includes(input.category) ? input.category : cats[0] || null,
    captain_name: captainName, captain_email: captainEmail, captain_phone: captainPhone, amount: race.team_price,
    payment_status: free ? 'paid' : 'pending', payment_method: free ? 'free' : null, paid_at: free ? now() : null,
    claim_code: newClaimCode(race.brand),
  });
  if (free) { await setCaptain(teamId); return { teamId, amount: 0, free: true }; }
  const label = isHoldRace(race) ? `${race.name} — Apartado equipo ${name}` : `${race.name} — Equipo ${name}`;
  const co = await checkout('team', teamId, race.team_price, 1, label, captainEmail,
    `/team-created?team=${teamId}`, `/r/${race.id}/buy`);
  return { teamId, amount: race.team_price, ...co };
}

// Called after payment (Stripe redirect or test checkout). Sets the captain
// cookie and returns the captain code — only to the browser that paid.
export async function confirmTeam(input: { teamId: string; sessionId?: string; payToken?: string }): Promise<Err | { claimCode: string; teamName: string }> {
  const team = await getTeam(input.teamId);
  if (!team) return { error: 'not_found' };
  if (team.payment_status !== 'paid') {
    const ok = await confirmPayment('team', team.id, input);
    if (!ok) return { error: 'p_notPaid' };
  } else {
    const already = (await getCaptainTeamId()) === team.id;
    const proof = (input.sessionId && input.sessionId === team.stripe_session_id) ||
      (input.payToken && (await verifyPayToken(input.payToken, 'team', team.id)));
    if (!already && !proof) return { error: 'p_captainSub' };
  }
  await setCaptain(team.id);
  return { claimCode: team.claim_code, teamName: team.name };
}

/* ---------------- captain ---------------- */
export async function captainLogin(input: { raceId: string; code: string }): Promise<Err | { ok: true }> {
  const code = clean(input.code, 20).toUpperCase().replace(/\s+/g, '');
  const team = await findTeamByCode(input.raceId, code);
  if (!team) return { error: 'p_badCode' };
  await setCaptain(team.id);
  return { ok: true };
}

export async function captainLogout() {
  clearCaptain();
}

export async function setTeamPassword(password: string): Promise<Err | { ok: true }> {
  const teamId = await getCaptainTeamId();
  if (!teamId) return { error: 'p_captainSub' };
  if (typeof password !== 'string' || password.length < 4 || password.length > 64) return { error: 'p_passMin' };
  await updateTeam(teamId, { password_hash: await bcrypt.hash(password, 10) });
  return { ok: true };
}

// Captain pays for N more runner slots (hold model) or one runner's fee (classic).
export async function setTeamDetails(input: { half?: string; logo?: string | null }): Promise<Err | { ok: true }> {
  const teamId = await getCaptainTeamId();
  if (!teamId) return { error: 'p_captainSub' };
  if (input.half !== undefined) {
    const m = parseHalf(input.half);
    if (input.half && !m) return { error: 'half_bad' };
    await updateTeam(teamId, { half_avg_min: m });
  }
  if (input.logo !== undefined) {
    const logo = input.logo ? cleanLogo(input.logo) : null;
    if (input.logo && !logo) return { error: 'logo_bad' };
    await updateTeam(teamId, { logo });
  }
  return { ok: true };
}

export async function captainPaySlots(qty: number): Promise<Err | Checkout> {
  const teamId = await getCaptainTeamId();
  const team = teamId ? await getTeam(teamId) : null;
  const race = team ? await getRace(team.race_id) : null;
  if (!team || !race) return { error: 'p_captainSub' };
  if (!isHoldRace(race) || team.payment_status !== 'paid') return { error: 'p_captainSub' };
  const left = teamSizeOf(team, race) - paidSlots(team, race);
  const n = Math.max(1, Math.min(Math.floor(Number(qty)) || 1, left));
  if (left <= 0) return { error: 'paid' };
  return checkout('slots', team.id, race.runner_fee, n, `${race.name} — ${n} lugar(es) equipo ${team.name}`, team.captain_email, `/captain?slots=${team.id}`, '/captain');
}

export async function confirmSlots(input: { sessionId?: string; payToken?: string }) {
  const teamId = await getCaptainTeamId();
  if (!teamId) return { error: 'p_captainSub' } as Err;
  const ok = await confirmPayment('slots', teamId, input);
  return ok ? { ok: true as const } : ({ error: 'p_notPaid' } as Err);
}

export async function captainPayRunner(runnerId: string): Promise<Err | Checkout> {
  const teamId = await getCaptainTeamId();
  const r = await getRunner(runnerId);
  if (!teamId || !r || r.team_id !== teamId) return { error: 'p_captainSub' };
  if (r.payment_status === 'paid' || r.fee <= 0) return { error: 'paid' };
  const race = await getRace(r.race_id);
  return checkout('runner', r.id, r.fee, 1, `${race!.name} — Inscripción ${r.first_name} ${r.last_name}`, r.email, `/captain?paid=${r.id}`, '/captain');
}

/* ---------------- runners ---------------- */
export async function joinTeam(input: { raceId: string; teamId: string; password: string }): Promise<Err | { ok: true }> {
  const race = await openRace(input.raceId);
  if ('error' in race) return race;
  const team = await getTeam(input.teamId);
  if (!team || team.race_id !== race.id) return { error: 'not_found' };
  if (!team.password_hash) return { error: 'p_noPassYet' };
  if (!(await bcrypt.compare(String(input.password || ''), team.password_hash))) return { error: 'p_badPass' };
  if ((await countRunners(team.id)) >= teamSizeOf(team, race)) return { error: 'p_teamFull' };
  await setMember(team.id);
  return { ok: true };
}

export async function registerRunner(input: { raceId: string; runner: RunnerInput; waiverAccepted: boolean; lang: string }):
  Promise<Err | ({ runnerId: string } & (Checkout | { done: true }))> {
  const teamId = await getMemberTeamId();
  if (!teamId) return { error: 'p_joinSub' };
  const team = await getTeam(teamId);
  const race = await openRace(input.raceId);
  if ('error' in race) return race;
  if (!team || team.race_id !== race.id) return { error: 'p_joinSub' };
  const f = input.runner || ({} as RunnerInput);
  const runner: RunnerInput = {
    first_name: clean(f.first_name, 80), last_name: clean(f.last_name, 120), email: clean(f.email, 160), phone: clean(f.phone, 40),
    birth_date: clean(f.birth_date, 10), gender: clean(f.gender, 2), shirt_size: clean(f.shirt_size, 4),
    emergency_name: clean(f.emergency_name, 120), emergency_phone: clean(f.emergency_phone, 40),
  };
  if (Object.values(runner).some((v) => !v)) return { error: 'required' };
  if (input.waiverAccepted !== true) return { error: 'p_waiverAccept' };
  if ((await countRunners(team.id)) >= teamSizeOf(team, race)) return { error: 'p_teamFull' };
  const due = await feeForNewRunner(race, team);
  const row = await createRunner(race, team.id, runner, { lang: input.lang === 'en' ? 'en' : 'es', ...due });
  if (row.fee <= 0) return { runnerId: row.id, done: true };
  const co = await checkout('runner', row.id, row.fee, 1, `${race.name} — Inscripción ${row.first_name} ${row.last_name}`, row.email,
    `/done?runner=${row.id}`, `/done?runner=${row.id}&canceled=1`);
  return { runnerId: row.id, ...co };
}

// Public confirmation page data. Shows only name, bib, team and payment state.
export async function confirmRunner(input: { runnerId: string; sessionId?: string; payToken?: string }) {
  const r = await getRunner(input.runnerId);
  if (!r) return { error: 'not_found' } as Err;
  if (r.payment_status !== 'paid' && (input.sessionId || input.payToken)) await confirmPayment('runner', r.id, input);
  const fresh = (await getRunner(r.id))!;
  const team = await getTeam(fresh.team_id);
  return {
    runner: {
      id: fresh.id, bib: fresh.bib, first_name: fresh.first_name, last_name: fresh.last_name, fee: fresh.fee,
      payment_status: fresh.payment_status, team_name: team?.name || '', race_id: fresh.race_id,
    },
  };
}

// A runner retrying their own pending payment from the confirmation page.
export async function retryRunnerPayment(runnerId: string): Promise<Err | Checkout> {
  const teamId = await getMemberTeamId();
  const r = await getRunner(runnerId);
  if (!r || r.team_id !== teamId) return { error: 'p_joinSub' };
  if (r.payment_status === 'paid' || r.fee <= 0) return { error: 'paid' };
  const race = await getRace(r.race_id);
  return checkout('runner', r.id, r.fee, 1, `${race!.name} — Inscripción ${r.first_name} ${r.last_name}`, r.email, `/done?runner=${r.id}`, `/done?runner=${r.id}&canceled=1`);
}
