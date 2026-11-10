'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { kitCheckIn, kitUndo } from '@/app/actions/kit';

export type KitRunner = { id: string; name: string; bib: number | null; shirt: string | null; gender: string | null; waiver: boolean; sign: string | null };
export type KitTeam = {
  id: string; no: string | null; solo: boolean; name: string; captain: string; phone: string | null; size: number; cat: string; group: string | null;
  pay: 'paid' | 'balance' | 'pending'; runners: KitRunner[]; kit: { at: string; by: string; count: number; note: string } | null;
};

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
function issues(t: KitTeam) {
  const out: string[] = [];
  const missing = Math.max(0, t.size - t.runners.length);
  if (missing) out.push(`Faltan ${missing} corredor${missing > 1 ? 'es' : ''} por registrar`);
  const noW = t.runners.filter((r) => !r.waiver);
  if (noW.length) out.push(`${noW.length} sin exoneración`);
  if (t.pay === 'pending') out.push('Pago pendiente');
  if (t.pay === 'balance') out.push('Liquidación pendiente');
  return out;
}

// Race-day check-in (kit pickup): find the team, check the roster and waivers, check them in.
export function KitApp({ raceId, raceName, staff, teams }: { raceId: string; raceName: string; staff: string; teams: KitTeam[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [f, setF] = useState<'all' | 'todo' | 'done' | 'issues'>('todo');
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { const id = setInterval(() => router.refresh(), 30_000); return () => clearInterval(id); }, [router]);
  const done = teams.filter((t) => t.kit).length;
  const qq = q.trim().toLowerCase();
  const shown = useMemo(() => teams.filter((t) => {
    if (f === 'todo' && t.kit) return false;
    if (f === 'done' && !t.kit) return false;
    if (f === 'issues' && (t.kit || !issues(t).length)) return false;
    if (!qq) return true;
    if (/^s?\d+$/.test(qq)) return (t.no || '').toLowerCase() === qq;
    return `${t.name} ${t.captain} ${t.runners.map((r) => r.name).join(' ')}`.toLowerCase().includes(qq);
  }), [teams, f, qq]);
  return (
    <div className="kit">
      <div className="kit-top">
        <div><div className="label">{raceName} · Check-in de equipos</div><div className="kit-count"><b>{done}</b> / {teams.length} registrados</div></div>
        <span className="chip plain">Staff: {staff}</span>
      </div>
      <div className="kit-bar"><i style={{ width: `${teams.length ? (done / teams.length) * 100 : 0}%` }} /></div>
      <input className="kit-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Número de equipo, nombre, capitán o corredor…" autoFocus />
      <div className="kit-f">
        {([['todo', 'Por registrar'], ['issues', 'Con pendientes'], ['done', 'Registrados'], ['all', 'Todos']] as const).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>
        ))}
      </div>
      {shown.length === 0 && <div className="card empty">Sin resultados.</div>}
      <div className="kit-list">
        {shown.map((t) => <KitCard key={t.id} raceId={raceId} t={t} open={open === t.id} onToggle={() => setOpen(open === t.id ? null : t.id)} />)}
      </div>
    </div>
  );
}

