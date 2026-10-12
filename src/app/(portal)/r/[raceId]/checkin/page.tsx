import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getRace } from '@/lib/repo';
import { CheckinView } from '../../../timing-views';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Check-in', robots: { index: false } };
export default async function CheckinPage({ params }: { params: { raceId: string } }) {
  const race = await getRace(params.raceId);
  if (!race) notFound();
  return <CheckinView race={race} />;
}
