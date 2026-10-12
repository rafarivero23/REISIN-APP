import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getRace, isListedTeam, type Team } from '@/lib/repo';
import { many } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-guard';
import { timingAccess } from '@/lib/team-session';
import { checkpointsOf, checkinsOf } from '@/lib/timing';
import { parseGroups, groupFor } from '@/lib/groups';
import { getT } from '@/lib/lang';
import { CheckinApp, TimingGate } from '@/components/checkin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Check-in', robots: { index: false } };

// Staff page to record times at the start and each checkpoint.
export default async function CheckinPage({ params }: { params: { raceId: string } }) {
  const { t } = getT();
  const race = await getRace(params.raceId);
  if (!race) notFound();
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
