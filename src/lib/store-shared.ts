// Store types and pure helpers (safe to import from client components).
// Race store: products (with per-option stock), images, orders.
export type StoreOption = { label: string; stock: number };
export type Product = {
  id: string; race_id: string; name: string; description: string; price: number; stock: number;
  options: StoreOption[]; images: string[]; active: boolean; sort: number;
};
// refunded = units given back (cash); qty stays as originally bought.
export type OrderItem = { product_id: string; name: string; option: string; qty: number; price: number; refunded?: number };
export type OrderLog = { at: string; by: string; text: string };
export type Order = {
  id: string; race_id: string; order_no: number; name: string; email: string; phone: string | null;
  delivery: 'pickup' | 'ship'; address: string | null; items: OrderItem[]; subtotal: number; shipping: number; total: number;
  status: 'pending' | 'paid' | 'delivered' | 'canceled'; stripe_session_id: string | null; paid_at: string | null; notes: string | null; created_at: string;
  delivered_at: string | null; delivered_by: string | null; refunded: number; history: OrderLog[];
  discount_code: string | null; discount: number;
};
export type StoreCode = {
  id: string; race_id: string; code: string; kind: 'pct' | 'amt'; value: number; max_uses: number | null; uses: number;
  expires_at: string | null; active: boolean; created_at: string;
};


export const imgSrc = (id: string, small = false) => `/api/store-img/${id}${small ? '?s=sm' : ''}`;
export const totalStock = (p: Product) => (p.options.length ? p.options.reduce((a, o) => a + Math.max(0, o.stock), 0) : Math.max(0, p.stock));
export const stockOf = (p: Product, option: string) => (p.options.length ? Math.max(0, p.options.find((o) => o.label === option)?.stock ?? 0) : Math.max(0, p.stock));


// Shop cover: races.store_hero holds one image id or a JSON list of ids.
export const heroList = (v: string | null | undefined): string[] => { if (!v) return []; if (v.startsWith('[')) { try { return (JSON.parse(v) as string[]).filter(Boolean); } catch { return []; } } return [v]; };

// Units still owed to the customer, and what the order is worth after cash refunds.
export const liveQty = (it: OrderItem) => Math.max(0, it.qty - (it.refunded || 0));
export const netTotal = (o: Order) => Math.max(0, o.total - (o.refunded || 0));

// Discount on the products subtotal (never more than the subtotal).
export const normCode = (c: string) => String(c || '').trim().toUpperCase().replace(/\s+/g, '');
export const discountFor = (c: Pick<StoreCode, 'kind' | 'value'>, subtotal: number) =>
  Math.min(subtotal, Math.max(0, Math.round(c.kind === 'pct' ? (subtotal * Math.min(100, c.value)) / 100 : c.value)));
export const codeLabel = (c: Pick<StoreCode, 'kind' | 'value'>) => (c.kind === 'pct' ? `${c.value}%` : `$${c.value.toLocaleString('es-MX')}`);
// Why a code can't be used right now ('' = valid).
export function codeProblem(c: StoreCode | null, today = new Date().toISOString().slice(0, 10)): string {
  if (!c || !c.active) return 'st_codeBad';
  if (c.expires_at && c.expires_at < today) return 'st_codeExpired';
  if (c.max_uses != null && c.uses >= c.max_uses) return 'st_codeUsed';
  return '';
}
