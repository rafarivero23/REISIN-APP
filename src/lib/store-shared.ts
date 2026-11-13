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
};


export const imgSrc = (id: string, small = false) => `/api/store-img/${id}${small ? '?s=sm' : ''}`;
export const totalStock = (p: Product) => (p.options.length ? p.options.reduce((a, o) => a + Math.max(0, o.stock), 0) : Math.max(0, p.stock));
export const stockOf = (p: Product, option: string) => (p.options.length ? Math.max(0, p.options.find((o) => o.label === option)?.stock ?? 0) : Math.max(0, p.stock));


// Shop cover: races.store_hero holds one image id or a JSON list of ids.
export const heroList = (v: string | null | undefined): string[] => { if (!v) return []; if (v.startsWith('[')) { try { return (JSON.parse(v) as string[]).filter(Boolean); } catch { return []; } } return [v]; };

// Units still owed to the customer, and what the order is worth after cash refunds.
export const liveQty = (it: OrderItem) => Math.max(0, it.qty - (it.refunded || 0));
export const netTotal = (o: Order) => Math.max(0, o.total - (o.refunded || 0));
