import { notFound } from 'next/navigation';
import { getRunner, getTeam, getRace } from '@/lib/repo';
import { readWaiverToken } from '@/lib/team-session';
import { getT } from '@/lib/lang';
import { fmtDT } from '@/lib/format';
import { WaiverSign } from '@/components/WaiverSign';
import { RaceHeader } from '../../shared';

// Personal link a runner gets to accept the waiver without logging in.
export default async function WaiverPage({ params }: { params: { token: string } }) {
  const { t, lang } = getT();
  const id = await readWaiverToken(params.token);
  const r = id ? await getRunner(id) : null;
  const race = r ? await getRace(r.race_id) : null;
  if (!r || !race) notFound();
  const team = await getTeam(r.team_id);
  const teamName = team?.is_solo ? 'Solo' : team?.name || '';
  return (
    <>
      <RaceHeader race={race} lang={lang} />
      <div className="card stack">
        <h2>{t('wv_title')}</h2>
        {r.waiver_accepted_at
          ? <p className="chip ok" style={{ alignSelf: 'flex-start' }}>{t('wv_already').replace('{d}', fmtDT(r.waiver_accepted_at, lang))}</p>
          : <WaiverSign token={params.token} intro={t('wv_hi').replace('{name}', r.first_name).replace('{team}', teamName).replace('{race}', race.name)} text={race.waiver || t('w_default')} />}
      </div>
    </>
  );
}
