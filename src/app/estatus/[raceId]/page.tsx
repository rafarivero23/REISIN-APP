import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getRace } from '@/lib/repo';
import { getCurrentUser } from '@/lib/auth-guard';
import { hasRaceAccess } from '@/lib/team-session';
import { StatusSheet } from '@/components/StatusSheet';
import { RaceGate } from '@/components/racepage';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { raceId: string } }): Promise<Metadata> {
  const race = await getRace(params.raceId);
  return { title: race ? `Estatus de equipos · ${race.name}` : 'Estatus de equipos' };
}

// Public, live team status (same info as the PDF: no contact data, amounts or notes).
// Uses the race page password if the race has one.
export default async function LiveStatus({ params }: { params: { raceId: string } }) {
  const race = await getRace(params.raceId);
  if (!race) notFound();
  const locked = !!race.access_code && !(await hasRaceAccess(race.id, race.access_code)) && !(await getCurrentUser());
  if (locked) return <div className="ss-gate"><RaceGate raceId={race.id} /></div>;
  return <StatusSheet race={race} live />;
}
