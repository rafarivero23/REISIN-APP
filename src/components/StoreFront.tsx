'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from './I18n';
import { TestCheckout } from './ui';
import { RichText } from './RichText';
import { money } from '@/lib/format';
import { imgSrc, stockOf, totalStock, discountFor, codeLabel, type Product } from '@/lib/store-shared';
import { storeCheckout, confirmStoreOrder, unlockShop, checkStoreCode } from '@/app/actions/store';

// Public race store: product grid → detail pop-up (big photos, sizes) → cart drawer → Stripe checkout.
type Line = { productId: string; option: string; qty: number };
type Ship = { pickup: boolean; fee: number | null };

export function StoreFront({ raceId, raceSlug, raceName, products, ship, canceled, openId }: { raceId: string; raceSlug: string; raceName: string; products: Product[]; ship: Ship; canceled?: boolean; openId?: string }) {
  const { lang } = useT();
  const tx = (es: string, en: string) => (lang === 'en' ? en : es);
  const key = `reisin-cart-${raceId}`;
  const [cart, setCart] = useState<Line[]>([]);
  const [open, setOpen] = useState<Product | null>(null);
  const [bag, setBag] = useState(false);
  const [bump, setBump] = useState(0);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  useEffect(() => {
    try { const c = JSON.parse(localStorage.getItem(key) || '[]'); if (Array.isArray(c)) setCart(c.filter((l: Line) => byId.has(l.productId))); } catch { /* private mode */ }
  }, [key, byId]);
  useEffect(() => { if (openId && byId.has(openId)) setOpen(byId.get(openId)!); }, [openId, byId]);
  const save = (c: Line[]) => { setCart(c); try { localStorage.setItem(key, JSON.stringify(c)); } catch { /* ignore */ } };
  const add = (p: Product, option: string, qty: number) => {
    const i = cart.findIndex((l) => l.productId === p.id && l.option === option);
    const next = i >= 0 ? cart.map((l, j) => (j === i ? { ...l, qty: Math.min(stockOf(p, option), l.qty + qty) } : l)) : [...cart, { productId: p.id, option, qty }];
    save(next); setOpen(null); setBump((b) => b + 1); setBag(true);
  };
  const count = cart.reduce((a, l) => a + l.qty, 0);

  return (
    <>
      {canceled && <div className="st-note-bar mono">{tx('Pago cancelado. Tu carrito sigue aquí.', 'Payment canceled. Your cart is still here.')}</div>}
      {products.length === 0 ? (
        <div className="st-empty">{tx('Muy pronto: merch oficial de la carrera.', 'Coming soon: official race merch.')}</div>
      ) : (
        <section className="st-grid sv-bleed">
          {products.map((p, i) => {
            const out = totalStock(p) === 0;
            return (
              <button key={p.id} type="button" className={'st-card' + (out ? ' out' : '')} onClick={() => setOpen(p)}>
                <div className="st-pic">
                  {p.images[0] ? <img src={imgSrc(p.images[0], true)} alt={p.name} loading={i < 4 ? 'eager' : 'lazy'} /> : <div className="st-noimg mono">{p.name}</div>}
                  {p.images[1] && <img className="alt" src={imgSrc(p.images[1], true)} alt="" loading="lazy" />}
                  {out && <span className="st-badge mono">{tx('Agotado', 'Sold out')}</span>}
                  <span className="st-idx mono">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <div className="st-meta">
                  <h3>{p.name}</h3>
                  <span className="st-price">{money(p.price, lang)}</span>
                </div>
                {p.options.length > 0 && <div className="st-sizes mono">{p.options.map((o) => <span key={o.label} className={o.stock > 0 ? '' : 'no'}>{o.label}</span>)}</div>}
              </button>
            );
          })}
        </section>
      )}

      <button type="button" className={'st-fab' + (count ? ' has' : '')} key={bump} onClick={() => setBag(true)} aria-label={tx('Carrito', 'Cart')}>
        <svg viewBox="0 0 24 24" aria-hidden><path d="M5 7h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8L5 7Z" /><path d="M9 7V5.5a3 3 0 0 1 6 0V7" /></svg>
        <span className="mono">{tx('Carrito', 'Cart')}</span>{count > 0 && <b>{count}</b>}
      </button>

      {open && <ProductModal p={open} onClose={() => setOpen(null)} onAdd={add} />}
      {bag && <Cart raceId={raceId} raceSlug={raceSlug} raceName={raceName} cart={cart} byId={byId} ship={ship} onChange={save} onClose={() => setBag(false)} />}
    </>
  );
}

