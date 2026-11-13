'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { liveQty, netTotal, type Order } from '@/lib/store-shared';
import { orderDeliver, orderEdit, orderSwap, orderRefund } from '@/app/actions/store-desk';

export type DeskProduct = { id: string; name: string; options: { label: string; stock: number }[] };
const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');
const hhmm = (iso: string) => new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const statusOf = (o: Order) => (o.status === 'canceled' ? (o.refunded ? 'Reembolsado' : 'Cancelado') : o.status === 'delivered' ? 'Surtido' : 'Por surtir');
const chipOf = (o: Order) => (o.status === 'canceled' ? 'bad' : o.status === 'delivered' ? 'ok' : 'warn');

// Two staff views of the race store: "fulfill" (hand out orders) and "manage" (edit / refund).
export function StoreDesk({ raceId, raceName, staff, mode, orders, products, base }:
  { raceId: string; raceName: string; staff: string; mode: 'fulfill' | 'manage'; orders: Order[]; products: DeskProduct[]; base: string }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [f, setF] = useState<string>(mode === 'fulfill' ? 'todo' : 'all');
  const [open, setOpen] = useState<string | null>(null);
  const [pick, setPick] = useState(false);
  useEffect(() => { const id = setInterval(() => router.refresh(), 30_000); return () => clearInterval(id); }, [router]);
  const live = orders.filter((o) => o.status !== 'canceled');
  const todo = live.filter((o) => o.status === 'paid');
  const qq = q.trim().toLowerCase().replace(/^#/, '');
  const shown = useMemo(() => orders.filter((o) => {
    if (mode === 'fulfill' && o.status === 'canceled' && f !== 'all') return false;
    if (f === 'todo' && o.status !== 'paid') return false;
    if (f === 'done' && o.status !== 'delivered') return false;
    if (f === 'refund' && !o.refunded) return false;
    if (!qq) return true;
    if (/^\d+$/.test(qq)) return String(o.order_no).includes(qq) || (o.phone || '').replace(/\D/g, '').includes(qq);
    return `${o.name} ${o.email} ${o.items.map((i) => `${i.name} ${i.option}`).join(' ')}`.toLowerCase().includes(qq);
  }).sort((a, b) => (mode === 'fulfill' ? a.order_no - b.order_no : b.order_no - a.order_no)), [orders, f, qq, mode]);
  // Picking list: units still to hand out, by product and size.
  const picking = useMemo(() => {
    const m = new Map<string, { name: string; option: string; n: number }>();
    for (const o of todo) for (const it of o.items) {
      const n = liveQty(it); if (!n) continue;
      const k = `${it.name}|${it.option}`;
      m.set(k, { name: it.name, option: it.option, n: (m.get(k)?.n || 0) + n });
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'es') || a.option.localeCompare(b.option));
  }, [todo]);
  const sales = live.reduce((a, o) => a + netTotal(o), 0) + orders.filter((o) => o.status === 'canceled').reduce((a, o) => a + netTotal(o), 0);
  const refunds = orders.reduce((a, o) => a + (o.refunded || 0), 0);
  const filters = mode === 'fulfill'
    ? [['todo', 'Por surtir'], ['done', 'Surtidos'], ['all', 'Todos']]
    : [['all', 'Todas'], ['todo', 'Por surtir'], ['done', 'Surtidas'], ['refund', 'Con reembolso']];
  return (
    <div className="kit sd">
      <div className="kit-top">
        <div>
          <div className="label">{raceName} · {mode === 'fulfill' ? 'Surtido de pedidos' : 'Órdenes de la tienda'}</div>
          {mode === 'fulfill'
            ? <div className="kit-count"><b>{live.length - todo.length}</b> / {live.length} surtidos</div>
            : <div className="kit-count"><b>{orders.length}</b> órdenes · {$(sales)} netos{refunds ? ` · ${$(refunds)} reembolsados` : ''}</div>}
        </div>
        <div className="row" style={{ gap: 6 }}>
          <a className="btn btn-sm" href={`${base}/${mode === 'fulfill' ? 'ordenes' : 'pedidos'}`}>{mode === 'fulfill' ? 'Órdenes / reembolsos' : 'Surtido'} →</a>
          <span className="chip plain">Staff: {staff}</span>
        </div>
      </div>
      {mode === 'fulfill' && <div className="kit-bar"><i style={{ width: `${live.length ? ((live.length - todo.length) / live.length) * 100 : 0}%` }} /></div>}
      <input className="kit-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Número de pedido, nombre, teléfono o producto…" />
      <div className="kit-f">
        {filters.map(([k, l]) => <button key={k} type="button" aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>)}
        {mode === 'fulfill' && picking.length > 0 && <button type="button" aria-pressed={pick} onClick={() => setPick(!pick)} style={{ marginLeft: 'auto' }}>Lista de surtido</button>}
      </div>
      {pick && mode === 'fulfill' && (
        <div className="card sd-pick">
          <div className="label">Por entregar · {picking.reduce((a, x) => a + x.n, 0)} piezas</div>
          <table><tbody>{picking.map((x) => <tr key={x.name + x.option}><td>{x.name}</td><td>{x.option && <span className="chip">{x.option}</span>}</td><td className="num"><b>{x.n}</b></td></tr>)}</tbody></table>
        </div>
      )}
      {shown.length === 0 && <div className="card empty">{orders.length ? 'Sin resultados.' : 'Todavía no hay pedidos pagados.'}</div>}
      <div className="kit-list">
        {shown.map((o) => mode === 'fulfill'
          ? <FulfillCard key={o.id} raceId={raceId} o={o} open={open === o.id} onToggle={() => setOpen(open === o.id ? null : o.id)} />
          : <ManageCard key={o.id} raceId={raceId} o={o} products={products} open={open === o.id} onToggle={() => setOpen(open === o.id ? null : o.id)} />)}
      </div>
    </div>
  );
}

