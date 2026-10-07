import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getRace, teamsOfRace, runnersOfRace, paymentsOfRace } from '@/lib/repo';
import { RaceDetail } from '@/components/admin';
import { agentsOfRace } from '@/lib/agents';
import { toARace, toATeams, toARunners, toAPayments, toASolos } from '../../data';

export default async function RacePage({ params }: { params: { raceId: string } }) {
  const race = await getRace(params.raceId);
  if (!race) notFound();
  const [teams, runners, payments, agents] = await Promise.all([teamsOfRace(race.id), runnersOfRace(race.id), paymentsOfRace(race.id), agentsOfRace(race.id)]);
  return (
    <Suspense>
      <RaceDetail race={toARace(race)} teams={toATeams(teams)} solos={toASolos(teams)} runners={toARunners(runners)} payments={toAPayments(payments)}
        agents={agents.map((a) => ({ id: a.id, name: a.name, email: a.email, phone: a.phone, gender: a.gender, half_avg_min: a.half_avg_min, city: a.city, message: a.message, paid_claim: a.paid_claim, status: a.status, team_id: a.team_id, notes: a.notes, created_at: a.created_at }))} />
    </Suspense>
  );
}
