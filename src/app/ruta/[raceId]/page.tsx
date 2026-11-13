import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getRace } from '@/lib/repo';
import { brandKey } from '@/lib/format';
import { RoutePlan } from '@/components/RoutePlan';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { raceId: string } }): Promise<Metadata> {
  const race = await getRace(params.raceId);
  return { title: race ? `Plan de ruta · ${race.name}` : 'Plan de ruta' };
}

// Public route & ambulance plan (no login): paces, checkpoints and ambulance
// positions over time. Baja Crossing only. No runner or team data.
export default async function RoutePlanPage({ params }: { params: { raceId: string } }) {
  const race = await getRace(params.raceId);
  if (!race || brandKey(race.brand) !== 'baja') notFound();
  return <RoutePlan raceName={race.name} />;
}
