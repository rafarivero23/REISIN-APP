import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getRace, teamsOfRace, runnersOfRace, isRacingTeam } from '@/lib/repo';
import { getCurrentUser } from '@/lib/auth-guard';
import { timingAccess, waiverToken } from '@/lib/team-session';
import { parseGroups, groupFor, categoryOf } from '@/lib/groups';
import { teamSlots } from '@/lib/stats';
import { noLabel, noSort } from '@/lib/timing-shared';
import { TimingGate } from '@/components/checkin';
import { KitApp, type KitTeam } from '@/components/KitApp';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Check-in de equipos', robots: { index: false } };

// Staff link for race-day check-in at kit pickup. Same passcode as timing check-in.
export default async function KitPage({ params }: { params: { raceId: string } }) {
  const race = await getRace(params.raceId);
  if (!race) notFound();
  const user = await getCurrentUser();
  const access = user ? { name: user.name || user.email } : await timingAccess(race.id, race.timing_code);
  if (!access) {
    return race.timing_code ? <TimingGate raceId={race.id} raceName={`${race.name} · Check-in de equipos`} />
      : <div className="card empty">Configura la contraseña de staff en Admin → Cronometraje.</div>;
  }
  const [teams, runners] = await Promise.all([teamsOfRace(race.id), runnersOfRace(race.id)]);
  const groups = parseGroups(race.start_groups);
  const branch = (b: string | null) => (b === 'femenil' ? 'Femenil' : b === 'mixto' ? 'Mixto' : b === 'varonil' ? 'Varonil' : '');
  const list: KitTeam[] = [];
  for (const t of teams.filter(isRacingTeam)) {
    const rs = runners.filter((r) => r.team_id === t.id).sort((a, b) => (a.bib || 0) - (b.bib || 0));
    const sl = teamSlots(t, race);
    list.push({
      id: t.id, no: noLabel(t.team_no, t.is_solo), solo: t.is_solo, name: t.is_solo && rs[0] ? `${rs[0].first_name} ${rs[0].last_name}` : t.name,
      captain: t.captain_name, phone: t.captain_phone, size: sl.size,
      cat: branch(categoryOf(rs.map((r) => r.gender), t.is_solo)), group: t.is_solo ? null : groupFor(t.half_avg_min, groups)?.label || null,
      pay: sl.paid >= sl.size && sl.balance <= 0 ? 'paid' : t.payment_status !== 'paid' && sl.paid === 0 ? 'pending' : 'balance',
      runners: await Promise.all(rs.map(async (r) => ({ id: r.id, name: `${r.first_name} ${r.last_name}`.trim(), bib: r.bib, shirt: r.shirt_size, gender: r.gender,
        waiver: !!r.waiver_accepted_at, sign: r.waiver_accepted_at ? null : '/w/' + (await waiverToken(r.id)) }))),
      kit: t.kit_at ? { at: t.kit_at, by: t.kit_by || '', count: t.kit_count ?? 0, note: t.kit_note || '' } : null,
    });
  }
  list.sort((a, b) => noSort(a.no) - noSort(b.no) || a.name.localeCompare(b.name, 'es'));
  return <KitApp raceId={race.id} raceName={race.name} staff={access.name} teams={list} />;
}
