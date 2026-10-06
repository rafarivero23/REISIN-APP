'use server';

// "Busco equipo" — public listing of runners looking for a team. The runner
// owns their listing through a signed cookie (or private link); captains
// invite them from their dashboard; accepting lets them register straight
// into that team without the team password.
import { revalidatePath } from 'next/cache';
import { getRace, getTeam, countRunners, teamSizeOf } from '@/lib/repo';
import {
  createAgent, updateAgent, getAgent, setAgentStatus, invite, getInvite, setInviteStatus, setAgentNotes, deleteAgent, type AgentInput,
} from '@/lib/agents';
import { parseHalf } from '@/lib/groups';
import { getCurrentUser } from '@/lib/auth-guard';
import { agentToken, setAgent, getAgentId, readAgentToken, clearAgent, getCaptainTeamId, setMember } from '@/lib/team-session';

type Err = { error: string };
const clean = (v: unknown, max = 200) => (v == null ? '' : String(v).trim().slice(0, max));

function input(f: Record<string, unknown>): AgentInput | Err {
  const name = clean(f.name, 120), email = clean(f.email, 160).toLowerCase();
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !clean(f.phone, 40)) return { error: 'required' };
  const half = clean(f.half, 12);
  const m = parseHalf(half);
  if (half && !m) return { error: 'half_bad' };
  return {
    name, email, phone: clean(f.phone, 40), gender: ['F', 'M', 'X'].includes(String(f.gender)) ? String(f.gender) : null,
    half_avg_min: m, city: clean(f.city, 80) || null, message: clean(f.message, 500) || null, paid_claim: f.paid_claim === true,
  };
}

export async function saveListing(raceId: string, f: Record<string, unknown>): Promise<Err | { ok: true; link: string }> {
  const race = await getRace(raceId);
  if (!race || race.status !== 'open') return { error: 'race_closed' };
  const data = input(f);
  if ('error' in data) return data;
  let id = await getAgentId();
  const mine = id ? await getAgent(id) : null;
  if (mine && mine.race_id === raceId) await updateAgent(mine.id, data);
  else id = await createAgent(raceId, data);
  if (mine?.status === 'closed') await setAgentStatus(mine.id, 'open');
  const token = await agentToken(id!);
  await setAgent(token);
  revalidatePath(`/r/${raceId}/agents`);
  return { ok: true, link: `/r/${raceId}/agents?k=${token}` };
}

// Opening the private link on another device.
export async function claimListing(token: string): Promise<{ ok: boolean }> {
  const id = await readAgentToken(token);
  if (!id || !(await getAgent(id))) return { ok: false };
  await setAgent(token);
  return { ok: true };
}

export async function myListingLink(raceId: string) {
  const id = await getAgentId();
  return id ? `/r/${raceId}/agents?k=${await agentToken(id)}` : null;
}

export async function closeListing(): Promise<{ ok: true }> {
  const id = await getAgentId();
  const a = id ? await getAgent(id) : null;
  if (a && a.status === 'open') await setAgentStatus(a.id, 'closed');
  if (a) revalidatePath(`/r/${a.race_id}/agents`);
  return { ok: true };
}

export async function forgetListing() {
  clearAgent();
}

/* ---------- captain side ---------- */
export async function inviteAgent(agentId: string): Promise<Err | { ok: true }> {
  const teamId = await getCaptainTeamId();
  const team = teamId ? await getTeam(teamId) : null;
  const a = await getAgent(agentId);
  if (!team || !a || a.race_id !== team.race_id) return { error: 'p_captainSub' };
  if (a.status !== 'open') return { error: 'fa_taken' };
  const race = await getRace(team.race_id);
  if ((await countRunners(team.id)) >= teamSizeOf(team, race!)) return { error: 'p_teamFull' };
  await invite(a.id, team.id);
  revalidatePath('/captain');
  return { ok: true };
}

/* ---------- runner answers ---------- */
export async function answerInvite(inviteId: string, accept: boolean): Promise<Err | { ok: true; raceId?: string }> {
  const agentId = await getAgentId();
  const inv = await getInvite(inviteId);
  if (!agentId || !inv || inv.agent_id !== agentId) return { error: 'not_found' };
  const a = (await getAgent(agentId))!;
  if (!accept) {
    await setInviteStatus(inv.id, 'declined');
    revalidatePath(`/r/${a.race_id}/agents`);
    return { ok: true };
  }
  const team = await getTeam(inv.team_id);
  const race = team ? await getRace(team.race_id) : null;
  if (!team || !race || race.status !== 'open') return { error: 'race_closed' };
  if ((await countRunners(team.id)) >= teamSizeOf(team, race)) return { error: 'p_teamFull' };
  await setInviteStatus(inv.id, 'accepted');
  await setAgentStatus(a.id, 'matched', team.id);
  await setMember(team.id); // lets them register into this team without the password
  return { ok: true, raceId: race.id };
}

/* ---------- staff ---------- */
async function guard() {
  if (!(await getCurrentUser())) throw new Error('Not signed in');
}
export async function staffSetAgentStatus(id: string, status: 'open' | 'matched' | 'closed') {
  await guard();
  const a = await getAgent(id);
  if (a) await setAgentStatus(id, status, status === 'matched' ? a.team_id : null);
  revalidatePath('/admin', 'layout');
  return {};
}
export async function staffAgentNotes(id: string, notes: string) {
  await guard();
  await setAgentNotes(id, clean(notes, 2000) || null);
  revalidatePath('/admin', 'layout');
  return {};
}
export async function staffDeleteAgent(id: string) {
  await guard();
  await deleteAgent(id);
  revalidatePath('/admin', 'layout');
  return {};
}
