'use client';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BX_ROUTE } from '@/lib/bxRoute';

// Baja route block: grey map traced from Strava (route draws itself on scroll),
// checkpoints, and an elevation profile you can scrub — a dot follows on the map.
type L = { route: string; strava?: string; stravaLabel: string; text?: React.ReactNode; dist: string; max: string; cps: string; start: string; finish: string; elev: string };
const elev = BX_ROUTE.elev as unknown as [number, number][];
const KM = elev[elev.length - 1][0];
const MAXM = Math.max(...elev.map((p) => p[1]));

export function BxRoute({ l, km }: { l: L; km?: string }) {
  const box = useRef<HTMLElement>(null);
  const path = useRef<SVGPathElement>(null);
  const [on, setOn] = useState(false);
  const [k, setK] = useState<number | null>(null);
  const [dot, setDot] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = box.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el); return () => io.disconnect();
  }, []);

  // elevation profile geometry
  const W = 1000, H = 150, top = 12, hi = Math.ceil((MAXM + 60) / 200) * 200;
  const X = (x: number) => (x / KM) * W, Y = (m: number) => top + (1 - m / hi) * (H - top);
  const line = useMemo(() => elev.map(([a, m], i) => `${i ? 'L' : 'M'}${X(a).toFixed(1)},${Y(m).toFixed(1)}`).join(''), []); // eslint-disable-line react-hooks/exhaustive-deps
  const altAt = (x: number) => { let best = elev[0]; for (const p of elev) if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p; return best[1]; };

  const scrub = (clientX: number, r: DOMRect) => {
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    setK(f * KM);
    const p = path.current; if (p) { const pt = p.getPointAtLength(f * p.getTotalLength()); setDot({ x: pt.x, y: pt.y }); }
  };
  const cps = BX_ROUTE.cps as unknown as [number, number, number][];

  return (
    <section ref={box} className={'bxr sv-bleed' + (on ? ' on' : '')}>
      <div className="bxr-map">
        <svg viewBox="170 0 560 470" role="img" aria-label={l.route}>
          <defs>
            <pattern id="bxr-dots" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="rgba(255,255,255,.07)" /></pattern>
            <pattern id="bxr-grid" width="56" height="56" patternUnits="userSpaceOnUse"><path d="M56 0H0V56" fill="none" stroke="rgba(255,255,255,.05)" /></pattern>
          </defs>
          <rect x="0" y="0" width="848" height="480" fill="url(#bxr-grid)" />
          {BX_ROUTE.land.map((d, i) => <g key={i}><path d={d} className="land" /><path d={d} fill="url(#bxr-dots)" /></g>)}
          <text x="610" y="120" className="sea">MAR DE CORTÉS</text>
          <text x="215" y="440" className="sea">OCÉANO PACÍFICO</text>
          <path d={BX_ROUTE.route} className="rt-glow" />
          <path ref={path} d={BX_ROUTE.route} className="rt" pathLength={1} />
          {cps.map(([x, y], i) => (
            <g key={i} className="cp" style={{ transitionDelay: `${0.4 + i * 0.35}s` }}>
              <circle cx={x} cy={y} r="5" /><text x={x + 10} y={y + 4}>PC{i + 1}</text>
            </g>
          ))}
          <g className="pin start"><circle cx={BX_ROUTE.start[0]} cy={BX_ROUTE.start[1]} r="6" /><circle className="pulse" cx={BX_ROUTE.start[0]} cy={BX_ROUTE.start[1]} r="6" /><text x={BX_ROUTE.start[0] + 12} y={BX_ROUTE.start[1] - 8}>{l.start}</text></g>
          <g className="pin end"><rect x={BX_ROUTE.end[0] - 6} y={BX_ROUTE.end[1] - 6} width="12" height="12" /><text x={BX_ROUTE.end[0] - 12} y={BX_ROUTE.end[1] + 24} textAnchor="end">{l.finish}</text></g>
          {dot && <g className="here"><circle cx={dot.x} cy={dot.y} r="11" className="ring" /><circle cx={dot.x} cy={dot.y} r="4.5" /></g>}
          <g className="nrose" transform="translate(690 40)"><path d="M0 -16 L5 4 L0 0 L-5 4Z" /><text y="20" textAnchor="middle">N</text></g>
        </svg>
      </div>

      <div className="bxr-side">
        <span className="mono">{l.route}</span>
        {l.text && <div className="sv-route-txt">{l.text}</div>}
        <dl className="bxr-stats">
          <div><dt className="mono">{l.dist}</dt><dd>{km || Math.round(KM)}<small>km</small></dd></div>
          <div><dt className="mono">{l.max}</dt><dd>{Math.round(MAXM / 10) * 10}<small>m</small></dd></div>
          <div><dt className="mono">{l.cps}</dt><dd>{cps.length}</dd></div>
        </dl>
        <div className="bxr-elev"
          onMouseMove={(e) => scrub(e.clientX, e.currentTarget.getBoundingClientRect())}
          onTouchMove={(e) => scrub(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
          onMouseLeave={() => { setK(null); setDot(null); }}>
          <div className="bxr-read mono">{k === null ? l.elev : <>KM <b>{Math.round(k)}</b> · <b>{altAt(k)}</b> m</>}</div>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            {[200, 400, 600].filter((m) => m < hi).map((m) => <line key={m} x1="0" x2={W} y1={Y(m)} y2={Y(m)} className="g" />)}
            <path d={`${line}L${W},${H}L0,${H}Z`} className="a" />
            <path d={line} className="l" vectorEffect="non-scaling-stroke" />
            {cps.map(([, , f], i) => <line key={i} x1={f * W} x2={f * W} y1={top} y2={H} className="c" vectorEffect="non-scaling-stroke" />)}
            {k !== null && <line x1={X(k)} x2={X(k)} y1="0" y2={H} className="h" vectorEffect="non-scaling-stroke" />}
          </svg>
          <div className="bxr-x mono">{[0, 50, 100, 150, 200].filter((x) => x < KM - 25).map((x) => <span key={x} style={{ left: `${(x / KM) * 100}%` }}>{x}</span>)}<span style={{ right: 0 }}>{Math.round(KM)} km</span></div>
        </div>
        {l.strava && <a className="mono sv-ul" href={l.strava} target="_blank" rel="noopener noreferrer">{l.stravaLabel} ↗</a>}
      </div>
    </section>
  );
}
