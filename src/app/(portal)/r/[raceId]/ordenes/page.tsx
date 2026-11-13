import type { Metadata } from 'next';
import { StoreDeskPage } from '@/lib/store-desk-page';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Órdenes de la tienda', robots: { index: false } };

// Staff link: edit orders, change sizes, record cash refunds and return items to stock.
export default function Page({ params }: { params: { raceId: string } }) {
  return <StoreDeskPage raceId={params.raceId} mode="manage" />;
}
