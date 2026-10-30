import { notFound } from 'next/navigation';
import { getRace, liveSoloCount } from '@/lib/repo';
import { getT } from '@/lib/lang';
import { CaptainLoginForm, SoloBuyForm } from '@/components/portal';
import { RaceHeader, Back } from '../../../shared';

// Solo runners: buy a spot (if the race sells them) or sign in with their code.
export default async function SoloLoginPage({ params }: { params: { raceId: string } }) {
  const { t, lang } = getT();
  const race = await getRace(params.raceId);
  if (!race) notFound();
  const selling = race.status === 'open' && race.solo_price > 0;
  const left = selling && race.solo_capacity != null ? Math.max(0, race.solo_capacity - (await liveSoloCount(race.id))) : null;
  return (
    <>
      <Back href={`/r/${race.id}`} />
      <RaceHeader race={race} lang={lang} />
      {selling && <SoloBuyForm raceId={race.id} raceName={race.name} price={race.solo_price} left={left} />}
      {selling && <h2 style={{ fontSize: 22, marginTop: 8 }}>{t('so_haveCode')}</h2>}
      <CaptainLoginForm raceId={race.id} brand={race.brand} solo />
    </>
  );
}
