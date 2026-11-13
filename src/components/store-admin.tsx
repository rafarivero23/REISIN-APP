'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from './I18n';
import { Drawer, DeleteButton, useToast } from './ui';
import { resize } from './racepage';
import { money, fmtDate } from '@/lib/format';
import { imgSrc, heroList, totalStock, netTotal, liveQty, codeLabel, codeProblem, type Product, type Order, type StoreOption, type StoreCode } from '@/lib/store-shared';
import { saveStoreSettings, saveProduct, deleteProduct, moveProduct, uploadStoreImage, setOrderStatus, setOrderNotes, importInventory, setStoreHero, saveStoreCode, deleteStoreCode, type ProductInput, type CodeInput } from '@/app/actions/store';

// Admin → race → Tienda: settings, products (inventory per size, photos, description) and orders.
type Settings = { on: boolean; pickup: boolean; shipFee: number | null; code: string | null; hero: string[] };
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export function StoreAdmin({ raceId, raceSlug, settings, products, orders, codes = [] }: { raceId: string; raceSlug: string; settings: Settings; products: Product[]; orders: Order[]; codes?: StoreCode[] }) {
  const { lang } = useT();
  const tx = (es: string, en: string) => (lang === 'en' ? en : es);
  const router = useRouter();
  const toast = useToast();
  const [s, setS] = useState({ on: settings.on, pickup: settings.pickup, ship: settings.shipFee != null, fee: settings.shipFee ?? 0, lock: !!settings.code, code: settings.code || '' });
  const [edit, setEdit] = useState<ProductInput | null>(null);
  const [view, setView] = useState<'products' | 'orders' | 'codes'>('products');
  const paid = orders.filter((o) => o.status !== 'canceled');
  const sales = orders.reduce((a, o) => a + netTotal(o), 0);
  const toDeliver = orders.filter((o) => o.status === 'paid').length;
  // Units sold (paid or delivered, minus refunds) per product|size.
  const sold = new Map<string, number>();
  for (const o of orders) if (o.status === 'paid' || o.status === 'delivered') for (const it of o.items) sold.set(`${it.product_id}|${it.option}`, (sold.get(`${it.product_id}|${it.option}`) || 0) + liveQty(it));
  const soldOf = (id: string, opt?: string) => (opt != null ? sold.get(`${id}|${opt}`) || 0 : [...sold].reduce((a, [k, n]) => a + (k.startsWith(id + '|') ? n : 0), 0));

  const saveSettings = async () => {
    if (s.lock && !s.code.trim()) return toast(tx('Escribe la contraseña de la tienda', 'Enter the shop password'));
    await saveStoreSettings(raceId, { on: s.on, pickup: s.pickup, shipFee: s.ship ? Number(s.fee) || 0 : null, code: s.lock ? s.code : '' });
    toast(tx('Guardado', 'Saved')); router.refresh();
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card st-set">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="label">{tx('Tienda', 'Store')}</div>
            <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>{tx('Merch de la carrera. Se vende con Stripe; el botón "Tienda" aparece en la página cuando está activa y tiene productos.', 'Race merch, paid with Stripe. The "Store" button shows on the race page when it is on and has products.')}</p>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <a className="btn btn-sm" href={`/r/${raceSlug}/pedidos`} target="_blank" rel="noreferrer">{tx('Surtido staff', 'Staff fulfillment')} ↗</a>
            <a className="btn btn-sm" href={`/r/${raceSlug}/ordenes`} target="_blank" rel="noreferrer">{tx('Órdenes / reembolsos', 'Orders / refunds')} ↗</a>
            <a className="btn btn-sm" href={`/r/${raceSlug}/store`} target="_blank" rel="noreferrer">{tx('Ver tienda', 'View store')} ↗</a>
          </div>
        </div>
        <div className="st-set-row">
          <label className="chk"><input type="checkbox" checked={s.on} onChange={(e) => setS({ ...s, on: e.target.checked })} /> {tx('Tienda activa', 'Store on')}</label>
          <label className="chk"><input type="checkbox" checked={s.pickup} onChange={(e) => setS({ ...s, pickup: e.target.checked })} /> {tx('Recoger en entrega de kits', 'Pickup at kit pickup')}</label>
          <label className="chk"><input type="checkbox" checked={s.ship} onChange={(e) => setS({ ...s, ship: e.target.checked })} /> {tx('Envío en México', 'Shipping in Mexico')}</label>
          {s.ship && <label className="st-fee">{tx('Costo de envío', 'Shipping fee')} $<input type="number" min={0} value={s.fee} onChange={(e) => setS({ ...s, fee: Number(e.target.value) })} /></label>}
          <label className="chk"><input type="checkbox" checked={s.lock} onChange={(e) => setS({ ...s, lock: e.target.checked })} /> 🔒 {tx('Con contraseña', 'Password protected')}</label>
          {s.lock && <label className="st-fee">{tx('Contraseña', 'Password')} <input type="text" value={s.code} onChange={(e) => setS({ ...s, code: e.target.value })} style={{ width: 160 }} autoComplete="off" /></label>}
          <button type="button" className="btn btn-primary btn-sm" onClick={saveSettings}>{tx('Guardar', 'Save')}</button>
        </div>
        <HeroPicker raceId={raceId} hero={settings.hero} />
        <div className="st-kpis">
          <div><span className="label">{tx('Ventas', 'Sales')}</span><b>{money(sales, lang)}</b></div>
          <div><span className="label">{tx('Pedidos', 'Orders')}</span><b>{paid.length}</b></div>
          <div><span className="label">{tx('Por entregar', 'To deliver')}</span><b>{toDeliver}</b></div>
          <div><span className="label">{tx('Productos', 'Products')}</span><b>{products.filter((p) => p.active).length}/{products.length}</b></div>
        </div>
      </div>

      <div className="tabs" role="tablist" style={{ marginBottom: 0 }}>
        <button type="button" role="tab" aria-selected={view === 'products'} onClick={() => setView('products')}>{tx('Inventario', 'Inventory')} · {products.length}</button>
        <button type="button" role="tab" aria-selected={view === 'orders'} onClick={() => setView('orders')}>{tx('Pedidos', 'Orders')} · {orders.length}</button>
        <button type="button" role="tab" aria-selected={view === 'codes'} onClick={() => setView('codes')}>{tx('Descuentos', 'Discounts')} · {codes.length}</button>
      </div>

      {view === 'products' && (
        <>
          <div className="toolbar" style={{ justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
            <ImportInventory raceId={raceId} />
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setEdit({ name: '', description: '', price: 0, stock: 0, options: [], images: [], active: true })}>+ {tx('Producto', 'Product')}</button>
          </div>
          {products.length === 0 ? <div className="card muted">{tx('Aún no hay productos. Agrega el primero con fotos, precio, descripción y existencias por talla.', 'No products yet. Add the first one with photos, price, description and stock per size.')}</div> : (
            <div className="tbl-wrap"><table>
              <thead><tr><th /><th>{tx('Producto', 'Product')}</th><th>{tx('Precio', 'Price')}</th><th>{tx('Vendidas', 'Sold')}</th><th>{tx('Quedan', 'Left')}</th><th>{tx('Estado', 'Status')}</th><th /></tr></thead>
              <tbody>
                {products.map((p, i) => {
                  const st = totalStock(p);
                  return (
                    <tr key={p.id} className="clickable" onClick={() => setEdit({ ...p, orig: { stock: p.stock, options: p.options.map((o) => ({ ...o })) } })}>
                      <td style={{ width: 64 }}>{p.images[0] ? <img className="st-thumb" src={imgSrc(p.images[0], true)} alt="" /> : <span className="st-thumb empty" />}</td>
                      <td><b>{p.name}</b>
                        {p.options.length > 0 && (
                          <div className="st-inv">
                            {p.options.map((o) => (
                              <span key={o.label} className={o.stock <= 0 ? 'out' : o.stock <= 2 ? 'low' : ''}>
                                <em>{o.label}</em><b>{o.stock}</b><small>{soldOf(p.id, o.label)} {tx('vend.', 'sold')}</small>
                              </span>
                            ))}
                          </div>
                        )}</td>
                      <td className="num">{money(p.price, lang)}</td>
                      <td className="num">{soldOf(p.id)}</td>
                      <td className="num">{st === 0 ? <span className="chip bad">{tx('Agotado', 'Sold out')}</span> : <b>{st}</b>}</td>
                      <td>{p.active ? <span className="chip ok">{tx('Visible', 'Visible')}</span> : <span className="chip">{tx('Oculto', 'Hidden')}</span>}</td>
                      <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                        <button type="button" className="btn btn-sm" disabled={i === 0} onClick={async () => { await moveProduct(raceId, p.id, -1); router.refresh(); }} aria-label="↑">↑</button>{' '}
                        <button type="button" className="btn btn-sm" disabled={i === products.length - 1} onClick={async () => { await moveProduct(raceId, p.id, 1); router.refresh(); }} aria-label="↓">↓</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </>
      )}

      {view === 'orders' && <Orders raceId={raceId} orders={orders} />}
      {view === 'codes' && <Codes raceId={raceId} codes={codes} orders={orders} />}

      {edit && <ProductDrawer raceId={raceId} p={edit} sold={(opt) => (edit.id ? soldOf(edit.id, opt) : 0)} onClose={() => setEdit(null)} />}
    </div>
  );
}

// Full-screen cover photos (carousel) for the public shop page.
function HeroPicker({ raceId, hero }: { raceId: string; hero: string[] }) {
  const { lang } = useT();
  const tx = (es: string, en: string) => (lang === 'en' ? en : es);
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const save = async (ids: string[]) => { await setStoreHero(raceId, ids); router.refresh(); };
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/')); e.target.value = '';
    const added: string[] = [];
    for (const [i, f] of files.entries()) {
      setBusy(`${i + 1}/${files.length}`);
      try {
        const lg = await resize(f, 2400, 0.85), sm = await resize(f, 900, 0.8);
        const r = await uploadStoreImage(raceId, lg.url, sm.url, lg.w, lg.h);
        if (r.id) added.push(r.id); else toast(f.name);
      } catch { toast(f.name); }
    }
    setBusy(null);
    if (added.length) await save([...hero, ...added]);
  };
  const move = (i: number, d: number) => { const a = [...hero], j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; save(a); };
  return (
    <div className="st-hero-pick">
      <div className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
        <div>
          <div className="label">{tx('Portada del shop', 'Shop cover')} · {hero.length}</div>
          <p className="muted" style={{ fontSize: 13, margin: '2px 0 0' }}>{tx('Fotos horizontales del merch a pantalla completa; si subes varias, se van disolviendo una tras otra. Sin fotos se muestra un encabezado compacto.', 'Horizontal merch photos shown full screen; several dissolve one after another. Without photos, a compact header is shown.')}</p>
        </div>
        <label className="btn btn-sm" style={{ cursor: 'pointer' }}>{busy ? <><span className="spin" /> {busy}</> : `↑ ${tx('Subir fotos', 'Upload photos')}`}<input type="file" accept="image/*" multiple hidden onChange={pick} disabled={!!busy} /></label>
      </div>
      {hero.length > 0 && (
        <div className="st-hero-list">
          {hero.map((id, i) => (
            <div key={id} className="st-img"><img src={imgSrc(id, true)} alt="" />
              <div className="st-img-bar">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="←">←</button>
                <button type="button" onClick={() => save(hero.filter((x) => x !== id))} aria-label={tx('Quitar', 'Remove')}>✕</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === hero.length - 1} aria-label="→">→</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ImportInventory({ raceId }: { raceId: string }) {
  const { lang } = useT();
  const tx = (es: string, en: string) => (lang === 'en' ? en : es);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const errs: Record<string, string> = { st_impEmpty: tx('El archivo no tiene filas.', 'The file has no rows.'), st_impNoName: tx('No encontré la columna "Producto" (o "Nombre").', 'No "Product" (or "Name") column found.') };
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true); setLog(null);
    try {
      const XLSX = await import('xlsx');
      const buf = await f.arrayBuffer();
      let text: string | null = null;
      if (/\.csv$/i.test(f.name)) { try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { text = new TextDecoder('windows-1252').decode(buf); } }
      const wb = text != null ? XLSX.read(text.replace(/^﻿/, ''), { type: 'string' }) : XLSX.read(buf, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false })
        .map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [String(k).trim(), String(v ?? '').trim()])));
      const r = await importInventory(raceId, rows);
      if (r.error) setLog(errs[r.error] || r.error);
      else {
        const cols = Object.entries(r.columns).filter(([, v]) => v).map(([k, v]) => `${k} → ${v}`).join(' · ');
        setLog(`${f.name}: ${r.created} ${tx('nuevos', 'new')} · ${r.updated} ${tx('actualizados', 'updated')}${r.skipped ? ` · ${r.skipped} ${tx('filas vacías', 'empty rows')}` : ''}\n${cols}${r.warnings.length ? '\n' + r.warnings.join('\n') : ''}`);
        router.refresh();
      }
    } catch { setLog(tx('No pude leer el archivo. Usa .xlsx, .xls o .csv.', 'Could not read the file. Use .xlsx, .xls or .csv.')); }
    setBusy(false);
  };
  const template = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([['Producto', 'Precio', 'Descripción', 'Talla', 'Existencias'],
      ['Playera técnica', 650, 'Tela técnica, corte unisex', 'S', 10], ['Playera técnica', '', '', 'M', 20], ['Playera técnica', '', '', 'L', 15], ['Gorra', 450, 'Trucker ajustable', '', 30]]);
    ws['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 40 }, { wch: 10 }, { wch: 12 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
    XLSX.writeFile(wb, 'plantilla-inventario.xlsx');
  };
  return (
    <>
      <button type="button" className="btn btn-sm" onClick={template}>{tx('Plantilla', 'Template')}</button>
      <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
        {busy ? <><span className="spin" /> {tx('Importando…', 'Importing…')}</> : `↑ ${tx('Importar inventario (Excel)', 'Import inventory (Excel)')}`}
        <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={onFile} disabled={busy} />
      </label>
      {log && <pre className="st-implog" onClick={() => setLog(null)} title={tx('Cerrar', 'Close')}>{log}</pre>}
    </>
  );
}

function ProductDrawer({ raceId, p: p0, sold, onClose }: { raceId: string; p: ProductInput; sold: (opt: string) => number; onClose: () => void }) {
  const { lang } = useT();
  const tx = (es: string, en: string) => (lang === 'en' ? en : es);
  const router = useRouter();
  const toast = useToast();
  const [p, setP] = useState<ProductInput>({ ...p0, options: p0.options.map((o) => ({ ...o })), images: [...p0.images] });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const set = (k: keyof ProductInput, v: unknown) => setP((x) => ({ ...x, [k]: v }));
  const setOpt = (i: number, o: Partial<StoreOption>) => set('options', p.options.map((x, j) => (j === i ? { ...x, ...o } : x)));

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    const added: string[] = [];
    for (const [i, f] of files.entries()) {
      setBusy(`${i + 1}/${files.length}`);
      try {
        const lg = await resize(f, 1600, 0.84), sm = await resize(f, 700, 0.8);
        const r = await uploadStoreImage(raceId, lg.url, sm.url, lg.w, lg.h);
        if (r.id) added.push(r.id); else toast(f.name);
      } catch { toast(f.name); }
    }
    setBusy(null);
    if (added.length) setP((x) => ({ ...x, images: [...x.images, ...added].slice(0, 12) }));
  };
  const moveImg = (i: number, d: number) => {
    const a = [...p.images], j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    set('images', a);
  };
  const save = async () => {
    setErr('');
    const r = await saveProduct(raceId, p);
    if (r.error) return setErr(tx('Falta el nombre.', 'Name is required.'));
    toast(tx('Producto guardado', 'Product saved')); router.refresh(); onClose();
  };

  return (
    <Drawer title={p.id ? p.name || tx('Producto', 'Product') : tx('Nuevo producto', 'New product')} sub={tx('Tienda', 'Store')} onClose={onClose}>
      <div className="form" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="field full"><label htmlFor="sp-name">{tx('Nombre', 'Name')} *</label><input id="sp-name" value={p.name} onChange={(e) => set('name', e.target.value)} placeholder={tx('Playera técnica SAV27', 'SAV27 tech tee')} /></div>
        <div className="field"><label htmlFor="sp-price">{tx('Precio (MXN)', 'Price (MXN)')}</label><input id="sp-price" type="number" min={0} value={p.price} onChange={(e) => set('price', Number(e.target.value))} /></div>
        <div className="field" style={{ justifyContent: 'flex-end' }}><label className="chk"><input type="checkbox" checked={p.active} onChange={(e) => set('active', e.target.checked)} /> {tx('Visible en la tienda', 'Visible in store')}</label></div>
        <div className="field full"><label htmlFor="sp-desc">{tx('Descripción', 'Description')}</label><textarea id="sp-desc" rows={5} value={p.description} onChange={(e) => set('description', e.target.value)} placeholder={tx('Material, corte, guía de tallas…', 'Fabric, fit, size guide…')} /></div>
      </div>

      <div className="st-sec">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="label">{tx('Fotos', 'Photos')} · {p.images.length}</div>
          <label className="btn btn-sm" style={{ cursor: 'pointer' }}>{busy ? <><span className="spin" /> {busy}</> : `↑ ${tx('Subir fotos', 'Upload photos')}`}<input type="file" accept="image/*" multiple hidden onChange={upload} disabled={!!busy} /></label>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: '2px 0 10px' }}>{tx('La primera es la principal. Usa las flechas para ordenarlas.', 'The first one is the main photo. Use the arrows to reorder.')}</p>
        {p.images.length > 0 && (
          <div className="st-imgs">
            {p.images.map((id, i) => (
              <div key={id} className={'st-img' + (i === 0 ? ' main' : '')}>
                <img src={imgSrc(id, true)} alt="" />
                <div className="st-img-bar">
                  <button type="button" onClick={() => moveImg(i, -1)} disabled={i === 0} aria-label="←">←</button>
                  <button type="button" onClick={() => set('images', p.images.filter((x) => x !== id))} aria-label={tx('Quitar', 'Remove')}>✕</button>
                  <button type="button" onClick={() => moveImg(i, 1)} disabled={i === p.images.length - 1} aria-label="→">→</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="st-sec">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="label">{tx('Existencias', 'Inventory')}</div>
          <div className="row" style={{ gap: 6 }}>
            {p.options.length === 0 && <button type="button" className="btn btn-sm" onClick={() => set('options', ['S', 'M', 'L', 'XL'].map((l) => ({ label: l, stock: 0 })))}>{tx('Usar tallas S–XL', 'Use sizes S–XL')}</button>}
            <button type="button" className="btn btn-sm" onClick={() => set('options', [...p.options, { label: SIZES.find((x) => !p.options.some((o) => o.label === x)) || '', stock: 0 }])}>+ {tx('Opción', 'Option')}</button>
          </div>
        </div>
        {p.options.length === 0 ? (
          <div className="field" style={{ maxWidth: 200, marginTop: 10 }}><label htmlFor="sp-stock">{tx('Piezas disponibles', 'Units available')}</label><input id="sp-stock" type="number" min={0} value={p.stock} onChange={(e) => set('stock', Number(e.target.value))} /></div>
        ) : (<>
          <div className="st-opts st-opts-s">
            <div className="muted" style={{ fontSize: 12 }}>{tx('Talla / color', 'Size / color')}</div><div className="muted" style={{ fontSize: 12 }}>{tx('Quedan', 'Left')}</div><div className="muted" style={{ fontSize: 12 }}>{tx('Vendidas', 'Sold')}</div><div />
            {p.options.map((o, i) => (
              <div key={i} style={{ display: 'contents' }}>
                <input value={o.label} onChange={(e) => setOpt(i, { label: e.target.value })} aria-label={tx('Talla', 'Size')} />
                <input type="number" min={0} value={o.stock} onChange={(e) => setOpt(i, { stock: Number(e.target.value) })} aria-label={tx('Quedan', 'Left')} />
                <span className="st-sold">{sold(o.label)}</span>
                <button type="button" className="btn btn-sm" onClick={() => set('options', p.options.filter((_, j) => j !== i))} aria-label={tx('Quitar', 'Remove')}>✕</button>
              </div>
            ))}
            <div className="muted" style={{ fontSize: 12 }}>{tx('Total', 'Total')}</div><b>{p.options.reduce((a, o) => a + (Number(o.stock) || 0), 0)}</b><b className="st-sold">{p.options.reduce((a, o) => a + sold(o.label), 0)}</b><div />
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{tx('"Quedan" ya tiene restadas las vendidas. Si cambias un número, solo se aplica la diferencia: las ventas que entren mientras editas no se pierden.', '"Left" already has sold units taken out. Changing a number only applies the difference, so sales made while you edit are kept.')}</p>
        </>
        )}
      </div>

      {err && <p className="err">{err}</p>}
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 18 }}>
        {p.id ? <DeleteButton onConfirm={async () => { await deleteProduct(raceId, p.id!); router.refresh(); onClose(); }} /> : <span />}
        <div className="row"><button type="button" className="btn" onClick={onClose}>{tx('Cancelar', 'Cancel')}</button><button type="button" className="btn btn-primary" onClick={save} disabled={!!busy}>{tx('Guardar', 'Save')}</button></div>
      </div>
    </Drawer>
  );
}

function Orders({ raceId, orders }: { raceId: string; orders: Order[] }) {
  const { lang } = useT();
  const tx = (es: string, en: string) => (lang === 'en' ? en : es);
  const router = useRouter();
  const [q, setQ] = useState('');
  const list = orders.filter((o) => !q || `${o.order_no} ${o.name} ${o.email} ${o.phone} ${o.items.map((i) => i.name).join(' ')}`.toLowerCase().includes(q.toLowerCase()));
  const csv = () => {
    const rows = [['Pedido', 'Fecha', 'Nombre', 'Email', 'Teléfono', 'Entrega', 'Dirección', 'Artículos', 'Total', 'Estado']];
    for (const o of list) rows.push([`#${o.order_no}`, o.created_at.slice(0, 10), o.name, o.email, o.phone || '', o.delivery, o.address || '', o.items.map((i) => `${i.qty}× ${i.name}${i.option ? ` (${i.option})` : ''}`).join('; '), String(o.total), o.status]);
    const blob = new Blob(['﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pedidos-tienda.csv'; a.click();
  };
  if (!orders.length) return <div className="card muted">{tx('Todavía no hay pedidos pagados.', 'No paid orders yet.')}</div>;
  return (
    <>
      <div className="toolbar">
        <input className="search" type="search" placeholder={tx('Buscar pedido, nombre, producto…', 'Search order, name, product…')} value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="btn btn-sm" onClick={csv}>{tx('Exportar CSV', 'Export CSV')}</button>
      </div>
      <div className="tbl-wrap"><table>
        <thead><tr><th>#</th><th>{tx('Cliente', 'Customer')}</th><th>{tx('Artículos', 'Items')}</th><th>{tx('Entrega', 'Delivery')}</th><th>{tx('Total', 'Total')}</th><th>{tx('Estado', 'Status')}</th></tr></thead>
        <tbody>
          {list.map((o) => (
            <tr key={o.id}>
              <td className="num"><b>#{o.order_no}</b><div className="muted" style={{ fontSize: 12 }}>{fmtDate(o.created_at.slice(0, 10), lang)}</div></td>
              <td><b>{o.name}</b><div className="muted" style={{ fontSize: 12 }}>{o.email}<br />{o.phone}</div></td>
              <td style={{ fontSize: 13 }}>{o.items.map((i, k) => <div key={k} style={i.refunded && i.refunded >= i.qty ? { textDecoration: 'line-through', opacity: .5 } : undefined}>{i.qty - (i.refunded || 0) || i.qty}× {i.name}{i.option ? <span className="chip" style={{ marginLeft: 6 }}>{i.option}</span> : null}</div>)}</td>
              <td style={{ fontSize: 13, maxWidth: 240 }}>{o.delivery === 'ship' ? <><b>{tx('Envío', 'Ship')}</b><div className="muted">{o.address}</div></> : tx('Recoge en kits', 'Kit pickup')}
                <input className="st-note" defaultValue={o.notes || ''} placeholder={tx('Nota / guía…', 'Note / tracking…')} onBlur={async (e) => { if (e.target.value !== (o.notes || '')) await setOrderNotes(raceId, o.id, e.target.value); }} /></td>
              <td className="num">{money(o.total, lang)}{o.discount ? <div className="muted" style={{ fontSize: 12 }}>{o.discount_code} −{money(o.discount, lang)}</div> : null}{o.refunded ? <div style={{ fontSize: 12, color: '#e0a020' }}>−{money(o.refunded, lang)} {tx('reembolso', 'refund')}</div> : null}{o.delivered_by ? <div className="muted" style={{ fontSize: 12 }}>✓ {o.delivered_by}</div> : null}{o.shipping ? <div className="muted" style={{ fontSize: 12 }}>{tx('incl. envío', 'incl. ship')} {money(o.shipping, lang)}</div> : null}</td>
              <td>
                <select value={o.status} onChange={async (e) => { await setOrderStatus(raceId, o.id, e.target.value as 'paid'); router.refresh(); }}>
                  <option value="paid">{tx('Pagado · por entregar', 'Paid · to deliver')}</option>
                  <option value="delivered">{tx('Entregado', 'Delivered')}</option>
                  <option value="canceled">{tx('Cancelado', 'Canceled')}</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </>
  );
}

const blankCode: CodeInput = { code: '', kind: 'pct', value: 10, maxUses: null, expires: '', active: true };
function Codes({ raceId, codes, orders }: { raceId: string; codes: StoreCode[]; orders: Order[] }) {
  const { lang } = useT();
  const tx = (es: string, en: string) => (lang === 'en' ? en : es);
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<CodeInput | null>(null);
  const [err, setErr] = useState('');
  const save = async () => {
    if (!f) return;
    setErr('');
    const r = await saveStoreCode(raceId, f);
    if (r.error) return setErr(r.error);
    toast(tx('Código guardado', 'Code saved')); setF(null); router.refresh();
  };
  const given = (code: string) => orders.filter((o) => o.discount_code === code && o.status !== 'pending').reduce((a, o) => a + (o.discount || 0), 0);
  return (
    <>
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>{tx('El cliente lo escribe en el carrito. Descuenta sobre los productos (no sobre el envío).', 'Customers enter it in the cart. Applies to products, not shipping.')}</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => { setErr(''); setF({ ...blankCode }); }}>+ {tx('Código', 'Code')}</button>
      </div>
      {codes.length === 0 ? <div className="card muted">{tx('Aún no hay códigos de descuento.', 'No discount codes yet.')}</div> : (
        <div className="tbl-wrap"><table>
          <thead><tr><th>{tx('Código', 'Code')}</th><th>{tx('Descuento', 'Discount')}</th><th>{tx('Usos', 'Uses')}</th><th>{tx('Vence', 'Expires')}</th><th>{tx('Descontado', 'Given')}</th><th>{tx('Estado', 'Status')}</th></tr></thead>
          <tbody>
            {codes.map((c) => {
              const bad = codeProblem(c);
              return (
                <tr key={c.id} className="clickable" onClick={() => { setErr(''); setF({ id: c.id, code: c.code, kind: c.kind, value: c.value, maxUses: c.max_uses, expires: c.expires_at || '', active: c.active }); }}>
                  <td><b className="mono" style={{ letterSpacing: '.06em' }}>{c.code}</b></td>
                  <td className="num">{codeLabel(c)}</td>
                  <td className="num">{c.uses}{c.max_uses != null ? ` / ${c.max_uses}` : ''}</td>
                  <td>{c.expires_at ? fmtDate(c.expires_at, lang) : '—'}</td>
                  <td className="num">{money(given(c.code), lang)}</td>
                  <td>{!bad ? <span className="chip ok">{tx('Activo', 'Active')}</span> : <span className="chip">{bad === 'st_codeExpired' ? tx('Vencido', 'Expired') : bad === 'st_codeUsed' ? tx('Agotado', 'Used up') : tx('Pausado', 'Paused')}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      )}
      {f && (
        <Drawer title={f.id ? tx('Editar código', 'Edit code') : tx('Nuevo código de descuento', 'New discount code')} onClose={() => setF(null)}>
          <div className="stack" style={{ gap: 12 }}>
            <div className="field"><label>{tx('Código', 'Code')}</label><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/\s+/g, '') })} placeholder="STAFF20" autoFocus style={{ letterSpacing: '.08em' }} /></div>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}><label>{tx('Tipo', 'Type')}</label><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as 'pct' | 'amt' })}><option value="pct">{tx('Porcentaje (%)', 'Percent (%)')}</option><option value="amt">{tx('Monto fijo ($)', 'Fixed amount ($)')}</option></select></div>
              <div className="field" style={{ flex: 1 }}><label>{f.kind === 'pct' ? '%' : '$ MXN'}</label><input type="number" min={1} max={f.kind === 'pct' ? 100 : undefined} value={f.value} onChange={(e) => setF({ ...f, value: Number(e.target.value) })} /></div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}><label>{tx('Máximo de usos (vacío = sin límite)', 'Max uses (empty = unlimited)')}</label><input type="number" min={1} value={f.maxUses ?? ''} onChange={(e) => setF({ ...f, maxUses: e.target.value ? Number(e.target.value) : null })} /></div>
              <div className="field" style={{ flex: 1 }}><label>{tx('Vence (último día válido)', 'Expires (last valid day)')}</label><input type="date" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} /></div>
            </div>
            <label className="chk"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> {tx('Activo', 'Active')}</label>
            {err && <p className="err">{err}</p>}
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
              {f.id ? <DeleteButton onConfirm={async () => { await deleteStoreCode(raceId, f.id!); setF(null); router.refresh(); }} /> : <span />}
              <div className="row"><button type="button" className="btn" onClick={() => setF(null)}>{tx('Cancelar', 'Cancel')}</button><button type="button" className="btn btn-primary" onClick={save}>{tx('Guardar', 'Save')}</button></div>
            </div>
          </div>
        </Drawer>
      )}
    </>
  );
}
