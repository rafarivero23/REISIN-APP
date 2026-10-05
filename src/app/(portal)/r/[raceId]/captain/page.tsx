import { notFound } from 'next/navigation';
import { getRace } from '@/lib/repo';
import { getT } from '@/lib/lang';
import { CaptainLoginForm } from '@/components/portal';
import { RaceHeader, Back } from '../../../shared';

// Captains can sign in even after registration closes, to see their roster.
export default async function CaptainLoginPage({ params }: { params: { raceId: string } }) {
  const { lang } = getT();
  const race = await getRace(params.raceId);
  if (!race) notFound();
  return (
    <>
      <Back href={`/r/${race.id}`} />
      <RaceHeader race={race} lang={lang} />
      <CaptainLoginForm raceId={race.id} brand={race.brand} />
    </>
  );
}
