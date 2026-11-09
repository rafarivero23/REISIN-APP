import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth-guard';
import { getRace } from '@/lib/repo';
import { StatusSheet } from '@/components/StatusSheet';

export const dynamic = 'force-dynamic';

// Staff: printable team status (→ PDF for the group chat).
export default async function PrintStatus({ params }: { params: { raceId: string } }) {
  if (!(await getCurrentUser())) redirect('/login');
  const race = await getRace(params.raceId);
  if (!race) notFound();
  return <StatusSheet race={race} />;
}
