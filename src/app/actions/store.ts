'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getCurrentUser } from '@/lib/auth-guard';
import { many, one, run } from '@/lib/db';
import { newId, now } from '@/lib/ids';
import { getRace } from '@/lib/repo';
import { stripe } from '@/lib/stripe';
import { signPayToken, verifyPayToken } from '@/lib/team-session';
import { createOrder, getOrder, markOrderPaid, productsOf, stockOf, type OrderItem, type StoreOption } from '@/lib/store';

const staff = async () => { if (!(await getCurrentUser())) throw new Error('Not signed in'); };
const done = () => { revalidatePath('/admin', 'layout'); revalidatePath('/r', 'layout'); };
function origin() {
  const h = headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  const proto = h.get('x-forwarded-proto') || (host?.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/* ---------- admin ---------- */
export async function saveStoreSettings(raceId: string, s: { on: boolean; pickup: boolean; shipFee: number | null }) {
  await staff();
  await run('UPDATE races SET store_on = ?, store_pickup = ?, store_ship_fee = ? WHERE id = ?',
    [!!s.on, !!s.pickup, s.shipFee == null || isNaN(s.shipFee) ? null : Math.max(0, Math.round(s.shipFee)), raceId]);
  done();
  return {};
}

export type ProductInput = { id?: string; name: string; description: string; price: number; stock: number; options: StoreOption[]; images: string[]; active: boolean };
export async function saveProduct(raceId: string, p: ProductInput): Promise<{ id?: string; error?: string }> {
  await staff();
  if (!p.name.trim()) return { error: 'required' };
  const options = p.options.filter((o) => o.label.trim()).map((o) => ({ label: o.label.trim(), stock: Math.max(0, Math.round(Number(o.stock) || 0)) }));
  const vals = [p.name.trim(), p.description || '', Math.max(0, Math.round(Number(p.price) || 0)), Math.max(0, Math.round(Number(p.stock) || 0)), JSON.stringify(options), JSON.stringify(p.images.slice(0, 12)), !!p.active];
  if (p.id) {
    await run('UPDATE store_products SET name = ?, description = ?, price = ?, stock = ?, options = ?, images = ?, active = ? WHERE id = ? AND race_id = ?', [...vals, p.id, raceId]);
    done();
    return { id: p.id };
  }
  const id = newId();
  const n = await one<{ n: number }>('SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM store_products WHERE race_id = ?', [raceId]);
  await run('INSERT INTO store_products (id, race_id, name, description, price, stock, options, images, active, sort, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [id, raceId, ...vals, Number(n?.n || 1), now()]);
  done();
  return { id };
}

export async function deleteProduct(raceId: string, id: string) {
  await staff();
  await run('DELETE FROM store_products WHERE id = ? AND race_id = ?', [id, raceId]);
  done();
  return {};
}

export async function moveProduct(raceId: string, id: string, dir: -1 | 1) {
  await staff();
  const list = await many<{ id: string }>('SELECT id FROM store_products WHERE race_id = ? ORDER BY sort, created_at', [raceId]);
  const i = list.findIndex((x) => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return {};
  [list[i], list[j]] = [list[j], list[i]];
  for (const [k, x] of list.entries()) await run('UPDATE store_products SET sort = ? WHERE id = ?', [k + 1, x.id]);
  done();
  return {};
}

const toBuf = (dataUrl: string) => {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  return m ? Buffer.from(m[1], 'base64') : null;
};
export async function uploadStoreImage(raceId: string, lg: string, sm: string, w: number, h: number): Promise<{ id?: string; error?: string }> {
  await staff();
  const a = toBuf(lg), b = toBuf(sm);
  if (!a || !b || a.length > 3_000_000 || b.length > 600_000) return { error: 'ph_bad' };
  const id = newId();
  await run('INSERT INTO store_images (id, race_id, lg, sm, w, h, created_at) VALUES (?,?,?,?,?,?,?)', [id, raceId, a, b, Math.round(w) || 0, Math.round(h) || 0, now()]);
  return { id };
}

export async function setOrderStatus(raceId: string, id: string, status: 'paid' | 'delivered' | 'canceled') {
  await staff();
  await run('UPDATE store_orders SET status = ? WHERE id = ? AND race_id = ? AND status <> ?', [status, id, raceId, 'pending']);
  done();
  return {};
}
export async function setOrderNotes(raceId: string, id: string, notes: string) {
  await staff();
  await run('UPDATE store_orders SET notes = ? WHERE id = ? AND race_id = ?', [notes || null, id, raceId]);
  done();
  return {};
}

/* ---------- public checkout ---------- */
type CartLine = { productId: string; option: string; qty: number };
type Buyer = { name: string; email: string; phone: string; delivery: 'pickup' | 'ship'; address: string };

// Units held by checkouts opened in the last 30 min (so two people can't buy the last one).
async function heldQty(raceId: string) {
  const rows = await many<{ items: string }>(`SELECT items FROM store_orders WHERE race_id = ? AND status = 'pending' AND created_at > ?`,
    [raceId, new Date(Date.now() - 30 * 60 * 1000).toISOString()]);
  const m = new Map<string, number>();
  for (const r of rows) for (const it of JSON.parse(r.items || '[]') as OrderItem[]) m.set(`${it.product_id}|${it.option}`, (m.get(`${it.product_id}|${it.option}`) || 0) + it.qty);
  return m;
}

export async function storeCheckout(raceId: string, cart: CartLine[], b: Buyer):
  Promise<{ error: string; detail?: string } | { url: string } | { simulated: true; orderId: string; payToken: string; total: number }> {
  const race = await getRace(raceId);
  if (!race || !race.store_on) return { error: 'st_closed' };
  if (!b.name.trim() || !b.email.trim() || !b.phone.trim()) return { error: 'required' };
  const ship = b.delivery === 'ship';
  if (ship && race.store_ship_fee == null) return { error: 'st_noShip' };
  if (!ship && !race.store_pickup) return { error: 'st_noPickup' };
  if (ship && b.address.trim().length < 10) return { error: 'st_address' };
  const lines = cart.filter((l) => l.qty > 0).slice(0, 40);
  if (!lines.length) return { error: 'st_empty' };
  const products = new Map((await productsOf(race.id, true)).map((p) => [p.id, p]));
  const held = await heldQty(race.id);
  const items: OrderItem[] = [];
  for (const l of lines) {
    const p = products.get(l.productId);
    if (!p) return { error: 'st_gone' };
    const qty = Math.min(20, Math.max(1, Math.round(l.qty)));
    const opt = p.options.length ? l.option : '';
    if (p.options.length && !p.options.some((o) => o.label === opt)) return { error: 'st_gone' };
    const free = stockOf(p, opt) - (held.get(`${p.id}|${opt}`) || 0);
    if (qty > free) return { error: 'st_stock', detail: `${p.name}${opt ? ` (${opt})` : ''}` };
    items.push({ product_id: p.id, name: p.name, option: opt, qty, price: p.price });
  }
  const subtotal = items.reduce((a, it) => a + it.qty * it.price, 0);
  const shipping = ship ? race.store_ship_fee || 0 : 0;
  const orderId = await createOrder({ race_id: race.id, name: b.name.trim(), email: b.email.trim(), phone: b.phone.trim(), delivery: ship ? 'ship' : 'pickup',
    address: ship ? b.address.trim() : null, items, subtotal, shipping, total: subtotal + shipping });
  const s = stripe();
  const back = `/r/${race.slug || race.id}/store`;
  if (!s) return { simulated: true, orderId, payToken: await signPayToken('store', orderId), total: subtotal + shipping };
  const session = await s.checkout.sessions.create({
    mode: 'payment',
    customer_email: b.email.trim(),
    line_items: [
      ...items.map((it) => ({ quantity: it.qty, price_data: { currency: 'mxn', unit_amount: it.price * 100, product_data: { name: `${it.name}${it.option ? ` · ${it.option}` : ''}` } } })),
      ...(shipping ? [{ quantity: 1, price_data: { currency: 'mxn', unit_amount: shipping * 100, product_data: { name: 'Envío' } } }] : []),
    ],
    metadata: { kind: 'store', id: orderId, qty: '1' },
    success_url: `${origin()}${back}/done?order=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin()}${back}?canceled=1`,
  });
  await run('UPDATE store_orders SET stripe_session_id = ? WHERE id = ?', [session.id, orderId]);
  return { url: session.url! };
}

// Success page / test checkout: confirm the payment and mark the order paid.
export async function confirmStoreOrder(orderId: string, proof: { sessionId?: string; payToken?: string }): Promise<{ ok: boolean }> {
  const o = await getOrder(orderId);
  if (!o) return { ok: false };
  if (o.status !== 'pending') return { ok: o.status !== 'canceled' };
  const s = stripe();
  if (s && proof.sessionId) {
    const session = await s.checkout.sessions.retrieve(proof.sessionId);
    if (session.metadata?.kind !== 'store' || session.metadata?.id !== orderId || session.payment_status !== 'paid') return { ok: false };
    await markOrderPaid(orderId, session.id);
  } else if (!s && proof.payToken && (await verifyPayToken(proof.payToken, 'store', orderId))) {
    await markOrderPaid(orderId, null);
  } else return { ok: false };
  done();
  return { ok: true };
}

