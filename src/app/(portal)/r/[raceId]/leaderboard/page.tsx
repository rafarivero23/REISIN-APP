import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getRace } from '@/lib/repo';
import { LeaderboardView } from '../../../timing-views';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: { raceId: string } }): Promise<Metadata> {
  const race = await getRace(params.raceId);
  return { title: race ? `${race.name} · Leaderboard` : 'Leaderboard' };
}
export default async function LeaderboardPage({ params }: { params: { raceId: string } }) {
  const race = await getRace(params.raceId);
  if (!race) notFound();
  return <LeaderboardView race={race} />;
}
