'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from './I18n';
import { useToast, useCopy } from './ui';
import { saveTiming, assignTeamNumbers, setTeamNumber } from '@/app/actions/timing';
import type { ARace, ATeam } from './admin';

type CP = { id?: string; num: number | string; name: string; km: number | string | null };

export function TimingPanel({ race, teams, solos, checkpoints }: { race: ARace; teams: ATeam[]; solos: ATeam[]; checkpoints: { id: string; num: number; name: string; km: number | null }[] }) {
  const { t } = useT();
  const router = useRouter();
  const toast = useToast();
  const copy = useCopy();
  const [, start] = useTransition();
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const init = { timing_code: race.timing_code || '', board_public: race.board_public, checkpoints: checkpoints.map((c) => ({ ...c })) as CP[] };
  const [f, setF] = useState(init);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = JSON.stringify(f) !== JSON.stringify(init);
  const base = `${origin}/r/${race.slug || race.id}`;
  const all = [...teams, ...solos].sort((a, b) => (a.team_no ?? 1e9) - (b.team_no ?? 1e9) || a.name.localeCompare(b.name));
  const missing = all.filter((x) => x.team_no == null).length;
  const setCp = (i: number, k: keyof CP, v: string) => setF((x) => ({ ...x, checkpoints: x.checkpoints.map((c, j) => (j === i ? { ...c, [k]: v } : c)) }));
  const inp = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', font: 'inherit', fontSize: 14, minWidth: 0 } as const;

  const save = async () => {
    setBusy(true); setErr(null);
    const r = await saveTiming(race.id, f);
    setBusy(false);
    if (r.error) return setErr(r.error);
    toast(t('saved')); start(() => router.refresh());
  };

  return (
    <div className="stack">
      <div className="card stack" style={{ gap: 10 }}>
        <h3>{t('tm_links')}</h3>
        {[{ label: t('tm_public'), url: `${base}/leaderboard`, sub: t('tm_publicSub') }, { label: t('tm_staff'), url: `${base}/checkin`, sub: t('tm_staffSub') }].map((l) => (
          <div key={l.url} className="row" style={{ justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <div style={{ minWidth: 0 }}><b>{l.label}</b><div className="muted" style={{ fontSize: 13 }}>{l.sub}</div><span className="code" style={{ fontSize: 12, overflowWrap: 'anywhere' }}>{l.url}</span></div>
            <span className="row" style={{ gap: 6 }}><button type="button" className="btn btn-sm" onClick={() => copy(l.url)}>{t('copy')}</button><a className="btn btn-sm" href={l.url} target="_blank" rel="noreferrer">{t('pg_view')} ↗</a></span>
          </div>
        ))}
      </div>

      <div className="card stack">
        <h3>{t('tm_setup')}</h3>
        <div className="form">
          <div className="field">
            <label htmlFor="tm-pass">{t('tm_passcode')}</label>
            <input id="tm-pass" value={f.timing_code} onChange={(e) => setF((x) => ({ ...x, timing_code: e.target.value }))} autoComplete="off" />
            <span className="hint">{t('tm_passcodeHint')}</span>
          </div>
          <label className="check" style={{ alignSelf: 'center' }}><input type="checkbox" checked={f.board_public} onChange={(e) => setF((x) => ({ ...x, board_public: e.target.checked }))} /> <span>{t('tm_boardPublic')}</span></label>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <div className="label">{t('tm_checkpoints')}</div>
          <p className="muted" style={{ fontSize: 13 }}>{t('tm_checkpointsSub')}</p>
          {f.checkpoints.map((c, i) => (
            <div key={c.id || 'n' + i} className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
              <input aria-label={t('tm_num')} placeholder="#" value={c.num} type="number" min={1} style={{ ...inp, width: 70 }} onChange={(e) => setCp(i, 'num', e.target.value)} />
              <input aria-label={t('name')} placeholder={t('tm_cpName')} value={c.name} style={{ ...inp, flex: 1 }} onChange={(e) => setCp(i, 'name', e.target.value)} />
              <input aria-label="km" placeholder="km" value={c.km ?? ''} type="number" step="0.1" style={{ ...inp, width: 90 }} onChange={(e) => setCp(i, 'km', e.target.value)} />
              <button type="button" className="btn btn-ghost btn-sm" aria-label={t('del')} onClick={() => { if (!c.id || confirm(t('tm_delCp'))) setF((x) => ({ ...x, checkpoints: x.checkpoints.filter((_, j) => j !== i) })); }}>✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start' }}
            onClick={() => setF((x) => ({ ...x, checkpoints: [...x.checkpoints, { num: Math.max(0, ...x.checkpoints.map((c) => Number(c.num) || 0)) + 1, name: '', km: '' }] }))}>+ {t('tm_addCp')}</button>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {err && <span className="err">{t(err)}</span>}
          {dirty && <button type="button" className="btn" onClick={() => { setF(init); setErr(null); }}>{t('cancel')}</button>}
          <button type="button" className="btn btn-primary" disabled={!dirty || busy} onClick={save}>{busy ? <span className="spin" /> : t('save')}</button>
        </div>
      </div>

      <div className="card stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div><h3>{t('tm_numbers')}</h3><p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{t('tm_numbersSub')}</p></div>
          {missing > 0 && <button type="button" className="btn btn-sm btn-primary" onClick={async () => { const r = await assignTeamNumbers(race.id); toast(t('tm_assigned').replace('{n}', String(r.count))); start(() => router.refresh()); }}>{t('tm_assign').replace('{n}', String(missing))}</button>}
        </div>
        <div className="tbl-wrap"><table>
          <thead><tr><th style={{ width: 110 }}>#</th><th>{t('team')}</th></tr></thead>
          <tbody>{all.map((x) => (
            <tr key={x.id}>
              <td><NumberCell team={x} onSaved={() => start(() => router.refresh())} /></td>
              <td><b>{x.name}</b>{x.is_solo && <span className="chip plain" style={{ marginLeft: 6 }}>Solo</span>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
    </div>
  );
}

function NumberCell({ team, onSaved }: { team: ATeam; onSaved: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const [v, setV] = useState(team.team_no == null ? '' : String(team.team_no));
  useEffect(() => setV(team.team_no == null ? '' : String(team.team_no)), [team.team_no]);
  const save = async () => {
    if (v === (team.team_no == null ? '' : String(team.team_no))) return;
    const r = await setTeamNumber(team.id, v);
    if (r.error) { toast(t(r.error)); setV(team.team_no == null ? '' : String(team.team_no)); return; }
    onSaved();
  };
  return <input aria-label={`# ${team.name}`} type="number" min={1} value={v} onChange={(e) => setV(e.target.value)} onBlur={save}
    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    style={{ width: 80, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--surface)', font: 'inherit' }} />;
}
