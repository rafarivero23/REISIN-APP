import type { Metadata } from 'next';
import { StoreDeskPage } from '@/lib/store-desk-page';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Surtido de pedidos', robots: { index: false } };

// Staff link: orders to hand out at the merch table; mark each one as delivered.
export default function Page({ params }: { params: { raceId: string } }) {
  return <StoreDeskPage raceId={params.raceId} mode="fulfill" />;
}