function Head({ o, onToggle, open }: { o: Order; onToggle: () => void; open: boolean }) {
  const units = o.items.reduce((a, it) => a + liveQty(it), 0);
  return (
    <button type="button" className="kit-head" onClick={onToggle} aria-expanded={open}>
      <span className="kit-no sd-no">#{o.order_no}</span>
      <span className="kit-nm"><b>{o.name}</b><small>{units} pieza{units === 1 ? '' : 's'} · {o.delivery === 'ship' ? 'Envío' : 'Recoge en kits'} · {$(netTotal(o))}</small></span>
      <span className={'chip ' + chipOf(o)}>{o.status === 'delivered' && o.delivered_at ? `✓ ${hhmm(o.delivered_at).split(', ').pop()}` : statusOf(o)}</span>
    </button>
  );
}

function Items({ o }: { o: Order }) {
  return (
    <ul className="sd-items">
      {o.items.map((it, i) => {
        const n = liveQty(it);
        return (
          <li key={i} className={n ? '' : 'off'}>
            <b className="sd-q">{n || it.qty}×</b><span>{it.name}</span>{it.option && <span className="chip sd-sz">{it.option}</span>}
            {it.refunded ? <small className="muted">{n ? `(${it.refunded} reembolsada${it.refunded > 1 ? 's' : ''})` : 'Reembolsado'}</small> : null}
          </li>
        );
      })}
    </ul>
  );
}

