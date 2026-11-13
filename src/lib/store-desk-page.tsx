import { notFound } from 'next/navigation';
import { getRace } from '@/lib/repo';
import { getCurrentUser } from '@/lib/auth-guard';
import { timingAccess } from '@/lib/team-session';
import { ordersOf, productsOf } from '@/lib/store';
import { TimingGate } from '@/components/checkin';
import { StoreDesk, type DeskProduct } from '@/components/StoreDesk';

// Shared loader for the two staff store links (same passcode as timing / check-in).
export async function StoreDeskPage({ raceId, mode }: { raceId: string; mode: 'fulfill' | 'manage' }) {
  const race = await getRace(raceId);
  if (!race) notFound();
  const user = await getCurrentUser();
  const access = user ? { name: user.name || user.email } : await timingAccess(race.id, race.timing_code);
  const title = mode === 'fulfill' ? 'Surtido de pedidos' : 'Órdenes de la tienda';
  if (!access) {
    return race.timing_code ? <TimingGate raceId={race.id} raceName={`${race.name} · ${title}`} />
      : <div className="card empty">Configura la contraseña de staff en Admin → Cronometraje.</div>;
  }
  const [orders, products] = await Promise.all([ordersOf(race.id), productsOf(race.id)]);
  const prods: DeskProduct[] = products.map((p) => ({ id: p.id, name: p.name, options: p.options.map((o) => ({ label: o.label, stock: o.stock })) }));
  const base = `/r/${race.slug || race.id}`;
  return <StoreDesk raceId={race.id} raceName={race.name} staff={access.name} mode={mode} orders={orders} products={prods} base={base} />;
}
