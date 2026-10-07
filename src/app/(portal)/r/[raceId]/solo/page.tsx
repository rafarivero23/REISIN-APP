import { notFound } from 'next/navigation';
import { getRace } from '@/lib/repo';
import { getT } from '@/lib/lang';
import { CaptainLoginForm } from '@/components/portal';
import { RaceHeader, Back } from '../../../shared';

// Solo runners sign in with their code (same login as captains).
export default async function SoloLoginPage({ params }: { params: { raceId: string } }) {
  const { lang } = getT();
  const race = await getRace(params.raceId);
  if (!race) notFound();
  return (
    <>
      <Back href={`/r/${race.id}`} />
      <RaceHeader race={race} lang={lang} />
      <CaptainLoginForm raceId={race.id} brand={race.brand} solo />
    </>
  );
}
