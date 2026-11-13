'use client';
import type React from 'react';
import { useMemo, useState } from 'react';

// Baja Crossing route plan: distance–time chart of Solo Runners and Teams,
// checkpoint ambulance windows, the leapfrogging solo ambulance and the
// gravel stretch with no ambulance. Public page for staff and paramedics.
// Times are minutes from Thu 12 Nov 00:00, BCS local time.

const SOLO_START = 1440 + 16 * 60 + 30; // Fri 13 16:30
const DAYN = ['Jue', 'Vie', 'Sáb', 'Dom', 'Lun'];
const CPS = [
  { n: 'Salida', p: 'Malecón La Paz', km: 0 },
  { n: 'CP1', p: 'Los Planes', km: 38.65 },
  { n: 'CP2', p: 'San Bartolo', km: 88.65 },
  { n: 'CP3', p: 'Cabo Pulmo', km: 152.36 },
  { n: 'CP4', p: 'La Fortuna', km: 191.4 },
  { n: 'Meta', p: 'Puerto Los Cabos', km: 218.2 },
];
// checkpoint ambulance windows [cp index, from, to] in minutes after the Teams start (same as staff shifts)
const CP_AMB: [number, number, number][] = [[1, 60, 300], [2, 240, 600], [3, 420, 1020], [4, 540, 1260], [5, 660, 1440]];
// Route: Strava 3555288480705899176 (BAJA X-ING 2026 V2), km measured on its GPX.
const GRAVEL: [number, number] = [152.36, 191.4];
const SOLO_P = [6, 8, 9];
const SOLO_HOURS = [20, 25, 30, 35, 40, 45];
const SUNRISE = 6 * 60 + 20, SUNSET = 17 * 60 + 30; // approx., Baja California Sur mid-November
const isNight = (t: number) => { const m = ((t % 1440) + 1440) % 1440; return m < SUNRISE || m >= SUNSET; };
const TEAM_P = [4, 5, 6, 7];
const TEAM_START = 2 * 1440 + 14 * 60; // Sat 14 14:00 (Teams start, final)
const KM = 218.2;
const GPX = '/routes/baja-crossing-2026.gpx';
const VIEWS = [{ v: 'all', l: 'Todo' }, { v: 'solo', l: 'Solo Runners' }, { v: 'team', l: 'Teams' }] as const;
type View = (typeof VIEWS)[number]['v'];

const fmt = (m: number) => {
  m = Math.round(m);
  const d = Math.floor(m / 1440), r = ((m % 1440) + 1440) % 1440;
  return `${DAYN[d] ?? ''} ${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`;
};
const hm = (m: number) => fmt(m).slice(4);
const pace = (p: number) => `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, '0')}`;

function soloAmbulance(spd: number) {
  // Pre-staged at km 20; waits at each 20 km point until the last solo passes, then jumps ahead.
  const lead = SOLO_P[0], last = SOLO_P[SOLO_P.length - 1];
  const W: number[] = []; for (let k = 20; k < KM; k += 20) W.push(k); W.push(KM);
  const drive = (a: number, b: number) => { let d = 0; for (let x = a; x < b; x += 0.5) d += (0.5 / (x >= GRAVEL[0] && x < GRAVEL[1] ? spd / 2 : spd)) * 60; return d; };
  const pts: [number, number][] = [[SOLO_START, 0]];
  let t = SOLO_START + drive(0, 20); pts.push([t, 20]);
  let gap: { km: number; t: number } | null = null;
  W.forEach((w, i) => {
    const leadAt = SOLO_START + w * lead;
    if (t > leadAt && !gap) gap = { km: w, t: leadAt };
    const dep = Math.max(t, SOLO_START + w * last);
    pts.push([dep, w]);
    if (i < W.length - 1) { t = dep + drive(w, W[i + 1]); pts.push([t, W[i + 1]]); }
  });
  return { pts, gap: gap as { km: number; t: number } | null };
}