function ProductModal({ p, onClose, onAdd }: { p: Product; onClose: () => void; onAdd: (p: Product, option: string, qty: number) => void }) {
  const { lang } = useT();
  const tx = (es: string, en: string) => (lang === 'en' ? en : es);
  const [i, setI] = useState(0);
  const [opt, setOpt] = useState(p.options.find((o) => o.stock > 0)?.label || '');
  const [qty, setQty] = useState(1);
  const [zoom, setZoom] = useState(false);
  const left = stockOf(p, p.options.length ? opt : '');
  const n = p.images.length;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') (zoom ? setZoom(false) : onClose());
      if (e.key === 'ArrowRight' && n > 1) setI((x) => (x + 1) % n);
      if (e.key === 'ArrowLeft' && n > 1) setI((x) => (x - 1 + n) % n);
    };
    window.addEventListener('keydown', k);
    const o = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = o; };
  }, [n, onClose, zoom]);
  useEffect(() => { setQty((q) => Math.max(1, Math.min(q, left || 1))); }, [left]);

  return (
    <div className="st-modal" role="dialog" aria-modal="true" aria-label={p.name} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="st-box">
        <button type="button" className="st-x mono" onClick={onClose}>{tx('Cerrar', 'Close')} ✕</button>
        <div className="st-gal">
          <div className={'st-main' + (zoom ? ' zoom' : '')} onClick={() => n && setZoom((z) => !z)}>
            {n ? <img key={p.images[i]} src={imgSrc(p.images[i])} alt={p.name} /> : <div className="st-noimg mono">{p.name}</div>}
            {n > 1 && <>
              <button type="button" className="st-nav prev" onClick={(e) => { e.stopPropagation(); setI((i - 1 + n) % n); }} aria-label="←">←</button>
              <button type="button" className="st-nav next" onClick={(e) => { e.stopPropagation(); setI((i + 1) % n); }} aria-label="→">→</button>
              <span className="st-count mono">{String(i + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</span>
            </>}
          </div>
          {n > 1 && (
            <div className="st-thumbs">
              {p.images.map((id, j) => <button key={id} type="button" data-on={j === i ? '1' : '0'} onClick={() => setI(j)}><img src={imgSrc(id, true)} alt="" /></button>)}
            </div>
          )}
        </div>
        <div className="st-info">
          <span className="mono">{tx('Merch oficial', 'Official merch')}</span>
          <h2>{p.name}</h2>
          <div className="st-price big">{money(p.price, lang)}</div>
          {p.options.length > 0 && (
            <div className="st-pick">
              <div className="mono">{tx('Talla', 'Size')}{opt ? ` · ${opt}` : ''}</div>
              <div className="st-opts-pub">
                {p.options.map((o) => <button key={o.label} type="button" disabled={o.stock <= 0} aria-pressed={opt === o.label} onClick={() => setOpt(o.label)}>{o.label}</button>)}
              </div>
            </div>
          )}
          {left > 0 && left <= 5 && <div className="st-low mono">{tx(`Quedan ${left}`, `Only ${left} left`)}</div>}
          <div className="st-buy">
            <div className="st-qty">
              <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="−">−</button>
              <span>{qty}</span>
              <button type="button" onClick={() => setQty(Math.min(left, qty + 1))} disabled={qty >= left} aria-label="+">+</button>
            </div>
            <button type="button" className="sv-cta st-add" disabled={left <= 0 || (p.options.length > 0 && !opt)} onClick={() => onAdd(p, p.options.length ? opt : '', qty)}>
              {left <= 0 ? tx('Agotado', 'Sold out') : `${tx('Agregar al carrito', 'Add to cart')} →`}
            </button>
          </div>
          {p.description && <div className="st-desc"><RichText text={p.description} /></div>}
        </div>
      </div>
    </div>
  );
}

function Cart({ raceId, raceSlug, raceName, cart, byId, ship, onChange, onClose }: { raceId: string; raceSlug: string; raceName: string; cart: Line[]; byId: Map<string, Product>; ship: Ship; onChange: (c: Line[]) => void; onClose: () => void }) {
  const { lang } = useT();
  const tx = (es: string, en: string) => (lang === 'en' ? en : es);
  const router = useRouter();
  const canShip = ship.fee != null, canPick = ship.pickup;
  const [f, setF] = useState({ name: '', email: '', phone: '', delivery: (canPick ? 'pickup' : 'ship') as 'pickup' | 'ship', address: '' });
  const [step, setStep] = useState<'cart' | 'info'>('cart');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sim, setSim] = useState<{ orderId: string; payToken: string; total: number } | null>(null);
  const lines = cart.map((l) => ({ ...l, p: byId.get(l.productId)! })).filter((l) => l.p);
  const subtotal = lines.reduce((a, l) => a + l.qty * l.p.price, 0);
  const shipping = f.delivery === 'ship' ? ship.fee || 0 : 0;
  const [codeIn, setCodeIn] = useState('');
  const [code, setCode] = useState<{ code: string; kind: 'pct' | 'amt'; value: number } | null>(null);
  const [codeErr, setCodeErr] = useState('');
  const discount = code ? discountFor(code, subtotal) : 0;
  const total = subtotal - discount + shipping;
  const applyCode = async () => {
    setCodeErr('');
    if (!codeIn.trim()) return;
    const r = await checkStoreCode(raceId, codeIn);
    if (r.error || !r.code) { setCode(null); return setCodeErr(errs[r.error || 'st_codeBad'] || tx('Código no válido.', 'Invalid code.')); }
    setCode({ code: r.code, kind: r.kind!, value: r.value! }); setCodeIn(r.code);
  };
  const setQty = (i: number, q: number) => onChange(cart.map((l, j) => (j === i ? { ...l, qty: Math.max(1, Math.min(q, stockOf(byId.get(l.productId)!, l.option))) } : l)));
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const errs: Record<string, string> = {
    required: tx('Completa nombre, email y teléfono.', 'Fill in name, email and phone.'), st_address: tx('Escribe la dirección completa de envío.', 'Enter your full shipping address.'),
    st_stock: tx('Ya no hay suficientes piezas de', 'Not enough stock left for'), st_gone: tx('Un producto ya no está disponible. Revisa tu carrito.', 'A product is no longer available. Check your cart.'),
    st_closed: tx('La tienda está cerrada.', 'The store is closed.'), st_empty: tx('Tu carrito está vacío.', 'Your cart is empty.'),
    st_codeBad: tx('Código no válido.', 'Invalid code.'), st_codeExpired: tx('Este código ya venció.', 'This code has expired.'), st_codeUsed: tx('Este código ya se usó el máximo de veces.', 'This code has reached its limit.'),
  };
  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    const r = await storeCheckout(raceId, cart, { ...f, code: code?.code || '' });
    if ('error' in r) { setErr(`${errs[r.error] || r.error}${r.detail ? ` ${r.detail}.` : ''}`); setBusy(false); return; }
    if ('url' in r) { window.location.href = r.url; return; }
    setSim(r); setBusy(false);
  };

  return (
    <div className="st-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="st-cart" role="dialog" aria-modal="true" aria-label={tx('Carrito', 'Cart')}>
        <div className="st-cart-h">
          <h2>{step === 'cart' ? tx('Carrito', 'Cart') : tx('Tus datos', 'Your details')}</h2>
          <button type="button" className="st-x mono" onClick={onClose}>✕</button>
        </div>
        {lines.length === 0 ? <p className="st-empty-c">{tx('Tu carrito está vacío.', 'Your cart is empty.')}</p> : step === 'cart' ? (
          <>
            <ul className="st-lines">
              {lines.map((l, i) => (
                <li key={l.productId + l.option}>
                  {l.p.images[0] ? <img src={imgSrc(l.p.images[0], true)} alt="" /> : <span className="st-ph" />}
                  <div>
                    <b>{l.p.name}</b>
                    {l.option && <span className="mono">{tx('Talla', 'Size')} {l.option}</span>}
                    <div className="st-qty sm">
                      <button type="button" onClick={() => setQty(i, l.qty - 1)} aria-label="−">−</button><span>{l.qty}</span>
                      <button type="button" onClick={() => setQty(i, l.qty + 1)} aria-label="+">+</button>
                    </div>
                  </div>
                  <div className="st-line-r">
                    <span>{money(l.qty * l.p.price, lang)}</span>
                    <button type="button" className="mono" onClick={() => onChange(cart.filter((_, j) => j !== i))}>{tx('Quitar', 'Remove')}</button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="st-tot"><span className="mono">Subtotal</span><b>{money(subtotal, lang)}</b></div>
            <button type="button" className="sv-cta st-go" onClick={() => setStep('info')}>{tx('Continuar', 'Continue')} →</button>
          </>
        ) : (
          <form className="st-form" onSubmit={pay}>
            <label><span className="mono">{tx('Nombre completo', 'Full name')}</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" required /></label>
            <label><span className="mono">Email</span><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" required /></label>
            <label><span className="mono">{tx('Teléfono', 'Phone')}</span><input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" required /></label>
            <fieldset className="st-deliv">
              <legend className="mono">{tx('Entrega', 'Delivery')}</legend>
              {canPick && <label className={f.delivery === 'pickup' ? 'on' : ''}><input type="radio" name="dl" checked={f.delivery === 'pickup'} onChange={() => setF({ ...f, delivery: 'pickup' })} /><span><b>{tx('Recoger en entrega de kits', 'Pick up with race kit')}</b><small>{tx('Sin costo', 'Free')}</small></span></label>}
              {canShip && <label className={f.delivery === 'ship' ? 'on' : ''}><input type="radio" name="dl" checked={f.delivery === 'ship'} onChange={() => setF({ ...f, delivery: 'ship' })} /><span><b>{tx('Envío a domicilio (México)', 'Home delivery (Mexico)')}</b><small>{money(ship.fee || 0, lang)}</small></span></label>}
            </fieldset>
            {f.delivery === 'ship' && <label><span className="mono">{tx('Dirección completa (calle, número, colonia, CP, ciudad, estado)', 'Full address (street, number, area, ZIP, city, state)')}</span><textarea rows={3} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} autoComplete="street-address" required /></label>}
            <div className="st-sum">
              <div><span>Subtotal</span><span>{money(subtotal, lang)}</span></div>
              {discount > 0 && <div className="st-disc"><span>{tx('Descuento', 'Discount')} {code!.code} ({codeLabel(code!)})</span><span>−{money(discount, lang)}</span></div>}
              {f.delivery === 'ship' && <div><span>{tx('Envío', 'Shipping')}</span><span>{money(shipping, lang)}</span></div>}
              <div className="t"><span>Total</span><b>{money(total, lang)}</b></div>
            </div>
            <div className="st-code">
              <input value={codeIn} onChange={(e) => { setCodeIn(e.target.value.toUpperCase()); setCodeErr(''); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCode(); } }}
                placeholder={tx('Código de descuento', 'Discount code')} aria-label={tx('Código de descuento', 'Discount code')} autoCapitalize="characters" disabled={!!code} />
              {code ? <button type="button" className="mono" onClick={() => { setCode(null); setCodeIn(''); }}>{tx('Quitar', 'Remove')}</button>
                : <button type="button" className="mono" onClick={applyCode}>{tx('Aplicar', 'Apply')}</button>}
            </div>
            {codeErr && <p className="st-err">{codeErr}</p>}
            {err && <p className="st-err">{err}</p>}
            <div className="st-form-act">
              <button type="button" className="st-back mono" onClick={() => setStep('cart')}>← {tx('Carrito', 'Cart')}</button>
              <button type="submit" className="sv-cta st-go" disabled={busy}>{busy ? tx('Abriendo pago…', 'Opening checkout…') : total <= 0 ? `${tx('Confirmar pedido', 'Place order')} →` : `${tx('Pagar', 'Pay')} ${money(total, lang)} →`}</button>
            </div>
          </form>
        )}
      </aside>
      {sim && (
        <TestCheckout amount={sim.total} concept={`Shop · ${raceName}`} email={f.email} onClose={() => setSim(null)}
          onPay={async () => {
            const r = await confirmStoreOrder(sim.orderId, { payToken: sim.payToken });
            if (!r.ok) throw new Error('Error');
            onChange([]);
            router.push(`/r/${raceSlug}/store/done?order=${sim.orderId}`);
          }} />
      )}
    </div>
  );
}

export function ShopGate({ raceId }: { raceId: string }) {
  const { lang } = useT();
  const tx = (es: string, en: string) => (lang === 'en' ? en : es);
  const router = useRouter();
  const [code, setCode] = useState('');
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(false);
    const r = await unlockShop(raceId, code);
    setBusy(false);
    if (r.error) return setErr(true);
    router.refresh();
  };
  return (
    <section className="st-gate sv-bleed">
      <span className="mono">🔒 {tx('Acceso con contraseña', 'Password access')}</span>
      <h2>{tx('Este shop es privado', 'This shop is private')}</h2>
      <p>{tx('Escribe la contraseña que te compartimos para ver los productos.', 'Enter the password we shared with you to see the products.')}</p>
      <form className="st-form st-gate-f" onSubmit={go}>
        <label><span className="mono">{tx('Contraseña', 'Password')}</span><input type="password" value={code} onChange={(e) => setCode(e.target.value)} autoFocus autoComplete="off" required /></label>
        {err && <p className="st-err">{tx('Contraseña incorrecta.', 'Wrong password.')}</p>}
        <button type="submit" className="sv-cta st-go" disabled={busy}>{busy ? '…' : `${tx('Entrar', 'Enter')} →`}</button>
      </form>
    </section>
  );
}
