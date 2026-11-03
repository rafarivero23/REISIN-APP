import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRace } from '@/lib/repo';
import { getT } from '@/lib/lang';
import { brandKey, money } from '@/lib/format';
import { getOrder } from '@/lib/store';
import { confirmStoreOrder } from '@/app/actions/store';
import { SAV_KIT, BX_KIT } from '@/components/SavLanding';
import { ClearCart } from '@/components/ClearCart';

export const dynamic = 'force-dynamic';

// After checkout: confirm with Stripe (the webhook also does it) and show the order.
export default async function StoreDone({ params, searchParams }: { params: { raceId: string }; searchParams: { order?: string; session_id?: string } }) {
  const { lang } = getT();
  const race = await getRace(params.raceId);
  if (!race || !searchParams.order) notFound();
  if (searchParams.session_id) await confirmStoreOrder(searchParams.order, { sessionId: searchParams.session_id });
  const o = await getOrder(searchParams.order);
  if (!o || o.race_id !== race.id) notFound();
  const kit = brandKey(race.brand) === 'baja' ? BX_KIT : SAV_KIT;
  const tx = (es: string, en: string) => (lang === 'en' ? en : es);
  const paid = o.status !== 'pending' && o.status !== 'canceled';
  return (
    <div className={kit.key === 'bx' ? 'sv bxl' : 'sv'} style={{ display: 'contents' }}>
      <section className="st-hero sv-bleed st-hero-sm">
        <div className="sv-grid" aria-hidden />
        <img className="st-logo" src={`${kit.base}/${kit.logo}`} alt={race.name} />
        <h1>{paid ? tx('¡Gracias!', 'Thank you!') : tx('Pago pendiente', 'Payment pending')}</h1>
        <p className="mono">{tx('Pedido', 'Order')} #{o.order_no} · {o.name}</p>
      </section>
      {paid && <ClearCart raceId={race.id} />}
      <section className="st-done sv-bleed">
        <div>
          <span className="mono">{tx('Tu pedido', 'Your order')}</span>
          <ul>{o.items.map((i, k) => <li key={k}><span>{i.qty}× {i.name}{i.option ? ` · ${i.option}` : ''}</span><span>{money(i.qty * i.price, lang)}</span></li>)}
            {o.shipping > 0 && <li><span>{tx('Envío', 'Shipping')}</span><span>{money(o.shipping, lang)}</span></li>}
            <li className="t"><span>Total</span><b>{money(o.total, lang)}</b></li></ul>
        </div>
        <div>
          <span className="mono">{tx('Entrega', 'Delivery')}</span>
          <p>{o.delivery === 'ship'
            ? <>{tx('Lo enviamos a:', 'We will ship it to:')}<br /><b>{o.address}</b></>
            : tx('Recógelo en la entrega de kits con tu número de pedido o el nombre de quien compró.', 'Pick it up at kit pickup with your order number or the buyer’s name.')}</p>
          <p className="muted">{tx('Te llegará el recibo de Stripe a', 'Your Stripe receipt goes to')} {o.email}.</p>
          <div className="row" style={{ gap: 12, marginTop: 18 }}>
            <Link className="sv-cta" href={`/r/${race.slug || race.id}/store`}>{tx('Seguir comprando', 'Keep shopping')} →</Link>
            <Link className="mono sv-ul" href={`/r/${race.slug || race.id}`}>{race.name}</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