function KitCard({ raceId, t, open, onToggle }: { raceId: string; t: KitTeam; open: boolean; onToggle: () => void }) {
  const router = useRouter();
  const [here, setHere] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const iss = issues(t);
  const present = t.runners.filter((r) => here[r.id]).length;
  const allHere = t.runners.length > 0 && present === t.runners.length;
  const ready = !iss.length && allHere;
  const go = async () => {
    setErr('');
    if (!ready && !note.trim()) return setErr('Escribe una nota de qué quedó pendiente para registrar con pendientes.');
    setBusy(true);
    const r = await kitCheckIn(raceId, t.id, { count: present, note: ready ? note : `${iss.concat(allHere ? [] : [`Presentes ${present}/${t.runners.length}`]).join(' · ')} — ${note}` });
    setBusy(false);
    if (r.error) return setErr('No se pudo guardar. Revisa la contraseña de staff.');
    router.refresh();
  };
  return (
    <div className={'kit-card' + (t.kit ? ' in' : iss.length ? ' warn' : '') + (open ? ' open' : '')}>
      <button type="button" className="kit-head" onClick={onToggle} aria-expanded={open}>
        <span className="kit-no">{t.no ?? '—'}</span>
        <span className="kit-nm"><b>{t.name}</b><small>{t.solo ? 'Solo' : `Capitán: ${t.captain}`} · {t.runners.length}/{t.size}{t.cat ? ` · ${t.cat}` : ''}{t.group ? ` · Grupo ${t.group}` : ''}</small></span>
        {t.kit ? <span className="chip ok">✓ {hhmm(t.kit.at)}</span> : iss.length ? <span className="chip warn">{iss.length} pendiente{iss.length > 1 ? 's' : ''}</span> : <span className="chip">Listo para registrar</span>}
      </button>
      {open && (
        <div className="kit-body">
          {t.kit && (
            <div className="kit-done">
              <b>✓ Registrado a las {hhmm(t.kit.at)}</b> por {t.kit.by} · {t.kit.count} presentes
              {t.kit.note && <div className="muted" style={{ marginTop: 4 }}>{t.kit.note}</div>}
              <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={async () => { if (confirm('¿Deshacer el check-in de este equipo?')) { await kitUndo(raceId, t.id); router.refresh(); } }}>Deshacer</button>
            </div>
          )}
          {!t.solo && <div className="kit-cap"><span className="label">Capitán</span><b>{t.captain}</b>{t.phone && <a href={`tel:${t.phone}`}>{t.phone}</a>}</div>}
          <div className="label" style={{ marginTop: 6 }}>Corredores · toca a cada uno al verlo</div>
          <ul className="kit-rs">
            {t.runners.map((r) => (
              <li key={r.id} className={here[r.id] ? 'on' : ''}>
                <button type="button" className="kit-chk" onClick={() => setHere({ ...here, [r.id]: !here[r.id] })} aria-pressed={!!here[r.id]}>{here[r.id] ? '✓' : ''}</button>
                <span className="kit-rn" onClick={() => setHere({ ...here, [r.id]: !here[r.id] })}><b>{r.name}</b><small>{r.bib ? `#${r.bib}` : 'Sin número'}{r.shirt ? ` · Talla ${r.shirt}` : ''}</small></span>
                {r.waiver ? <span className="chip ok">Exoneración ✓</span> : <a className="chip bad" href={r.sign!} target="_blank" rel="noreferrer">Firmar exoneración ↗</a>}
              </li>
            ))}
            {Array.from({ length: Math.max(0, t.size - t.runners.length) }, (_, i) => (
              <li key={'m' + i} className="miss"><span className="kit-chk" /><span className="kit-rn"><b>Lugar sin registrar</b><small>El capitán debe inscribirlo con la contraseña del equipo</small></span></li>
            ))}
          </ul>
          {iss.length > 0 && <div className="kit-iss"><b>Pendientes</b><ul>{iss.map((x) => <li key={x}>{x}</li>)}</ul></div>}
          {!t.kit && (
            <div className="kit-act">
              <div className="muted" style={{ fontSize: 13 }}>Presentes: <b>{present}</b> / {t.runners.length}{!allHere && t.runners.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHere(Object.fromEntries(t.runners.map((r) => [r.id, true])))}>Marcar todos</button>}</div>
              {!ready && <input className="kit-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (qué falta / qué se acordó)…" />}
              {err && <p className="err">{err}</p>}
              <button type="button" className={'btn btn-lg ' + (ready ? 'btn-primary' : '')} disabled={busy} onClick={go}>
                {busy ? '…' : ready ? `✓ Registrar equipo (${present})` : 'Registrar con pendientes'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
