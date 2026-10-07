import { getT } from '@/lib/lang';
import { getTeam, getRace, feeForNewRunner } from '@/lib/repo';
import { getMemberTeamId } from '@/lib/team-session';
import { RegisterForm } from '@/components/portal';
import { Back, loadOpenRace, Closed } from '../../../shared';

export default async function RegisterPage({ params }: { params: { raceId: string } }) {
  const { t } = getT();
  const res = await loadOpenRace(params.raceId);
  if ('closed' in res) return <Closed name={res.closed} />;
  const teamId = await getMemberTeamId();
  const team = teamId ? await getTeam(teamId) : null;
  if (!team || team.race_id !== res.race.id) {
    return (
      <>
        <Back href={`/r/${params.raceId}/join`} />
        <div className="card empty">{t('p_joinSub')}</div>
      </>
    );
  }
  return (
    <>
      <Back href={team.is_solo ? '/captain' : `/r/${params.raceId}/join`} />
      <RegisterForm race={res.race} teamName={team.is_solo ? 'Solo' : team.name}
        prefill={team.is_solo ? { first_name: team.captain_name.split(/\s+/)[0] || '', last_name: team.captain_name.split(/\s+/).slice(1).join(' '), email: team.captain_email, phone: team.captain_phone || '' } : undefined} feeDue={(await feeForNewRunner((await getRace(res.race.id))!, team)).fee} />
    </>
  );
}
