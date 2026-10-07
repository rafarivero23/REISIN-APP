import Link from 'next/link';
import { Suspense } from 'react';
import { getTeam, getRace, runnersOfTeam, isHoldRace, paidSlots, teamSizeOf, captainSizeOptions } from '@/lib/repo';
import { getCaptainTeamId } from '@/lib/team-session';
import { getT } from '@/lib/lang';
import { CaptainDash, SoloDash } from '@/components/portal';
import { CaptainAgents } from '@/components/agents';
import { openAgents, invitesOfTeam } from '@/lib/agents';

export default async function CaptainPage() {
  const { t } = getT();
  const teamId = await getCaptainTeamId();
  const team = teamId ? await getTeam(teamId) : null;
  const race = team ? await getRace(team.race_id) : null;
  if (!team || !race) {
    return (
      <div className="card empty">{t('p_captainSub')}<div style={{ marginTop: 12 }}><Link className="btn btn-primary" href="/">{t('p_pick')}</Link></div></div>
    );
  }
  if (team.is_solo) {
    const r = (await runnersOfTeam(team.id))[0];
    return (
      <SoloDash name={team.name} raceName={race.name} waiverText={race.waiver || ''} raceId={race.id} code={team.claim_code}
        runner={r ? { id: r.id, bib: r.bib, first_name: r.first_name, last_name: r.last_name, shirt_size: r.shirt_size, waiver: !!r.waiver_accepted_at } : null} />
    );
  }
  const runners = (await runnersOfTeam(team.id)).map((r) => ({
    id: r.id, bib: r.bib, first_name: r.first_name, last_name: r.last_name, shirt_size: r.shirt_size, fee: r.fee, payment_status: r.payment_status,
  }));
  const [agents, invs] = await Promise.all([openAgents(race.id), invitesOfTeam(team.id)]);
  const invited = new Set(invs.filter((i) => i.status === 'pending').map((i) => i.agent_id));
  const capAgents = agents.map((a) => ({ id: a.id, name: a.name, gender: a.gender, half_avg_min: a.half_avg_min, city: a.city, message: a.message,
    paid_claim: a.paid_claim, created_at: a.created_at, email: a.email, phone: a.phone, invited: invited.has(a.id) }));
  const spotsLeft = teamSizeOf(team, race) - runners.length;
  return (
    <Suspense>
      <CaptainDash
        team={{ name: team.name, category: team.category, payment_status: team.payment_status, claim_code: team.claim_code, has_password: !!team.password_hash,
          half_avg_min: team.half_avg_min, captain_name: team.captain_name, captain_email: team.captain_email, captain_phone: team.captain_phone, logo: team.logo ? `/api/logo/${team.id}?v=${team.logo.length}` : null }}
        race={{ id: race.id, name: race.name, team_size: race.team_size, runner_fee: race.runner_fee, sizes: captainSizeOptions(race) }}
        slots={{ hold: isHoldRace(race), size: teamSizeOf(team, race), paid: paidSlots(team, race) }}
        runners={runners}
      />
      <div style={{ marginTop: 20 }}><CaptainAgents agents={capAgents} spotsLeft={spotsLeft} /></div>
    </Suspense>
  );
}
