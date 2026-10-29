// Live timing: checkpoints, check-ins and the leaderboard ranking.
import { many, one, run } from './db';
import { newId, now } from './ids';
import { isListedTeam, type Race, type Team } from './repo';
import { categoryOf, divisionOf, groupFor, parseGroups } from './groups';
import { START, rankTeams, type Checkpoint, type Checkin, type BoardTeam, type Board } from './timing-shared';
export * from './timing-shared';

export const checkpointsOf = async (raceId: string) =>
  (await many<Checkpoint & { km: string | null }>('SELECT id, race_id, num, name, km FROM race_checkpoints WHERE race_id = ? ORDER BY num', [raceId]))
    .map((c) => ({ ...c, km: c.km == null ? null : Number(c.km) }));
export const checkinsOf = (raceId: string) =>
  many<Checkin>('SELECT id, team_id, checkpoint_id, at, by_name FROM checkins WHERE race_id = ?', [raceId]);

export async function saveCheckpoints(raceId: string, list: { id?: string; num: number; name: string; km: number | null }[]) {
  const current = await checkpointsOf(raceId);
  const keep = new Set(list.filter((c) => c.id).map((c) => c.id));
  for (const c of current) if (!keep.has(c.id)) {
    await run('DELETE FROM checkins WHERE checkpoint_id = ?', [c.id]);
    await run('DELETE FROM race_checkpoints WHERE id = ?', [c.id]);
  }
  for (const c of list) {
    if (c.id && current.some((x) => x.id === c.id)) await run('UPDATE race_checkpoints SET num = ?, name = ?, km = ? WHERE id = ?', [c.num, c.name, c.km, c.id]);
    else await run('INSERT INTO race_checkpoints (id, race_id, num, name, km, created_at) VALUES (?,?,?,?,?,?)', [newId(), raceId, c.num, c.name, c.km, now()]);
  }
}

// One time per team per checkpoint: a second tap replaces the first.
export async function setCheckin(raceId: string, teamId: string, checkpointId: string, at: string, by: string | null) {
  await run(
    `INSERT INTO checkins (id, race_id, team_id, checkpoint_id, at, by_name, created_at) VALUES (?,?,?,?,?,?,?)
     ON CONFLICT (team_id, checkpoint_id) DO UPDATE SET at = EXCLUDED.at, by_name = EXCLUDED.by_name`,
    [newId(), raceId, teamId, checkpointId, at, by, now()]
  );
}
export const deleteCheckin = (raceId: string, teamId: string, checkpointId: string) =>
  run('DELETE FROM checkins WHERE race_id = ? AND team_id = ? AND checkpoint_id = ?', [raceId, teamId, checkpointId]);

/* ---------------- leaderboard ---------------- */
export async function buildBoard(race: Race): Promise<Board> {
  const [cps, cis, teams, runners] = await Promise.all([
    checkpointsOf(race.id), checkinsOf(race.id),
    many<Team>('SELECT * FROM teams WHERE race_id = ?', [race.id]),
    many<{ team_id: string; gender: string | null }>('SELECT team_id, gender FROM runners WHERE race_id = ?', [race.id]),
  ]);
  const groups = parseGroups(race.start_groups);
  const byTeam = new Map<string, Checkin[]>();
  for (const c of cis) byTeam.set(c.team_id, [...(byTeam.get(c.team_id) || []), c]);
  const numOf = new Map(cps.map((c) => [c.id, c.num]));
  const list: BoardTeam[] = teams.filter(isListedTeam).map((t) => {
    const mine = byTeam.get(t.id) || [];
    const start = mine.find((c) => c.checkpoint_id === START)?.at || null;
    const times: Record<string, number> = {}, clock: Record<string, string> = {};
    let last = start ? 0 : -1, lastMs: number | null = start ? 0 : null, lastAt: number | null = null;
    for (const c of mine) {
      if (c.checkpoint_id === START || !numOf.has(c.checkpoint_id)) continue;
      clock[c.checkpoint_id] = c.at;
      const n = numOf.get(c.checkpoint_id)!, at = Date.parse(c.at);
      const ms = start ? at - Date.parse(start) : NaN;
      if (ms >= 0) times[c.checkpoint_id] = ms;
      const elapsed = ms >= 0 ? ms : null;
      if (n > last || (n === last && (elapsed ?? Infinity) < (lastMs ?? Infinity))) { last = n; lastMs = elapsed; lastAt = at; }
    }
    const g = t.is_solo ? null : groupFor(t.half_avg_min, groups);
    return {
      id: t.id, no: t.team_no, name: t.name, logo: t.logo ? `/api/logo/${t.id}?v=${t.logo.length}` : null,
      category: categoryOf(runners.filter((r) => r.team_id === t.id).map((r) => r.gender), t.is_solo),
      div: divisionOf(t.team_size || race.team_size, t.is_solo),
      group: g?.label || null, groupColor: g?.color || null, start, times, clock, last, lastMs, lastAt,
    };
  });
  return { checkpoints: cps, teams: rankTeams(list), updated: now() };
}

