import Link from 'next/link';
import { Suspense } from 'react';
import { getTeam, getRace, runnersOfTeam, isHoldRace, paidSlots, teamSizeOf } from '@/lib/repo';
import { getCaptainTeamId } from '@/lib/team-session';
import { getT } from '@/lib/lang';
import { CaptainDash } from '@/components/portal';

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
  const runners = (await runnersOfTeam(team.id)).map((r) => ({
    id: r.id, bib: r.bib, first_name: r.first_name, last_name: r.last_name, shirt_size: r.shirt_size, fee: r.fee, payment_status: r.payment_status,
  }));
  return (
    <Suspense>
      <CaptainDash
        team={{ name: team.name, category: team.category, payment_status: team.payment_status, claim_code: team.claim_code, has_password: !!team.password_hash,
          half_avg_min: team.half_avg_min, logo: team.logo ? `/api/logo/${team.id}?v=${team.logo.length}` : null }}
        race={{ id: race.id, name: race.name, team_size: race.team_size, runner_fee: race.runner_fee }}
        slots={{ hold: isHoldRace(race), size: teamSizeOf(team, race), paid: paidSlots(team, race) }}
        runners={runners}
      />
    </Suspense>
  );
}
