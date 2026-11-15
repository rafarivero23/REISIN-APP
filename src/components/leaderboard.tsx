'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from './I18n';
import { fmtElapsed, fmtKm, rankTeams, type Board, type BoardTeam } from '@/lib/timing-shared';

import { categoryLabel } from '@/lib/groups';
import { HandFrame } from './HandFrame';
const BRANCHES = ['all', 'varonil', 'mixto', 'femenil'] as const;

export function Leaderboard({ board }: { board: Board }) {
  const { t, lang } = useT();
  const router = useRouter();
  const [cat, setCat] = useState<(typeof BRANCHES)[number]>('all');
  const [div, setDiv] = useState<string>('all');
  const [cp, setCp] = useState<string>('all'); // 'all' = overall ranking, else a checkpoint id
  const [q, setQ] = useState('');
  const [ago, setAgo] = useState(0);
  // Live: refresh every 30 s while the tab is visible.
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, 30000);
    return () => clearInterval(id);
  }, [router]);
  useEffect(() => {
    const tick = () => setAgo(Math.max(0, Math.round((Date.now() - Date.parse(board.updated)) / 1000)));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [board.updated]);

  const cps = board.checkpoints;
  const clockOf = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString(lang === 'en' ? 'en-US' : 'es-MX', { hour: '2-digit', minute: '2-digit' }) : '');
  const present = new Set(board.teams.filter((x) => div === 'all' || x.div === div).map((x) => x.category || ''));
  const divs = Array.from(new Set(board.teams.map((x) => x.div).filter(Boolean))).sort((a, b) => (a === 'solo' ? 1 : b === 'solo' ? -1 : Number(a) - Number(b)));
  const rows = useMemo(() => {
    let list = board.teams.filter((x) => (cat === 'all' || x.category === cat) && (div === 'all' || x.div === div));
    if (cp !== 'all') {
      const cpNum = cps.find((c) => c.id === cp)?.num ?? 0;
      list = rankTeams(list.map((x) => ({ ...x, dnf: null, last: x.clock?.[cp] ? cpNum : -1, lastMs: x.times[cp] ?? null, lastAt: x.clock?.[cp] ? Date.parse(x.clock[cp]) : null })));
    }
    return list;
  }, [board.teams, cat, div, cp, cps]);
  // Positions are computed on the filtered ranking, then the search narrows the view.
  const dnfOf = new Map(board.teams.map((x) => [x.id, x.dnf || null]));
  const ranked = rows.map((x, i) => ({ ...x, dnf: dnfOf.get(x.id) || null, pos: (cp === 'all' ? x.last >= 0 && !x.dnf : !!x.clock?.[cp]) ? i + 1 : null }));
  const tx = (es: string, en: string) => (lang === 'en' ? en : es);
  const finalCell = (x: BoardTeam) => x.dnf
    ? <><span className="chip bad lb-dnf">DNF</span><div className="muted num" style={{ fontSize: 12 }}>{[fmtKm(x.dnf.km), x.dnf.ms != null ? fmtElapsed(x.dnf.ms) : ''].filter(Boolean).join(' · ')}</div></>
    : x.finishMs != null
      ? <><b className="num lb-final">{fmtElapsed(x.finishMs)}</b><div className="muted num" style={{ fontSize: 12 }}>{tx('Meta', 'Finish')}{x.km != null ? ` · ${fmtKm(x.km)}` : ''}</div></>
      : x.km != null && x.last > 0 ? <span className="muted num">{fmtKm(x.km)}</span> : <span className="muted">—</span>;
  const shown = ranked.filter((x) => !q || `${x.no ?? ''} ${x.name}`.toLowerCase().includes(q.toLowerCase()));
  const best = (id: string) => Math.min(...rows.map((x) => x.times[id]).filter((v): v is number => v != null));
  const lastLabel = (x: BoardTeam) => (x.last < 0 ? t('lb_notStarted') : x.last === 0 ? t('lb_started') : cps.find((c) => c.num === x.last)?.name || `PC ${x.last}`);
  const started = board.teams.filter((x) => x.last >= 0 && !x.dnf && x.finishMs == null).length;
  const dnfN = board.teams.filter((x) => x.dnf).length, finN = board.teams.filter((x) => !x.dnf && x.finishMs != null).length;

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 8 }}>
          <b className="hb lb-livebox"><HandFrame seed={7} /><span className="live-dot" aria-hidden /> {t('lb_live')}</b>
          <span className="muted" style={{ fontSize: 13 }}>{t('lb_updated').replace('{s}', String(ago))} · {started}/{board.teams.length} {t('lb_onCourse')}{finN ? ` · ${finN} ${tx('en meta', 'finished')}` : ''}{dnfN ? ` · ${dnfN} DNF` : ''}</span>
        </div>
        <button type="button" className="btn btn-sm" onClick={() => router.refresh()}>↻ {t('lb_refresh')}</button>
      </div>
      <div className="lb-filters">
        <div className="seg" role="tablist" aria-label={t('cat_division')}>
          {['all', ...divs].map((d) => (
            <button key={d} type="button" role="tab" aria-selected={div === d} onClick={() => { setDiv(d); if (d === 'solo' && cat === 'mixto') setCat('all'); }}>{d === 'all' ? t('lb_all') : d === 'solo' ? 'Solo' : `${d} ${t('cat_membersShort')}`}</button>
          ))}
        </div>
        <div className="seg" role="tablist" aria-label={t('category')}>
          {BRANCHES.filter((c) => c === 'all' || present.has(c) || cat === c).map((c) => (
            <button key={c} type="button" role="tab" aria-selected={cat === c} onClick={() => setCat(c)}>{c === 'all' ? t('lb_all') : t(c)}</button>
          ))}
        </div>
        <select value={cp} onChange={(e) => setCp(e.target.value)} aria-label={t('lb_checkpoint')}>
          <option value="all">{t('lb_overall')}</option>
          {cps.map((c) => <option key={c.id} value={c.id}>{`PC ${c.num} · ${c.name}${c.km != null ? ` · km ${c.km}` : ''}`}</option>)}
        </select>
        <input className="search" type="search" placeholder={t('lb_search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('lb_search')} />
      </div>
      {!cps.length && <div className="note">{t('lb_noCps')}</div>}
      {board.teams.some((x) => !x.start && Object.keys(x.clock || {}).length) && <div className="note" style={{ fontSize: 13 }}>{t('lb_noStartNote')}</div>}
      <div className="tbl-wrap lb-table">
        <table>
          <thead>
            <tr>
              <th className="lb-sticky lb-pos">#</th>
              <th className="lb-sticky lb-team">{t('team')}</th>
              <th>{t('category')}</th>
              {cp === 'all' && <th>{t('lb_last')}</th>}
              {cp === 'all' && <th>{tx('Final', 'Final')}<div className="lb-sub">{tx('tiempo · km', 'time · km')}</div></th>}
              {cps.map((c) => (
                <th key={c.id} className={'num' + (cp === c.id ? ' lb-focus' : '')} style={{ textAlign: 'right' }}>
                  PC {c.num}<div className="lb-sub">{c.name}{c.km != null ? ` · ${c.km} km` : ''}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((x) => (
              <tr key={x.id} className={x.pos === 1 ? 'lb-first' : x.dnf && cp === 'all' ? 'lb-out' : undefined}>
                <td className="lb-sticky lb-pos num"><b className="lb-posn">{x.pos ?? (x.dnf && cp === 'all' ? 'DNF' : '–')}</b></td>
                <td className="lb-sticky lb-team">
                  <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                    {x.logo ? <img src={x.logo} alt="" className="lb-logo" /> : <span className="lb-logo lb-noLogo" aria-hidden>{x.no ?? ''}</span>}
                    <div style={{ minWidth: 0 }}>
                      <b className="lb-name">{x.name}</b>
                      <div className="muted" style={{ fontSize: 12 }}>{x.no != null ? (x.no.startsWith("S") ? x.no : `#${x.no}`) : ''}{x.group ? <> · <span style={{ color: x.groupColor || undefined }}>{t('group')} {x.group}</span></> : ''}</div>
                    </div>
                  </div>
                </td>
                <td><span className={'chip plain cat-' + (x.category || 'none')} style={{ whiteSpace: 'nowrap' }}>{categoryLabel(x.div, x.category, t)}</span></td>
                {cp === 'all' && <td style={{ whiteSpace: 'nowrap' }}>{lastLabel(x)}{x.last > 0 && <div className="muted num" style={{ fontSize: 12 }}>{x.lastMs != null ? fmtElapsed(x.lastMs) : <span title={t('lb_noStartHint')}>{clockOf(x.clock?.[cps.find((c) => c.num === x.last)?.id || ''])} · {t('lb_noStart')}</span>}</div>}</td>}
                {cp === 'all' && <td style={{ whiteSpace: 'nowrap' }}>{finalCell(x)}</td>}
                {cps.map((c) => {
                  const v = x.times[c.id], at = x.clock?.[c.id];
                  return <td key={c.id} className={'num' + (cp === c.id ? ' lb-focus' : '') + (v != null && v === best(c.id) ? ' lb-best' : '')} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {v != null ? fmtElapsed(v) : at ? <span className="muted" title={t('lb_noStartHint')}>{clockOf(at)} ⏱</span> : '—'}
                  </td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && <div className="empty">{t('noTeams')}</div>}
      </div>
      {/* phones: one card per team instead of the wide table */}
      <ul className="lb-cards">
        {shown.map((x) => {
          const reached = cp === 'all' ? x.last : x.clock?.[cp] ? (cps.find((c) => c.id === cp)?.num ?? 0) : -1;
          const cpAt = cp === 'all' ? cps.find((c) => c.num === x.last) : cps.find((c) => c.id === cp);
          const ms = cp === 'all' ? (x.last > 0 ? x.lastMs : null) : x.times[cp] ?? null;
          const clock = cpAt ? x.clock?.[cpAt.id] : undefined;
          return (
            <li key={x.id} className={x.pos === 1 ? 'lb-first' : x.dnf && cp === 'all' ? 'lb-out' : undefined}>
              <b className="lb-posn">{x.pos ?? (x.dnf && cp === 'all' ? 'DNF' : '–')}</b>
              <div className="lb-c-main">
                <b className="lb-name">{x.name}</b>
                <div className="lb-c-meta">
                  <span className={'chip plain cat-' + (x.category || 'none')}>{categoryLabel(x.div, x.category, t)}</span>
                  <span className="muted">{x.no != null ? (x.no.startsWith("S") ? x.no : `#${x.no}`) : ''}{x.group ? `${x.no != null ? ' · ' : ''}${t('group')} ${x.group}` : ''}</span>
                </div>
                {cps.length > 0 && <div className="lb-bar" aria-hidden>{cps.map((c) => <i key={c.id} className={reached >= c.num ? 'on' : ''} />)}</div>}
              </div>
              <div className="lb-c-time">
                {cp === 'all' && x.dnf ? <><b className="num">DNF</b><span className="muted">{[fmtKm(x.dnf.km), x.dnf.ms != null ? fmtElapsed(x.dnf.ms) : ''].filter(Boolean).join(' · ')}</span></>
                  : cp === 'all' && x.finishMs != null ? <><b className="num">{fmtElapsed(x.finishMs)}</b><span className="muted">{tx('Meta', 'Finish')}{x.km != null ? ` · ${fmtKm(x.km)}` : ''}</span></>
                  : <><b className="num">{ms != null ? fmtElapsed(ms) : clock ? `${clockOf(clock)} ⏱` : '—'}</b>
                <span className="muted">{cp === 'all' ? lastLabel(x) : cpAt ? `PC ${cpAt.num}` : ''}{cp === 'all' && x.km != null && x.last > 0 ? ` · ${fmtKm(x.km)}` : ''}</span></>}
              </div>
            </li>
          );
        })}
        {!shown.length && <li className="empty">{t('noTeams')}</li>}
      </ul>
      <p className="muted" style={{ fontSize: 12 }}>{t('lb_legend')}</p>
    </div>
  );
}
