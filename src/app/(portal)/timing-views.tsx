import { getRace, isListedTeam, type Race, type Team } from '@/lib/repo';
import { many, one } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-guard';
import { timingAccess } from '@/lib/team-session';
import { buildBoard, checkpointsOf, checkinsOf, START } from '@/lib/timing';
import { parseGroups, groupFor } from '@/lib/groups';
import { getT } from '@/lib/lang';
import { CheckinApp, TimingGate } from '@/components/checkin';
import { Leaderboard } from '@/components/leaderboard';
import { RaceHeader } from './shared';

// The race the short URLs (/leaderboard, /checkpoint/…) point to: the open
// race with checkpoints closest to today, else the latest one with checkpoints.
export async function currentTimingRace(): Promise<Race | null> {
  const r = await one<{ id: string }>(
    `SELECT r.id FROM races r WHERE EXISTS (SELECT 1 FROM race_checkpoints c WHERE c.race_id = r.id)
     ORDER BY (r.status = 'open') DESC, abs(coalesce(r.race_date::date, now()::date) - now()::date) LIMIT 1`);
  return r ? getRace(r.id) : null;
}

export async function LeaderboardView({ race }: { race: Race }) {
  const { t, lang } = getT();
  if (!race.board_public && !(await getCurrentUser())) {
    return (<><RaceHeader race={race} lang={lang} /><div className="card empty">{t('lb_hidden')}</div></>);
  }
  const board = await buildBoard(race);
  return (
    <div className="lb-wide stack">
      <RaceHeader race={race} lang={lang} />
      <Leaderboard board={board} />
    </div>
  );
}

export async function CheckinView({ race }: { race: Race }) {
  const { t } = getT();
  const user = await getCurrentUser();
  const access = user ? { name: user.name || user.email } : await timingAccess(race.id, race.timing_code);
  if (!access) {
    return race.timing_code
      ? <TimingGate raceId={race.id} raceName={race.name} />
      : <div className="card empty">{t('tm_noCode')}</div>;
  }
  const groups = parseGroups(race.start_groups);
  const [cps, cis, teams] = await Promise.all([checkpointsOf(race.id), checkinsOf(race.id), many<Team>('SELECT * FROM teams WHERE race_id = ?', [race.id])]);
  const list = teams.filter(isListedTeam).map((x) => ({ id: x.id, no: x.team_no, name: x.name, solo: x.is_solo, group: x.is_solo ? null : groupFor(x.half_avg_min, groups)?.label || null }))
    .sort((a, b) => (a.no ?? 1e9) - (b.no ?? 1e9) || a.name.localeCompare(b.name));
  return (
    <div className="lb-wide">
      <CheckinApp raceId={race.id} raceName={race.name} staff={access.name} teams={list}
        checkpoints={cps.map((c) => ({ id: c.id, num: c.num, name: c.name, km: c.km }))}
        checkins={cis.map((c) => ({ team_id: c.team_id, checkpoint_id: c.checkpoint_id, at: c.at, by: c.by_name }))}
        waves={[...groups.map((g) => g.label), ...(list.some((x) => x.solo) ? ['solo'] : [])]} />
    </div>
  );
}
