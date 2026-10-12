'use server';

import { revalidatePath } from 'next/cache';
import { getRace, getTeam, isListedTeam, type Team } from '@/lib/repo';
import { many, run } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-guard';
import { setTimingAccess, timingAccess } from '@/lib/team-session';
import { saveCheckpoints, setCheckin, deleteCheckin, checkpointsOf, START } from '@/lib/timing';
import { parseGroups, groupFor } from '@/lib/groups';

type Err = { error: string };
const str = (v: unknown, max = 120) => (v == null ? '' : String(v).trim().slice(0, max));

// Who may write times: staff logged into admin, or anyone with the passcode cookie.
async function writer(raceId: string): Promise<string | null> {
  const user = await getCurrentUser();
  if (user) return user.name || user.email;
  const race = await getRace(raceId);
  const a = race ? await timingAccess(race.id, race.timing_code) : null;
  return a ? a.name || 'Staff' : null;
}
const refresh = (raceId: string) => { revalidatePath(`/r/${raceId}/leaderboard`); revalidatePath(`/r/${raceId}/checkin`); };
const validAt = (at: string) => { const d = Date.parse(at); return Number.isFinite(d) && Math.abs(d - Date.now()) < 1000 * 60 * 60 * 24 * 400; };

export async function timingLogin(raceId: string, code: string, name: string): Promise<Err | { ok: true }> {
  const race = await getRace(raceId);
  if (!race?.timing_code) return { error: 'tm_noCode' };
  if (str(code).toLowerCase() !== race.timing_code.trim().toLowerCase()) return { error: 'p_badPass' };
  await setTimingAccess(race.id, race.timing_code, str(name, 60));
  return { ok: true };
}

export async function recordCheckin(raceId: string, teamId: string, checkpointId: string, at: string): Promise<Err | { ok: true }> {
  const by = await writer(raceId);
  if (!by) return { error: 'tm_locked' };
  const team = await getTeam(teamId);
  if (!team || team.race_id !== raceId) return { error: 'not_found' };
  if (checkpointId !== START && !(await checkpointsOf(raceId)).some((c) => c.id === checkpointId)) return { error: 'not_found' };
  if (!validAt(at)) return { error: 'tm_badTime' };
  await setCheckin(raceId, teamId, checkpointId, new Date(at).toISOString(), by);
  refresh(raceId);
  return { ok: true };
}

export async function removeCheckin(raceId: string, teamId: string, checkpointId: string): Promise<Err | { ok: true }> {
  if (!(await writer(raceId))) return { error: 'tm_locked' };
  await deleteCheckin(raceId, teamId, checkpointId);
  refresh(raceId);
  return { ok: true };
}

// Start a whole wave at once: every team in a start group (or all Solos) that
// hasn't started yet gets this start time.
export async function startWave(raceId: string, wave: string, at: string, overwrite = false): Promise<Err | { count: number }> {
  const by = await writer(raceId);
  if (!by) return { error: 'tm_locked' };
  const race = await getRace(raceId);
  if (!race || !validAt(at)) return { error: 'tm_badTime' };
  const groups = parseGroups(race.start_groups);
  const teams = (await many<Team>('SELECT * FROM teams WHERE race_id = ?', [raceId])).filter(isListedTeam);
  const started = new Set((await many<{ team_id: string }>('SELECT team_id FROM checkins WHERE race_id = ? AND checkpoint_id = ?', [raceId, START])).map((x) => x.team_id));
  const pick = teams.filter((t) => (wave === 'solo' ? t.is_solo : wave === 'all' ? true : !t.is_solo && groupFor(t.half_avg_min, groups)?.label === wave));
  let count = 0;
  for (const t of pick) {
    if (started.has(t.id) && !overwrite) continue;
    await setCheckin(raceId, t.id, START, new Date(at).toISOString(), by);
    count++;
  }
  refresh(raceId);
  return { count };
}

/* ---------------- admin ---------------- */
async function guard() {
  if (!(await getCurrentUser())) throw new Error('Not signed in');
}
export async function saveTiming(raceId: string, input: { timing_code: string; board_public: boolean; checkpoints: { id?: string; num: number | string; name: string; km: number | string | null }[] }): Promise<{ error?: string }> {
  await guard();
  const code = str(input.timing_code, 40);
  if (code && code.length < 4) return { error: 'p_passMin' };
  const cps = (input.checkpoints || []).slice(0, 60).map((c) => ({
    id: c.id || undefined, num: Math.max(1, Math.round(Number(c.num) || 0)), name: str(c.name, 60),
    km: c.km === '' || c.km == null || isNaN(Number(c.km)) ? null : Math.round(Number(c.km) * 100) / 100,
  })).filter((c) => c.name);
  if (new Set(cps.map((c) => c.num)).size !== cps.length) return { error: 'tm_dupNum' };
  await run('UPDATE races SET timing_code = ?, board_public = ? WHERE id = ?', [code || null, !!input.board_public, raceId]);
  await saveCheckpoints(raceId, cps);
  revalidatePath('/admin', 'layout');
  refresh(raceId);
  return {};
}

// Numbers every team (and Solo) without one: teams first, alphabetically.
export async function assignTeamNumbers(raceId: string, from = 1): Promise<{ count: number }> {
  await guard();
  const teams = (await many<Team>('SELECT * FROM teams WHERE race_id = ?', [raceId])).filter(isListedTeam);
  const used = new Set(teams.map((t) => t.team_no).filter((n): n is number => n != null));
  let n = Math.max(1, Math.round(from) || 1), count = 0;
  const todo = teams.filter((t) => t.team_no == null).sort((a, b) => Number(a.is_solo) - Number(b.is_solo) || a.name.localeCompare(b.name));
  for (const t of todo) {
    while (used.has(n)) n++;
    await run('UPDATE teams SET team_no = ? WHERE id = ?', [n, t.id]);
    used.add(n); count++;
  }
  revalidatePath('/admin', 'layout');
  refresh(raceId);
  return { count };
}
export async function setTeamNumber(teamId: string, no: string): Promise<{ error?: string }> {
  await guard();
  const team = await getTeam(teamId);
  if (!team) return { error: 'not_found' };
  const n = no === '' ? null : Math.round(Number(no));
  if (n != null && !(n > 0)) return { error: 'required' };
  if (n != null) {
    const dup = await many('SELECT 1 FROM teams WHERE race_id = ? AND team_no = ? AND id <> ?', [team.race_id, n, team.id]);
    if (dup.length) return { error: 'tm_noTaken' };
  }
  await run('UPDATE teams SET team_no = ? WHERE id = ?', [n, team.id]);
  revalidatePath('/admin', 'layout');
  refresh(team.race_id);
  return {};
}
