'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth-guard';
import { getRace } from '@/lib/repo';
import { timingAccess } from '@/lib/team-session';
import { withOrder, moveStock, liveQty, type Order, type OrderItem, type OrderLog } from '@/lib/store';

// Staff links for the race store (/r/<race>/pedidos to hand out, /r/<race>/ordenes to edit
// and refund). Admin login or the race's staff passcode (same as timing / check-in).
async function staffName(raceId: string): Promise<string | null> {
  const user = await getCurrentUser();
  if (user) return user.name || user.email;
  const race = await getRace(raceId);
  const a = race ? await timingAccess(race.id, race.timing_code) : null;
  return a ? a.name || 'Staff' : null;
}
const done = () => { revalidatePath('/r', 'layout'); revalidatePath('/admin', 'layout'); };
const log = (o: Order, by: string, text: string): string => JSON.stringify([...(o.history || []), { at: new Date().toISOString(), by, text } as OrderLog].slice(-60));
const label = (it: OrderItem) => `${it.name}${it.option ? ` (${it.option})` : ''}`;
type R = { error?: string };

export async function orderDeliver(raceId: string, orderId: string, delivered: boolean): Promise<R> {
  const who = await staffName(raceId);
  if (!who) return { error: 'Contraseña de staff vencida. Vuelve a entrar.' };
  const r = await withOrder(orderId, raceId, async (c, o) => {
    if (o.status === 'pending' || o.status === 'canceled') return { error: 'Este pedido no está pagado o fue cancelado.' };
    await c.query('UPDATE store_orders SET status = $1, delivered_at = $2, delivered_by = $3, history = $4 WHERE id = $5',
      [delivered ? 'delivered' : 'paid', delivered ? new Date().toISOString() : null, delivered ? who : null, log(o, who, delivered ? 'Surtido / entregado' : 'Entrega deshecha'), o.id]);
    return {};
  });
  done();
  return r || { error: 'No encontrado' };
}

export async function orderEdit(raceId: string, orderId: string, f: { name: string; email: string; phone: string; delivery: 'pickup' | 'ship'; address: string; notes: string }): Promise<R> {
  const who = await staffName(raceId);
  if (!who) return { error: 'Contraseña de staff vencida. Vuelve a entrar.' };
  if (!f.name.trim()) return { error: 'Falta el nombre.' };
  const r = await withOrder(orderId, raceId, async (c, o) => {
    const changed = (['name', 'email', 'phone', 'delivery', 'address', 'notes'] as const).filter((k) => String(f[k] || '') !== String((o as any)[k] || ''));
    if (!changed.length) return {};
    await c.query('UPDATE store_orders SET name = $1, email = $2, phone = $3, delivery = $4, address = $5, notes = $6, history = $7 WHERE id = $8',
      [f.name.trim(), f.email.trim(), f.phone.trim() || null, f.delivery === 'ship' ? 'ship' : 'pickup', f.address.trim() || null, f.notes.trim() || null,
        log(o, who, `Editó: ${changed.map((k) => ({ name: 'nombre', email: 'correo', phone: 'teléfono', delivery: 'entrega', address: 'dirección', notes: 'nota' })[k]).join(', ')}`), o.id]);
    return {};
  });
  done();
  return r || { error: 'No encontrado' };
}

// Change the size of one line: the old size goes back to stock, the new one comes out.
export async function orderSwap(raceId: string, orderId: string, idx: number, option: string): Promise<R> {
  const who = await staffName(raceId);
  if (!who) return { error: 'Contraseña de staff vencida. Vuelve a entrar.' };
  const r = await withOrder(orderId, raceId, async (c, o): Promise<R> => {
    const it = o.items[idx];
    if (!it || it.option === option) return {};
    const n = liveQty(it);
    if (!n) return { error: 'Esa línea ya fue reembolsada.' };
    const take = await moveStock(c, it.product_id, option, -n);
    if (!take.ok) throw new Error(`STOCK:${take.left}`);
    await moveStock(c, it.product_id, it.option, n);
    const prev = it.option;
    const items = o.items.map((x, i) => (i === idx ? { ...x, option } : x));
    await c.query('UPDATE store_orders SET items = $1, history = $2 WHERE id = $3', [JSON.stringify(items), log(o, who, `Cambio de talla: ${n}× ${it.name} ${prev} → ${option}`), o.id]);
    return {};
  }).catch((e: Error) => (e.message.startsWith('STOCK:') ? { error: `No hay suficientes en esa talla (quedan ${e.message.slice(6)}).` } : Promise.reject(e)));
  done();
  return r || { error: 'No encontrado' };
}

// Cash refund for some units; optionally puts them back in inventory.
export async function orderRefund(raceId: string, orderId: string, input: { lines: { idx: number; qty: number }[]; amount: number; restock: boolean; note: string }): Promise<R> {
  const who = await staffName(raceId);
  if (!who) return { error: 'Contraseña de staff vencida. Vuelve a entrar.' };
  const amount = Math.max(0, Math.round(Number(input.amount) || 0));
  const lines = input.lines.filter((l) => l.qty > 0);
  if (!lines.length && !amount) return { error: 'Elige qué productos se reembolsan o escribe el monto.' };
  const r = await withOrder(orderId, raceId, async (c, o): Promise<R> => {
    if (o.status === 'pending') return { error: 'Este pedido no está pagado.' };
    if (amount > o.total - o.refunded) return { error: `El reembolso no puede pasar de $${(o.total - o.refunded).toLocaleString('es-MX')}.` };
    const items = o.items.map((x) => ({ ...x }));
    const parts: string[] = [];
    for (const l of lines) {
      const it = items[l.idx];
      if (!it) continue;
      const q = Math.min(liveQty(it), Math.round(l.qty));
      if (q <= 0) continue;
      it.refunded = (it.refunded || 0) + q;
      if (input.restock) await moveStock(c, it.product_id, it.option, q);
      parts.push(`${q}× ${label(it)}`);
    }
    const allBack = items.every((x) => liveQty(x) === 0);
    const status = allBack && o.refunded + amount >= o.subtotal ? 'canceled' : o.status;
    const text = `Reembolso en efectivo $${amount.toLocaleString('es-MX')}${parts.length ? ` · ${parts.join(', ')}` : ''}${parts.length ? (input.restock ? ' · regresó a inventario' : ' · no regresó a inventario') : ''}${input.note.trim() ? ` · ${input.note.trim()}` : ''}`;
    await c.query('UPDATE store_orders SET items = $1, refunded = refunded + $2, status = $3, history = $4 WHERE id = $5',
      [JSON.stringify(items), amount, status, log(o, who, text), o.id]);
    return {};
  });
  done();
  return r || { error: 'No encontrado' };
}
