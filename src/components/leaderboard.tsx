'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from './I18n';
import { fmtElapsed, rankTeams, type Board, type BoardTeam } from '@/lib/timing-shared';

const CATS = ['all', 'varonil', 'femenil', 'mixto', 'solo'] as const;
const catLabel = (c: string | null, t: (k: string) => string) => (c === 'solo' ? 'Solo' : c ? t(c) : '—');

export function Leaderboard({ board }: { board: Board }) {
  const { t } = useT();
  const router = useRouter();
  const [cat, setCat] = useState<(typeof CATS)[number]>('all');
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
  const present = new Set(board.teams.map((x) => x.category || ''));
  const rows = useMemo(() => {
    let list = board.teams.filter((x) => cat === 'all' || x.category === cat);
    if (cp !== 'all') {
      const cpNum = cps.find((c) => c.id === cp)?.num ?? 0;
      list = rankTeams(list.map((x) => ({ ...x, last: x.times[cp] != null ? cpNum : -1, lastMs: x.times[cp] ?? null })));
    }
    return list;
  }, [board.teams, cat, cp, cps]);
  // Positions are computed on the filtered ranking, then the search narrows the view.
  const ranked = rows.map((x, i) => ({ ...x, pos: (cp === 'all' ? x.last >= 0 : x.times[cp] != null) ? i + 1 : null }));
  const shown = ranked.filter((x) => !q || `${x.no ?? ''} ${x.name}`.toLowerCase().includes(q.toLowerCase()));
  const best = (id: string) => Math.min(...rows.map((x) => x.times[id]).filter((v): v is number => v != null));
  const lastLabel = (x: BoardTeam) => (x.last < 0 ? t('lb_notStarted') : x.last === 0 ? t('lb_started') : cps.find((c) => c.num === x.last)?.name || `PC ${x.last}`);
  const started = board.teams.filter((x) => x.last >= 0).length;

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="live-dot" aria-hidden /> <b>{t('lb_live')}</b>
          <span className="muted" style={{ fontSize: 13 }}>{t('lb_updated').replace('{s}', String(ago))} · {started}/{board.teams.length} {t('lb_onCourse')}</span>
        </div>
        <button type="button" className="btn btn-sm" onClick={() => router.refresh()}>↻ {t('lb_refresh')}</button>
      </div>
      <div className="lb-filters">
        <div className="seg" role="tablist" aria-label={t('category')}>
          {CATS.filter((c) => c === 'all' || present.has(c)).map((c) => (
            <button key={c} type="button" role="tab" aria-selected={cat === c} onClick={() => setCat(c)}>{c === 'all' ? t('lb_all') : catLabel(c, t)}</button>
          ))}
        </div>
        <select value={cp} onChange={(e) => setCp(e.target.value)} aria-label={t('lb_checkpoint')}>
          <option value="all">{t('lb_overall')}</option>
          {cps.map((c) => <option key={c.id} value={c.id}>{`PC ${c.num} · ${c.name}${c.km != null ? ` · km ${c.km}` : ''}`}</option>)}
        </select>
        <input className="search" type="search" placeholder={t('lb_search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('lb_search')} />
      </div>
      {!cps.length && <div className="note">{t('lb_noCps')}</div>}
      <div className="tbl-wrap lb-table">
        <table>
          <thead>
            <tr>
              <th className="lb-sticky lb-pos">#</th>
              <th className="lb-sticky lb-team">{t('team')}</th>
              <th>{t('category')}</th>
              {cp === 'all' && <th>{t('lb_last')}</th>}
              {cps.map((c) => (
                <th key={c.id} className={'num' + (cp === c.id ? ' lb-focus' : '')} style={{ textAlign: 'right' }}>
                  PC {c.num}<div className="lb-sub">{c.name}{c.km != null ? ` · ${c.km} km` : ''}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((x) => (
              <tr key={x.id} className={x.pos === 1 ? 'lb-first' : undefined}>
                <td className="lb-sticky lb-pos num"><b>{x.pos ?? '–'}</b></td>
                <td className="lb-sticky lb-team">
                  <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                    {x.logo ? <img src={x.logo} alt="" className="lb-logo" /> : <span className="lb-logo lb-noLogo" aria-hidden>{x.no ?? ''}</span>}
                    <div style={{ minWidth: 0 }}>
                      <b className="lb-name">{x.name}</b>
                      <div className="muted" style={{ fontSize: 12 }}>{x.no != null ? `#${x.no}` : ''}{x.group ? <> · <span style={{ color: x.groupColor || undefined }}>{t('group')} {x.group}</span></> : ''}</div>
                    </div>
                  </div>
                </td>
                <td><span className={'chip plain cat-' + (x.category || 'none')}>{catLabel(x.category, t)}</span></td>
                {cp === 'all' && <td style={{ whiteSpace: 'nowrap' }}>{lastLabel(x)}{x.last > 0 && <div className="muted num" style={{ fontSize: 12 }}>{fmtElapsed(x.lastMs)}</div>}</td>}
                {cps.map((c) => {
                  const v = x.times[c.id];
                  return <td key={c.id} className={'num' + (cp === c.id ? ' lb-focus' : '') + (v != null && v === best(c.id) ? ' lb-best' : '')} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtElapsed(v)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && <div className="empty">{t('noTeams')}</div>}
      </div>
      <p className="muted" style={{ fontSize: 12 }}>{t('lb_legend')}</p>
    </div>
  );
}