function FulfillCard({ raceId, o, open, onToggle }: { raceId: string; o: Order; open: boolean; onToggle: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async (v: boolean) => { setBusy(true); setErr(''); const r = await orderDeliver(raceId, o.id, v); setBusy(false); if (r.error) setErr(r.error); else router.refresh(); };
  return (
    <div className={'kit-card' + (o.status === 'delivered' ? ' in' : '') + (o.status === 'canceled' ? ' sd-off' : '')}>
      <Head o={o} onToggle={onToggle} open={open} />
      <div className="kit-body sd-body">
        <Items o={o} />
        {open && (
          <>
            <div className="kit-cap"><span className="label">Cliente</span><b>{o.name}</b>{o.phone && <a href={`tel:${o.phone}`}>{o.phone}</a>}<span className="muted">{o.email}</span></div>
            {o.delivery === 'ship' && <div className="kit-cap"><span className="label">Envío a</span><span>{o.address}</span></div>}
            {o.notes && <div className="kit-iss">{o.notes}</div>}
          </>
        )}
        {err && <p className="err">{err}</p>}
        {o.status === 'paid' && <button type="button" className="btn btn-lg btn-primary" disabled={busy} onClick={() => go(true)}>{busy ? '…' : '✓ Marcar surtido / entregado'}</button>}
        {o.status === 'delivered' && (
          <div className="kit-done">
            <b>✓ Surtido</b>{o.delivered_at ? ` · ${hhmm(o.delivered_at)}` : ''}{o.delivered_by ? ` por ${o.delivered_by}` : ''}
            <button type="button" className="btn btn-sm" style={{ marginLeft: 10 }} disabled={busy} onClick={() => { if (confirm('¿Deshacer la entrega de este pedido?')) go(false); }}>Deshacer</button>
          </div>
        )}
        {o.status === 'canceled' && <div className="kit-iss">{o.refunded ? `Reembolsado (${$(o.refunded)}). No entregar.` : 'Cancelado. No entregar.'}</div>}
      </div>
    </div>
  );
}

function ManageCard({ raceId, o, products, open, onToggle }: { raceId: string; o: Order; products: DeskProduct[]; open: boolean; onToggle: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({ name: o.name, email: o.email, phone: o.phone || '', delivery: o.delivery, address: o.address || '', notes: o.notes || '' });
  const [rq, setRq] = useState<Record<number, number>>({});
  const [amt, setAmt] = useState<string>('');
  const [restock, setRestock] = useState(true);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ k: 'ok' | 'err'; t: string } | null>(null);
  const auto = o.items.reduce((a, it, i) => a + (rq[i] || 0) * it.price, 0);
  const left = o.total - (o.refunded || 0);
  const act = async (k: string, fn: () => Promise<{ error?: string }>, ok: string) => {
    setBusy(k); setMsg(null);
    const r = await fn();
    setBusy('');
    if (r.error) return setMsg({ k: 'err', t: r.error });
    setMsg({ k: 'ok', t: ok });
    router.refresh();
  };
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const refund = () => {
    const amount = amt === '' ? auto : Number(amt);
    const lines = Object.entries(rq).map(([i, q]) => ({ idx: Number(i), qty: q })).filter((l) => l.qty > 0);
    if (!lines.length && !amount) return setMsg({ k: 'err', t: 'Elige las piezas a reembolsar o escribe el monto.' });
    const what = lines.map((l) => `${l.qty}× ${o.items[l.idx].name}${o.items[l.idx].option ? ` (${o.items[l.idx].option})` : ''}`).join(', ');
    if (!confirm(`¿Registrar reembolso en efectivo de ${$(amount)}${what ? ` por ${what}` : ''}?${lines.length ? (restock ? '\n\nLas piezas regresan a inventario.' : '\n\nLas piezas NO regresan a inventario.') : ''}`)) return;
    act('refund', () => orderRefund(raceId, o.id, { lines, amount, restock, note }), `Reembolso de ${$(amount)} registrado.`).then(() => { setRq({}); setAmt(''); setNote(''); });
  };
  return (
    <div className={'kit-card' + (o.status === 'delivered' ? ' in' : '') + (o.status === 'canceled' ? ' sd-off' : '')}>
      <Head o={o} onToggle={onToggle} open={open} />
      {open && (
        <div className="kit-body sd-body">
          <div className="sd-meta muted">Pedido {hhmm(o.created_at)} · Total {$(o.total)}{o.shipping ? ` (envío ${$(o.shipping)})` : ''}{o.refunded ? ` · Reembolsado ${$(o.refunded)}` : ''} · {o.stripe_session_id ? 'Pagado con Stripe' : 'Pago manual / prueba'}</div>

          <div className="label">Productos · cambiar talla o reembolsar</div>
          <ul className="sd-edit">
            {o.items.map((it, i) => {
              const n = liveQty(it);
              const p = products.find((x) => x.id === it.product_id);
              return (
                <li key={i} className={n ? '' : 'off'}>
                  <div className="sd-line">
                    <b className="sd-q">{n || it.qty}×</b><span className="sd-nm">{it.name}<small className="muted"> · {$(it.price)} c/u{it.refunded ? ` · ${it.refunded} reembolsada${it.refunded > 1 ? 's' : ''}` : ''}</small></span>
                    {p && p.options.length > 0 && n > 0 ? (
                      <select value={it.option} disabled={!!busy} onChange={(e) => act('swap', () => orderSwap(raceId, o.id, i, e.target.value), `Talla cambiada a ${e.target.value}; inventario actualizado.`)}>
                        {p.options.map((op) => <option key={op.label} value={op.label} disabled={op.label !== it.option && op.stock < n}>{op.label}{op.label !== it.option ? ` (${op.stock} disp.)` : ''}</option>)}
                      </select>
                    ) : it.option ? <span className="chip sd-sz">{it.option}</span> : null}
                  </div>
                  {n > 0 && (
                    <div className="sd-rq">
                      <span className="muted">Reembolsar</span>
                      <button type="button" className="btn btn-sm" onClick={() => setRq({ ...rq, [i]: Math.max(0, (rq[i] || 0) - 1) })}>−</button>
                      <b>{rq[i] || 0}</b>
                      <button type="button" className="btn btn-sm" onClick={() => setRq({ ...rq, [i]: Math.min(n, (rq[i] || 0) + 1) })}>+</button>
                      {n > 1 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRq({ ...rq, [i]: n })}>Todas</button>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {left > 0 && (
            <div className="sd-refund">
              <div className="label">Reembolso en efectivo</div>
              <div className="sd-grid">
                <label>Monto $<input type="number" min={0} max={left} value={amt === '' ? auto : amt} onChange={(e) => setAmt(e.target.value)} /></label>
                <label className="chk"><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} /> Regresar piezas a inventario</label>
              </div>
              <input className="kit-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motivo (talla, defecto, cambio de opinión…)" />
              <button type="button" className="btn btn-lg" disabled={!!busy} onClick={refund}>{busy === 'refund' ? '…' : `Registrar reembolso de ${$(amt === '' ? auto : Number(amt) || 0)}`}</button>
              <small className="muted">Máximo {$(left)}. Esto solo registra el efectivo que se devolvió; no hace reembolso en Stripe.</small>
            </div>
          )}

          <div className="label">Datos del pedido</div>
          <div className="sd-form">
            <label>Nombre<input value={f.name} onChange={set('name')} /></label>
            <label>Teléfono<input value={f.phone} onChange={set('phone')} inputMode="tel" /></label>
            <label>Correo<input value={f.email} onChange={set('email')} type="email" /></label>
            <label>Entrega<select value={f.delivery} onChange={set('delivery')}><option value="pickup">Recoge en kits</option><option value="ship">Envío</option></select></label>
            {f.delivery === 'ship' && <label className="w">Dirección<textarea rows={2} value={f.address} onChange={set('address')} /></label>}
            <label className="w">Nota / guía<input value={f.notes} onChange={set('notes')} /></label>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => act('edit', () => orderEdit(raceId, o.id, f), 'Datos guardados.')}>{busy === 'edit' ? '…' : 'Guardar datos'}</button>
            {o.status === 'paid' && <button type="button" className="btn" disabled={!!busy} onClick={() => act('del', () => orderDeliver(raceId, o.id, true), 'Marcado como surtido.')}>✓ Marcar surtido</button>}
            {o.status === 'delivered' && <button type="button" className="btn" disabled={!!busy} onClick={() => act('del', () => orderDeliver(raceId, o.id, false), 'Entrega deshecha.')}>Deshacer surtido</button>}
          </div>
          {msg && <p className={msg.k === 'err' ? 'err' : 'sd-ok'}>{msg.t}</p>}

          {o.history.length > 0 && (
            <details className="sd-log"><summary className="label">Historial · {o.history.length}</summary>
              <ul>{[...o.history].reverse().map((h, i) => <li key={i}><span className="muted">{hhmm(h.at)} · {h.by}</span> — {h.text}</li>)}</ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
