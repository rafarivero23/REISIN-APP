import { teamsOfRace, runnersOfRace, isListedTeam, type Team, type Runner } from '@/lib/repo';
import { parseGroups, groupFor, categoryOf } from '@/lib/groups';
import { teamSlots } from '@/lib/stats';
import { brandKey, fmtDate } from '@/lib/format';
import { PrintButton } from '@/app/print/races/[raceId]/PrintButton';
import { LiveRefresh } from './LiveRefresh';
import type { Race } from '@/lib/repo';

// On-brand team status sheet to share in the race group chat (print → PDF).
// No emails, phones, amounts or notes: only what every team can see.
export async function StatusSheet({ race, live = false }: { race: Race; live?: boolean }) {
  const bx = brandKey(race.brand) === 'baja';
  const all = (await teamsOfRace(race.id)).filter((t) => isListedTeam(t) && !t.no_race);
  const runners = await runnersOfRace(race.id);
  const groups = parseGroups(race.start_groups);
  const byNo = (a: Team, b: Team) => (a.team_no ?? 1e9) - (b.team_no ?? 1e9) || a.name.localeCompare(b.name, 'es');
  const teams = all.filter((t) => !t.is_solo).sort(byNo);
  const solos = all.filter((t) => t.is_solo).sort(byNo);
  const rs = (id: string) => runners.filter((r) => r.team_id === id);
  const short = (r: Runner) => `${r.first_name.trim().split(/\s+/)[0]} ${r.last_name.trim().charAt(0)}.`.trim();
  const branch = (b: string | null) => (b === 'femenil' ? 'Femenil' : b === 'mixto' ? 'Mixto' : b === 'varonil' ? 'Varonil' : '');
  const pay = (t: Team) => {
    const sl = teamSlots(t, race);
    if (t.payment_status !== 'paid') return { k: 'bad', l: 'Pago pendiente' };
    if (sl.balance > 0) return { k: 'warn', l: 'Saldo pendiente' };
    return { k: 'ok', l: 'Pagado' };
  };
  const ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const norm = (v: string | null | undefined) => (v || '').trim().toUpperCase().replace(/^2XL$/, 'XXL').replace(/^3XL$/, 'XXXL');
  const sizes = (list: Runner[]) => {
    const m = new Map<string, number>();
    let none = 0;
    for (const r of list) { const z = norm(r.shirt_size); if (z) m.set(z, (m.get(z) || 0) + 1); else none++; }
    const keys = [...m.keys()].sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b));
    return { list: keys.map((z) => [z, m.get(z)!] as const), none };
  };
  const row = (t: Team) => {
    const list = rs(t.id), sl = teamSlots(t, race);
    const noW = list.filter((r) => !r.waiver_accepted_at);
    const missing = Math.max(0, sl.size - list.length);
    const g = t.is_solo ? null : groupFor(t.half_avg_min, groups);
    const p = pay(t);
    const ok = missing === 0 && noW.length === 0 && p.k === 'ok';
    return { t, list, sl, noW, missing, g, p, ok, sz: sizes(list), cat: branch(categoryOf(list.map((r) => r.gender), t.is_solo)) };
  };
  const R = teams.map(row), S = solos.map(row);
  const k = {
    teams: R.length, ready: R.filter((x) => x.ok).length,
    runners: R.reduce((a, x) => a + x.list.length, 0), slots: R.reduce((a, x) => a + x.sl.size, 0),
    noW: R.reduce((a, x) => a + x.noW.length, 0) + S.reduce((a, x) => a + x.noW.length, 0),
    paid: R.filter((x) => x.p.k === 'ok').length,
  };
  const tot = sizes([...R, ...S].flatMap((x) => x.list));
  const now = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const Row = ({ x, solo }: { x: ReturnType<typeof row>; solo?: boolean }) => (
    <tr className={x.ok ? 'ok' : ''}>
      <td className="no">{x.t.team_no != null ? (solo ? `S${x.t.team_no}` : x.t.team_no) : '—'}</td>
      <td className="nm"><b>{solo ? (x.list[0] ? `${x.list[0].first_name} ${x.list[0].last_name}` : x.t.captain_name) : x.t.name}</b>
        {!solo && <span>{x.sl.size} integrantes{x.cat ? ` · ${x.cat}` : ''}{x.g ? ` · Grupo ${x.g.label}` : ''}</span>}
        {solo && x.cat && <span>Solo · {x.cat}</span>}</td>
      <td className="ct">{solo ? (x.list.length ? <i className="c ok">Registrado</i> : <i className="c bad">Sin registro</i>) : (
        <><div className="dots">{Array.from({ length: x.sl.size }, (_, i) => <i key={i} className={i < x.list.length ? 'on' : ''} />)}</div><small>{x.list.length}/{x.sl.size}{x.missing ? ` · faltan ${x.missing}` : ''}</small></>)}</td>
      <td className="wv">{x.list.length === 0 ? <span className="mut">—</span> : x.noW.length === 0 ? <i className="c ok">✓ Completas</i> :
        <><i className="c warn">Faltan {x.noW.length}</i><small>{x.noW.map(short).join(', ')}</small></>}</td>
      <td className="sz">{x.list.length === 0 ? <span className="mut">—</span> : <>
        {x.sz.list.map(([z, n]) => <i key={z} className="tz">{solo ? z : <>{n}<em>{z}</em></>}</i>)}
        {x.sz.none > 0 && <small>{x.sz.none} sin talla</small>}</>}</td>
      <td><i className={'c ' + x.p.k}>{x.p.l}</i></td>
      <td className="st">{x.ok ? <i className="c ok">✓ Listo</i> : <i className="c pend">Pendiente</i>}</td>
    </tr>
  );
  return (
    <div className={'ss ' + (bx ? 'ss-bx' : 'ss-sv')}>
      {live ? <LiveRefresh /> : <PrintButton />}
      <header className="ss-h">
        <img className="ss-logo" src={bx ? '/brand/bx/logo.png' : '/brand/sav/logo-27.svg'} alt={race.name} />
        <div className="ss-ht">
          <span className="lab">Estatus de equipos{live && <i className="ss-live">En vivo</i>}</span>
          <h1>{race.name}</h1>
          <span className="lab">{fmtDate(race.race_date, 'es')}{race.location ? ` · ${race.location}` : ''} · Actualizado {now}</span>
        </div>
      </header>
      <div className="ss-bar" />
      <section className="ss-k">
        <div><span className="lab">Equipos</span><b>{k.teams}</b></div>
        <div><span className="lab">Listos</span><b>{k.ready}<small>/{k.teams}</small></b></div>
        <div><span className="lab">Corredores</span><b>{k.runners}<small>/{k.slots}</small></b></div>
        <div><span className="lab">Exoneraciones pendientes</span><b className={k.noW ? 'hot' : ''}>{k.noW}</b></div>
        <div><span className="lab">Equipos pagados</span><b>{k.paid}<small>/{k.teams}</small></b></div>
      </section>
      <p className="ss-legend lab">Listo = pagado, todos los corredores registrados y todas las exoneraciones firmadas.</p>
      <table className="ss-t">
        <thead><tr><th>#</th><th>Equipo</th><th>Corredores</th><th>Exoneraciones</th><th>Playeras</th><th>Pago</th><th>Estatus</th></tr></thead>
        <tbody>{R.map((x) => <Row key={x.t.id} x={x} />)}</tbody>
      </table>
      {S.length > 0 && (
        <>
          <h2 className="ss-sub">Solo runners</h2>
          <table className="ss-t">
            <thead><tr><th>#</th><th>Corredor</th><th>Registro</th><th>Exoneración</th><th>Playera</th><th>Pago</th><th>Estatus</th></tr></thead>
            <tbody>{S.map((x) => <Row key={x.t.id} x={x} solo />)}</tbody>
          </table>
        </>
      )}
      {tot.list.length > 0 && (
        <section className="ss-sz">
          <span className="lab">Total playeras</span>
          <div>{tot.list.map(([z, n]) => <div key={z}><b>{n}</b><span className="lab">{z}</span></div>)}
            {tot.none > 0 && <div><b className="hot">{tot.none}</b><span className="lab">Sin talla</span></div>}</div>
        </section>
      )}
      <footer className="ss-f lab">
        <span>¿Te falta algo? Entra con tu código de capitán en {bx ? 'Baja Crossing' : 'SAV'} → Soy capitán · Exoneraciones: cada corredor desde su liga.</span>
        <span>A race by <img src="/brand/reisin-r.png" alt="Reisin" /></span>
      </footer>
    </div>
  );
}
