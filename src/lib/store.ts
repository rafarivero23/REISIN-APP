import { many, one, run, pool, ensureSchema } from '@/lib/db';
import { newId, now } from '@/lib/ids';

import { type Product, type Order, type OrderItem, type StoreOption } from '@/lib/store-shared';
export * from '@/lib/store-shared';

const parse = <T,>(s: string | null | undefined, d: T): T => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
const toProduct = (r: any): Product => ({ ...r, options: parse<StoreOption[]>(r.options, []), images: parse<string[]>(r.images, []) });
const toOrder = (r: any): Order => ({ ...r, items: parse<OrderItem[]>(r.items, []) });

export async function productsOf(raceId: string, onlyActive = false) {
  const rows = await many(`SELECT * FROM store_products WHERE race_id = ? ${onlyActive ? 'AND active' : ''} ORDER BY sort, created_at`, [raceId]);
  return rows.map(toProduct);
}
export async function getProduct(id: string) {
  const r = await one('SELECT * FROM store_products WHERE id = ?', [id]);
  return r ? toProduct(r) : null;
}
export async function ordersOf(raceId: string) {
  return (await many(`SELECT * FROM store_orders WHERE race_id = ? AND status <> 'pending' ORDER BY created_at DESC`, [raceId])).map(toOrder);
}
export async function getOrder(id: string) {
  const r = await one('SELECT * FROM store_orders WHERE id = ?', [id]);
  return r ? toOrder(r) : null;
}

// Creates a pending order (prices and names come from the database, never the browser).
export async function createOrder(o: Omit<Order, 'id' | 'order_no' | 'status' | 'stripe_session_id' | 'paid_at' | 'notes' | 'created_at'>) {
  const id = newId();
  const n = await one<{ n: number }>('SELECT COALESCE(MAX(order_no), 1000) + 1 AS n FROM store_orders WHERE race_id = ?', [o.race_id]);
  await run(`INSERT INTO store_orders (id, race_id, order_no, name, email, phone, delivery, address, items, subtotal, shipping, total, status, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'pending', ?)`,
    [id, o.race_id, Number(n?.n || 1001), o.name, o.email, o.phone, o.delivery, o.address, JSON.stringify(o.items), o.subtotal, o.shipping, o.total, now()]);
  return id;
}

// Marks an order paid exactly once and takes the items out of stock (in one transaction).
export async function markOrderPaid(orderId: string, sessionId: string | null): Promise<boolean> {
  await ensureSchema();
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await c.query(`UPDATE store_orders SET status = 'paid', paid_at = $1, stripe_session_id = COALESCE($2, stripe_session_id) WHERE id = $3 AND status = 'pending' RETURNING items`, [now(), sessionId, orderId]);
    if (!r.rowCount) { await c.query('ROLLBACK'); return false; }
    const row = r.rows[0];
    for (const it of parse<OrderItem[]>(row.items, [])) {
      const p = await c.query('SELECT options, stock FROM store_products WHERE id = $1 FOR UPDATE', [it.product_id]);
      if (!p.rowCount) continue;
      const opts = parse<StoreOption[]>(p.rows[0].options, []);
      if (opts.length) {
        const next = opts.map((o) => (o.label === it.option ? { ...o, stock: o.stock - it.qty } : o));
        await c.query('UPDATE store_products SET options = $1 WHERE id = $2', [JSON.stringify(next), it.product_id]);
      } else await c.query('UPDATE store_products SET stock = stock - $1 WHERE id = $2', [it.qty, it.product_id]);
    }
    await c.query('COMMIT');
    return true;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
