import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getRace, teamsOfRace, runnersOfRace, paymentsOfRace } from '@/lib/repo';
import { RaceDetail } from '@/components/admin';
import { toARace, toATeams, toARunners, toAPayments } from '../../data';

export default async function RacePage({ params }: { params: { raceId: string } }) {
  const race = await getRace(params.raceId);
  if (!race) notFound();
  const [teams, runners, payments] = await Promise.all([teamsOfRace(race.id), runnersOfRace(race.id), paymentsOfRace(race.id)]);
  return (
    <Suspense>
      <RaceDetail race={toARace(race)} teams={toATeams(teams)} runners={toARunners(runners)} payments={toAPayments(payments)} />
    </Suspense>
  );
}
