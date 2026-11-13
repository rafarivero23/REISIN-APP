import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getRace } from '@/lib/repo';
import { getCurrentUser } from '@/lib/auth-guard';
import { hasRaceAccess } from '@/lib/team-session';
import { guideOf } from '@/lib/guideDb';
import { parseGuide } from '@/lib/staffGuide';
import { brandKey } from '@/lib/format';
import { StaffGuide, GuideGate } from '@/components/StaffGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { raceId: string } }): Promise<Metadata> {
  const race = await getRace(params.raceId);
  return { title: race ? `Guía de staff · ${race.name}` : 'Guía de staff', robots: { index: false, follow: false } };
}

// Public staff guide behind its own password (set in Admin → Guía staff).
// Signed-in staff skip the password.
export default async function GuidePage({ params }: { params: { raceId: string } }) {
  const race = await getRace(params.raceId);
  if (!race) notFound();
  const g = await guideOf(race.id);
  if (!g) notFound();
  const open = (await getCurrentUser()) || (await hasRaceAccess('guide:' + race.id, g.password));
  if (!open) return <GuideGate raceId={race.id} raceName={race.name} />;
  const ref = race.slug || race.id;
  const bx = brandKey(race.brand) === 'baja';
  return <StaffGuide raceName={race.name} data={parseGuide(g.data)} links={bx ? { plan: `/ruta/${ref}`, gpx: '/routes/baja-crossing-2026.gpx' } : {}} updated={g.updated_at} />;
}
