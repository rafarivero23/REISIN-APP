import { many, one, run, pool, ensureSchema } from '@/lib/db';
import { newId, now } from '@/lib/ids';

import { normCode, type Product, type Order, type OrderItem, type OrderLog, type StoreOption, type StoreCode } from '@/lib/store-shared';
export * from '@/lib/store-shared';

const parse = <T,>(s: string | null | undefined, d: T): T => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
const toProduct = (r: any): Product => ({ ...r, options: parse<StoreOption[]>(r.options, []), images: parse<string[]>(r.images, []) });
const toOrder = (r: any): Order => ({ ...r, refunded: Number(r.refunded || 0), discount: Number(r.discount || 0), items: parse<OrderItem[]>(r.items, []), history: parse<OrderLog[]>(r.history, []) });

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
export async function codesOf(raceId: string): Promise<StoreCode[]> {
  return many<StoreCode>('SELECT * FROM store_codes WHERE race_id = ? ORDER BY created_at DESC', [raceId]);
}
export async function findCode(raceId: string, code: string): Promise<StoreCode | null> {
  const c = normCode(code);
  return c ? one<StoreCode>('SELECT * FROM store_codes WHERE race_id = ? AND code = ?', [raceId, c]) : null;
}
export async function getOrder(id: string) {
  const r = await one('SELECT * FROM store_orders WHERE id = ?', [id]);
  return r ? toOrder(r) : null;
}

// Creates a pending order (prices and names come from the database, never the browser).
export async function createOrder(o: Omit<Order, 'id' | 'order_no' | 'status' | 'stripe_session_id' | 'paid_at' | 'notes' | 'created_at' | 'delivered_at' | 'delivered_by' | 'refunded' | 'history' | 'discount_code' | 'discount'> & { discount_code?: string | null; discount?: number }) {
  const id = newId();
  const n = await one<{ n: number }>('SELECT COALESCE(MAX(order_no), 1000) + 1 AS n FROM store_orders WHERE race_id = ?', [o.race_id]);
  await run(`INSERT INTO store_orders (id, race_id, order_no, name, email, phone, delivery, address, items, subtotal, shipping, total, discount_code, discount, status, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'pending', ?)`,
    [id, o.race_id, Number(n?.n || 1001), o.name, o.email, o.phone, o.delivery, o.address, JSON.stringify(o.items), o.subtotal, o.shipping, o.total, o.discount_code || null, o.discount || 0, now()]);
  return id;
}

// Marks an order paid exactly once and takes the items out of stock (in one transaction).
export async function markOrderPaid(orderId: string, sessionId: string | null): Promise<boolean> {
  await ensureSchema();
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await c.query(`UPDATE store_orders SET status = 'paid', paid_at = $1, stripe_session_id = COALESCE($2, stripe_session_id) WHERE id = $3 AND status = 'pending' RETURNING items, race_id, discount_code`, [now(), sessionId, orderId]);
    if (!r.rowCount) { await c.query('ROLLBACK'); return false; }
    const row = r.rows[0];
    if (row.discount_code) await c.query('UPDATE store_codes SET uses = uses + 1 WHERE race_id = $1 AND code = $2', [row.race_id, row.discount_code]);
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

type Tx = { query: (q: string, v?: unknown[]) => Promise<{ rowCount: number | null; rows: any[] }> };
// Adds (or takes, with a negative delta) units of a product/size inside a transaction.
export async function moveStock(c: Tx, productId: string, option: string, delta: number) {
  const p = await c.query('SELECT options, stock FROM store_products WHERE id = $1 FOR UPDATE', [productId]);
  if (!p.rowCount) return { ok: false, left: 0 };
  const opts = parse<StoreOption[]>(p.rows[0].options, []);
  if (opts.length) {
    const cur = opts.find((o) => o.label === option);
    if (!cur) return { ok: false, left: 0 };
    if (delta < 0 && cur.stock + delta < 0) return { ok: false, left: cur.stock };
    await c.query('UPDATE store_products SET options = $1 WHERE id = $2', [JSON.stringify(opts.map((o) => (o.label === option ? { ...o, stock: o.stock + delta } : o))), productId]);
    return { ok: true, left: cur.stock + delta };
  }
  const left = Number(p.rows[0].stock) + delta;
  if (delta < 0 && left < 0) return { ok: false, left: Number(p.rows[0].stock) };
  await c.query('UPDATE store_products SET stock = stock + $1 WHERE id = $2', [delta, productId]);
  return { ok: true, left };
}

// Runs fn on a locked order row inside one transaction.
export async function withOrder<T>(orderId: string, raceId: string, fn: (c: Tx, o: Order) => Promise<T>): Promise<T | null> {
  await ensureSchema();
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await c.query('SELECT * FROM store_orders WHERE id = $1 AND race_id = $2 FOR UPDATE', [orderId, raceId]);
    if (!r.rowCount) { await c.query('ROLLBACK'); return null; }
    const out = await fn(c as unknown as Tx, toOrder(r.rows[0]));
    await c.query('COMMIT');
    return out;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