export function RoutePlan({ raceName }: { raceName: string }) {
  const ts = TEAM_START;
  const [solH, setSolH] = useState(30);
  const solP = (solH * 60) / KM;
  const [spd, setSpd] = useState(50);
  const [view, setView] = useState<View>('all');
  const showS = view !== 'team', showT = view !== 'solo';
  const lead = SOLO_P[0], last = SOLO_P[SOLO_P.length - 1];
  const fast = TEAM_P[0], slow = TEAM_P[TEAM_P.length - 1];

  const sa = useMemo(() => soloAmbulance(spd), [spd]);
  const t0 = Math.floor(((showS ? SOLO_START : ts) - 120) / 60) * 60;
  const t1 = Math.ceil((Math.max(showS ? SOLO_START + KM * Math.max(last, solP) : 0, showT ? Math.max(ts + KM * slow, ts + 1440) : 0) + 60) / 60) * 60;
  const W = Math.max(1100, Math.round(((t1 - t0) / 60) * 30)), H = 600, ml = 150, mr = 24, mt = 70, mb = 50;
  const pw = W - ml - mr, ph = H - mt - mb;
  const X = (t: number) => ml + ((t - t0) / (t1 - t0)) * pw;
  const Y = (km: number) => mt + ph - (km / KM) * ph;

  const win = (cpIdx: number) => { const a = CP_AMB.find((x) => x[0] === cpIdx); return a ? [ts + a[1], ts + a[2]] : null; };
  const vx = (fastP: number) => (ts - SOLO_START) / (last - fastP);
  const overtakeKm = fast < last ? vx(fast) : -1;
  const ov = overtakeKm >= 0 && overtakeKm <= KM ? { km: Math.round(overtakeKm), t: SOLO_START + overtakeKm * last } : null;
  const late = CP_AMB.filter((a) => CPS[a[0]].km * slow > a[2]).map((a) => CPS[a[0]].n);
  const gS = [SOLO_START + GRAVEL[0] * lead, SOLO_START + GRAVEL[1] * last];
  const gT = [ts + GRAVEL[0] * fast, ts + GRAVEL[1] * slow];
  // Rapid response unit on the gravel: 45 min before the first runner enters, until 30 min after the last one leaves.
  const URR_PRE = 45, URR_POST = 30;
  const urr = [...(showS ? [{ l: 'Solos', a: gS[0] - URR_PRE, b: gS[1] + URR_POST }] : []), ...(showT ? [{ l: 'Teams', a: gT[0] - URR_PRE, b: gT[1] + URR_POST }] : [])];

  const hours: number[] = []; for (let t = t0; t <= t1; t += 60) hours.push(t);
  const nights: [number, number][] = [], days: [number, number][] = [];
  for (let d = -1; d < 6; d++) {
    const ns = Math.max(t0, d * 1440 + SUNSET), ne = Math.min(t1, (d + 1) * 1440 + SUNRISE); if (ne > ns) nights.push([ns, ne]);
    const ds = Math.max(t0, d * 1440 + SUNRISE), de = Math.min(t1, d * 1440 + SUNSET); if (de > ds) days.push([ds, de]);
  }
  const sunMarks: { t: number; up: boolean }[] = [];
  for (let d = 0; d < 6; d++) { [[SUNRISE, true], [SUNSET, false]].forEach(([m, up]) => { const t = d * 1440 + (m as number); if (t > t0 && t < t1) sunMarks.push({ t, up: up as boolean }); }); }
  const sol = CPS.map((c) => ({ ...c, t: SOLO_START + c.km * solP }));
  const solGravel = [SOLO_START + GRAVEL[0] * solP, SOLO_START + GRAVEL[1] * solP];
  const band = (start: number, a: number, b: number) => `${X(start)},${Y(0)} ${X(start + KM * a)},${Y(KM)} ${X(start + KM * b)},${Y(KM)}`;

  const facts: { k: string; c: string; g: View; v: React.ReactNode }[] = [
    { k: 'Solo Runners en ruta', c: 'solo', g: 'solo', v: <>Salen <b>{fmt(SOLO_START)}</b> · primero llega <b>{fmt(SOLO_START + KM * lead)}</b> · último <b>{fmt(SOLO_START + KM * last)}</b></> },
    { k: `Solo de ${solH} h · ${pace(solP)} min/km`, c: 'sel', g: 'solo', v: <>Llega a meta <b>{fmt(SOLO_START + KM * solP)}</b>{sol.slice(1, -1).map((c) => <span key={c.n}> · {c.n} <b>{hm(c.t)}</b>{isNight(c.t) ? ' (noche)' : ''}</span>)}<br />Brecha {isNight(solGravel[0]) || isNight(solGravel[1]) ? 'con tramo de noche' : 'de día'}: <b>{fmt(solGravel[0])}</b> → <b>{hm(solGravel[1])}</b></> },
    { k: 'Teams en ruta', c: 'team', g: 'team', v: <>Salen <b>{fmt(ts)}</b> · primero llega <b>{fmt(ts + KM * fast)}</b> · último <b>{fmt(ts + KM * slow)}</b></> },
    { k: '¿Se cruzan?', c: 'solo', g: 'all', v: ov ? <>El team más rápido alcanza al último solo en el <b>km {ov.km}</b>, <b>{fmt(ov.t)}</b>. El líder solo nunca ve un team.</> : <>Ningún team alcanza a ningún solo. Nunca comparten tramo.</> },
    { k: 'Ambulancia solo', c: 'amb', g: 'solo', v: sa.gap ? <span className="rpl-warn">Pierde al líder en el <b>km {sa.gap.km}</b> ({fmt(sa.gap.t)}). Desde ahí el líder va sin ambulancia adelante.</span> : <>Siempre va delante del líder solo.</> },
    { k: 'Solos vs ambulancias de checkpoint', c: 'amb', g: 'solo', v: <>Pasan CP1 de <b>{fmt(SOLO_START + CPS[1].km * lead)}</b> a <b>{hm(SOLO_START + CPS[1].km * last)}</b>; la ambulancia de CP1 llega <b>{fmt(ts + 60)}</b>.</> },
    { k: `Team a ${pace(slow)} vs ambulancias de checkpoint`, c: 'amb', g: 'team', v: late.length ? <span className="rpl-warn">Llega después de que se va la ambulancia en <b>{late.join(', ')}</b>.</span> : <>Todas las ambulancias siguen ahí cuando pasa.</> },
    { k: `Unidad de respuesta rápida · brecha km ${Math.round(GRAVEL[0])}–${Math.round(GRAVEL[1])}`, c: 'urr', g: 'all', v: <>{urr.map((u, i) => <span key={u.l}>{i > 0 && <br />}{u.l}: en posición <b>{fmt(u.a)}</b> → <b>{fmt(u.b)}</b></span>)}</> },
  ];

  const line = (start: number, p: number, color: string, i: number, n: number) => (
    <line key={`${color}${p}`} x1={X(start)} y1={Y(0)} x2={X(start + KM * p)} y2={Y(KM)} stroke={color}
      strokeWidth={i === 0 ? 2.5 : i === n - 1 ? 2 : 1.3} strokeDasharray={i === n - 1 ? '6 5' : undefined} strokeLinecap="round" />
  );
  const endLabel = (start: number, p: number, txt: string, color: string) => (
    <text key={`l${txt}`} x={X(start + KM * p) - 8} y={Y(KM) - 8} textAnchor="end" style={{ fill: color, fontWeight: 700 }}>{txt}</text>
  );

  return (
    <main className="rpl">
      <header className="rpl-head">
        <span className="rpl-tag">{raceName} · Plan de ruta y ambulancias</span>
        <h1>Corredores, checkpoints y ambulancias en el tiempo</h1>
        <p className="rpl-mut">Cada línea es un corredor avanzando de La Paz (km 0) a Puerto Los Cabos (km {KM}). Hora de BCS. <a href={GPX} download>Descargar ruta GPX ↓</a></p>
      </header>

      <div className="rpl-controls">
        <div className="rpl-ctl"><span className="rpl-lab">Mostrar</span>
          <div className="rpl-seg" role="group" aria-label="Mostrar">
            {VIEWS.map((o) => <button key={o.v} type="button" aria-pressed={view === o.v} onClick={() => setView(o.v)}>{o.l}</button>)}
          </div>
        </div>
        <div className="rpl-ctl"><span className="rpl-lab">Salidas</span>
          <span className="rpl-v">{showS && <>Solo Runners <b>vie 16:30</b></>}{showS && showT && ' · '}{showT && <>Teams <b>sáb 14:00</b></>}</span>
        </div>
        {showS && <div className="rpl-ctl"><span className="rpl-lab">Solo termina en</span>
          <div className="rpl-seg" role="group" aria-label="Tiempo total del Solo">
            {SOLO_HOURS.map((h) => <button key={h} type="button" aria-pressed={solH === h} onClick={() => setSolH(h)}>{h} h</button>)}
          </div>
        </div>}
        {showS && <div className="rpl-ctl"><label className="rpl-lab" htmlFor="rpl-spd">Ambulancia solo (km/h)</label>
          <select id="rpl-spd" value={spd} onChange={(e) => setSpd(+e.target.value)}>{[40, 50, 60].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        </div>}
      </div>

      <div className="rpl-facts">
        {facts.filter((f) => f.g === 'all' ? (f.k.startsWith('¿') ? view === 'all' : true) : view === 'all' || f.g === view).map((f) => <div key={f.k} className={`rpl-fact ${f.c}`}><span className="rpl-lab">{f.k}</span><span className="rpl-v">{f.v}</span></div>)}
      </div>

      <div className="rpl-legend">
        {showS && <span><i className="sw" style={{ background: 'var(--rpl-solo)', opacity: 0.35 }} />Solo Runners · {SOLO_P.map(pace).join(' / ')} min/km</span>}
        {showT && <span><i className="sw" style={{ background: 'var(--rpl-team)', opacity: 0.3 }} />Teams · {TEAM_P.map(pace).join(' / ')} min/km</span>}
        <span><i className="sw" style={{ height: 0, borderTop: '2px dashed var(--rpl-mut)' }} />Punteada: el más lento de cada grupo</span>
        <span><i className="sw" style={{ height: 6, background: 'var(--rpl-amb)' }} />Ambulancia en checkpoint</span>
        {showS && <span><i className="sw" style={{ height: 0, borderTop: '3px dashed var(--rpl-amb)' }} />Ambulancia solo (salta cada 20 km)</span>}
        <span><i className="sw" style={{ background: 'var(--rpl-gravel)' }} />Brecha sin ambulancia</span>
        <span><i className="sw" style={{ background: 'var(--rpl-yellow)', opacity: 0.35, borderTop: '2px solid var(--rpl-yellow)' }} />Unidad de respuesta rápida en brecha</span>
        {showS && <span><i className="sw" style={{ height: 4, background: 'var(--rpl-ink)' }} />Solo seleccionado ({solH} h)</span>}
        <span><i className="sw" style={{ background: 'var(--rpl-day)', border: '1px solid var(--rpl-sun)' }} />Día</span>
        <span><i className="sw" style={{ background: 'var(--rpl-night)', border: '1px solid var(--rpl-moon)' }} />Noche</span>
      </div>

      <div className="rpl-chart">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gráfica distancia contra tiempo de corredores y ambulancias">
          {days.map(([a, b]) => <rect key={'d' + a} x={X(a)} y={mt - 30} width={X(b) - X(a)} height={ph + 30} fill="var(--rpl-day)" />)}
          {nights.map(([a, b]) => <rect key={'n' + a} x={X(a)} y={mt - 30} width={X(b) - X(a)} height={ph + 30} fill="var(--rpl-night)" />)}
          {days.map(([a, b]) => X(b) - X(a) > 60 && <text key={'dl' + a} x={(X(a) + X(b)) / 2} y={mt + ph - 10} textAnchor="middle" style={{ fill: 'var(--rpl-sun)', fontWeight: 700, letterSpacing: '.14em' }}>DÍA</text>)}
          {nights.map(([a, b]) => X(b) - X(a) > 60 && <text key={'nl' + a} x={(X(a) + X(b)) / 2} y={mt + ph - 10} textAnchor="middle" style={{ fill: 'var(--rpl-moon)', fontWeight: 700, letterSpacing: '.14em' }}>NOCHE</text>)}
          {sunMarks.map((m) => (
            <g key={'s' + m.t}>
              <line x1={X(m.t)} x2={X(m.t)} y1={mt - 30} y2={mt + ph} stroke={m.up ? 'var(--rpl-sun)' : 'var(--rpl-moon)'} strokeWidth={1.5} strokeDasharray="3 4" opacity={0.8} />
              <text x={X(m.t) + (m.up ? 4 : -4)} y={mt - 34} textAnchor={m.up ? 'start' : 'end'} style={{ fill: m.up ? 'var(--rpl-sun)' : 'var(--rpl-moon)', fontSize: 10, fontWeight: 700 }}>{m.up ? `Amanecer ${hm(m.t)}` : `Atardecer ${hm(m.t)}`}</text>
            </g>
          ))}
          <rect x={ml} y={Y(GRAVEL[1])} width={pw} height={Y(GRAVEL[0]) - Y(GRAVEL[1])} fill="var(--rpl-gravel)" opacity={0.55} />
          <text x={ml + 8} y={Y((GRAVEL[0] + GRAVEL[1]) / 2) + 4} style={{ fill: 'var(--rpl-yellow)', fontWeight: 700, letterSpacing: '.06em' }}>BRECHA · SIN AMBULANCIA</text>
          {urr.map((u) => (
            <g key={u.l}>
              <rect x={X(u.a)} y={Y(GRAVEL[1])} width={X(u.b) - X(u.a)} height={Y(GRAVEL[0]) - Y(GRAVEL[1])} fill="var(--rpl-yellow)" opacity={0.14} />
              <line x1={X(u.a)} x2={X(u.b)} y1={Y(GRAVEL[1])} y2={Y(GRAVEL[1])} stroke="var(--rpl-yellow)" strokeWidth={2} />
              <line x1={X(u.a)} x2={X(u.b)} y1={Y(GRAVEL[0])} y2={Y(GRAVEL[0])} stroke="var(--rpl-yellow)" strokeWidth={2} />
              <text x={X(u.a) + 6} y={Y(GRAVEL[0]) - 6} style={{ fill: 'var(--rpl-yellow)', fontWeight: 700 }}>URR {u.l} · {hm(u.a)}–{hm(u.b)}</text>
            </g>
          ))}
          {hours.map((t) => {
            const hh = (((t % 1440) + 1440) % 1440) / 60, major = hh % 3 === 0;
            return (
              <g key={t}>
                <line x1={X(t)} x2={X(t)} y1={mt} y2={mt + ph} stroke="var(--rpl-grid)" strokeWidth={hh === 0 ? 1.5 : 1} opacity={hh === 0 ? 1 : major ? 1 : 0.5} />
                {major && X(t) > ml + 18 && <text x={X(t)} y={mt + ph + 16} textAnchor="middle">{String(hh).padStart(2, '0')}:00</text>}
                {(hh === 0 || t === t0) && <text x={X(t) + 4} y={mt + ph + 34} style={{ fill: 'var(--rpl-ink)', fontWeight: 700 }}>{DAYN[Math.floor(t / 1440)]} {12 + Math.floor(t / 1440)} nov</text>}
              </g>
            );
          })}
          {CPS.map((c) => (
            <g key={c.n}>
              <line x1={ml} x2={ml + pw} y1={Y(c.km)} y2={Y(c.km)} stroke="var(--rpl-line)" strokeDasharray={c.km === 0 || c.km === KM ? undefined : '4 4'} />
              <text x={ml - 10} y={Y(c.km) - 2} textAnchor="end" style={{ fill: 'var(--rpl-ink)', fontWeight: 700, fontSize: 12 }}>{c.n} · {Math.round(c.km)} km</text>
              <text x={ml - 10} y={Y(c.km) + 12} textAnchor="end" style={{ fontSize: 10 }}>{c.p}</text>
            </g>
          ))}
          {showS && <polygon points={band(SOLO_START, lead, last)} fill="var(--rpl-solo)" opacity={0.18} />}
          {showT && <polygon points={band(ts, fast, slow)} fill="var(--rpl-team)" opacity={0.16} />}
          {CP_AMB.map(([i, a, b]) => {
            const x1 = X(ts + a), x2 = X(ts + b), y = Y(CPS[i].km);
            return (
              <g key={i}>
                <line x1={x1} x2={x2} y1={y} y2={y} stroke="var(--rpl-amb)" strokeWidth={7} strokeLinecap="round" opacity={0.9} />
                <text x={(x1 + x2) / 2} y={y + 17} textAnchor="middle" style={{ fill: 'var(--rpl-amb)', fontSize: 10, fontWeight: 700 }}>{hm(ts + a)}–{hm(ts + b)}</text>
              </g>
            );
          })}
          {showS && SOLO_P.map((p, i) => line(SOLO_START, p, 'var(--rpl-solo)', i, SOLO_P.length))}
          {showT && TEAM_P.map((p, i) => line(ts, p, 'var(--rpl-team)', i, TEAM_P.length))}
          {showS && <polyline points={sa.pts.map(([t, k]) => `${X(t)},${Y(k)}`).join(' ')} fill="none" stroke="var(--rpl-amb)" strokeWidth={2.5} strokeDasharray="7 4" />}
          {showS && SOLO_P.map((p) => endLabel(SOLO_START, p, `Solo ${pace(p)}`, 'var(--rpl-solo)'))}
          {showT && TEAM_P.map((p) => endLabel(ts, p, `Team ${pace(p)}`, 'var(--rpl-team)'))}
          {showS && (
            <g>
              <line x1={X(SOLO_START)} y1={Y(0)} x2={X(SOLO_START + KM * solP)} y2={Y(KM)} stroke="var(--rpl-ink)" strokeWidth={3.5} strokeLinecap="round" />
              {sol.slice(1, -1).map((c) => (
                <g key={'sol' + c.n}>
                  <circle cx={X(c.t)} cy={Y(c.km)} r={5} fill="var(--rpl-bg)" stroke="var(--rpl-ink)" strokeWidth={2.5} />
                  <text x={X(c.t) - 8} y={Y(c.km) - 8} textAnchor="end" style={{ fill: 'var(--rpl-ink)', fontWeight: 700, fontSize: 12 }}>{fmt(c.t)}</text>
                </g>
              ))}
              <text x={X(SOLO_START + KM * solP) + 8} y={Y(KM) + 16} style={{ fill: 'var(--rpl-ink)', fontWeight: 700, fontSize: 12 }}>Solo {solH} h · {pace(solP)} · llega {fmt(SOLO_START + KM * solP)}</text>
            </g>
          )}
          {showS && sa.gap && (
            <g>
              <circle cx={X(sa.gap.t)} cy={Y(sa.gap.km)} r={9} fill="none" stroke="var(--rpl-amb)" strokeWidth={2.5} />
              <text x={X(sa.gap.t) + 14} y={Y(sa.gap.km) + 16} style={{ fill: 'var(--rpl-amb)', fontWeight: 700 }}>El líder solo rebasa a la ambulancia · km {sa.gap.km}</text>
            </g>
          )}
          {view === 'all' && ov && (
            <g>
              <circle cx={X(ov.t)} cy={Y(ov.km)} r={6} fill="var(--rpl-yellow)" />
              <text x={X(ov.t) - 10} y={Y(ov.km) + 20} textAnchor="end" style={{ fill: 'var(--rpl-yellow)', fontWeight: 700 }}>Primer team alcanza al último solo</text>
            </g>
          )}
        </svg>
      </div>

      <div className="rpl-tw">
        <table>
          <thead><tr><th>Paso por checkpoint</th>{CPS.slice(1).map((c) => <th key={c.n}>{c.n} · {c.p}</th>)}</tr></thead>
          <tbody>
            {[...(showS ? [{ l: `Solo ${solH} h ·`, c: 'var(--rpl-ink)', s: SOLO_START, p: solP }, ...SOLO_P.map((p) => ({ l: 'Solo', c: 'var(--rpl-solo)', s: SOLO_START, p }))] : []), ...(showT ? TEAM_P.map((p) => ({ l: 'Team', c: 'var(--rpl-team)', s: ts, p })) : [])].map((r) => (
              <tr key={r.l + r.p}>
                <td><i className="dot" style={{ background: r.c }} />{r.l} {pace(r.p)}</td>
                {CPS.slice(1).map((c, i) => {
                  const t = r.s + c.km * r.p, w = win(i + 1), out = !w || t < w[0] || t > w[1];
                  return <td key={c.n} className={out ? 'out' : undefined}>{fmt(t)}</td>;
                })}
              </tr>
            ))}
            <tr className="amb">
              <td><i className="dot" style={{ background: 'var(--rpl-amb)' }} />Ambulancia</td>
              {CPS.slice(1).map((c, i) => { const w = win(i + 1)!; return <td key={c.n}>{fmt(w[0])} → {hm(w[1])}</td>; })}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="rpl-notes">
        <div><b>Ambulancia solo</b>Se adelanta 20 km al líder solo y espera en ese punto hasta que pasa el último solo; luego salta al siguiente punto.</div>
        <div><b>Ambulancias en checkpoint</b>Paramédicos en CP1–CP4 y meta, con los mismos horarios que el staff de cada checkpoint para Teams.</div>
        <div><b>Unidad de respuesta rápida</b>No hay ambulancias en la brecha. La unidad de respuesta rápida debe estar en posición 45 min antes de que entre el primer corredor y hasta 30 min después de que sale el último.</div>
        <div><b>Supuestos</b>Ritmos constantes, sin paradas. En la tabla, en rojo: el corredor pasa cuando no hay ambulancia en ese checkpoint. Ambulancia en brecha a la mitad de velocidad. Amanecer ~06:20, atardecer ~17:30.</div>
      </div>
    </main>
  );
}
