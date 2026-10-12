'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from './I18n';
import { Field, useToast } from './ui';
import { timingLogin, recordCheckin, removeCheckin, startWave } from '@/app/actions/timing';
import { START, fmtElapsed } from '@/lib/timing-shared';

type T = { id: string; no: number | null; name: string; solo: boolean; group: string | null };
type CP = { id: string; num: number; name: string; km: number | null };
type CI = { team_id: string; checkpoint_id: string; at: string; by: string | null };
// Pending writes survive no-signal spots: kept in localStorage and retried.
type Op = { k: 'set'; team: string; cp: string; at: string } | { k: 'del'; team: string; cp: string };

const store = {
  get<V>(key: string, d: V): V { try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as V) : d; } catch { return d; } },
  set(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} },
};
const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const toLocalInput = (iso: string) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 19); };
const fromLocalInput = (v: string) => new Date(v).toISOString();

/* ---------------- passcode gate ---------------- */
export function TimingGate({ raceId, raceName }: { raceId: string; raceName: string }) {
  const { t } = useT();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="card" style={{ maxWidth: 440 }}>
      <div className="label">{raceName}</div>
      <h2 style={{ margin: '4px 0 6px' }}>{t('tm_title')}</h2>
      <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>{t('tm_gateSub')}</p>
      <form className="form" style={{ gridTemplateColumns: '1fr' }} onSubmit={async (e) => {
        e.preventDefault();
        const r = await timingLogin(raceId, code, name);
        if ('error' in r) return setErr(r.error);
        router.refresh();
      }}>
        <Field id="tm-name" label={t('tm_yourName')} value={name} onChange={setName} req autoComplete="name" />
        <Field id="tm-code" label={t('tm_passcode')} type="password" value={code} onChange={setCode} req autoComplete="off" />
        {err && <p className="err">{t(err)}</p>}
        <div><button className="btn btn-primary btn-lg" type="submit">{t('p_enter')}</button></div>
      </form>
    </div>
  );
}

/* ---------------- check-in app ---------------- */
export function CheckinApp({ raceId, raceName, staff, teams, checkpoints, checkins, waves }: {
  raceId: string; raceName: string; staff: string; teams: T[]; checkpoints: CP[]; checkins: CI[]; waves: string[];
}) {
  const { t } = useT();
  const router = useRouter();
  const toast = useToast();
  const qKey = `reisin_q_${raceId}`, cpKey = `reisin_cp_${raceId}`;
  const [cp, setCpState] = useState<string>(START);
  const [queue, setQueue] = useState<Op[]>([]);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [undo, setUndo] = useState<{ team: string; cp: string; name: string } | null>(null);
  const flushing = useRef(false);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => { const saved = store.get(cpKey, START); setCpState(saved === START || checkpoints.some((c) => c.id === saved) ? saved : START); setQueue(store.get<Op[]>(qKey, [])); setOnline(navigator.onLine); }, [cpKey, qKey, checkpoints]);
  const setCp = (v: string) => { setCpState(v); store.set(cpKey, v); setEdit(null); };
  const saveQueue = (next: Op[]) => { setQueue(next); store.set(qKey, next); };

  // Send pending writes in order; stop at the first network failure.
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      let pending = store.get<Op[]>(qKey, []);
      while (pending.length) {
        const op = pending[0];
        try {
          const r = op.k === 'set' ? await recordCheckin(raceId, op.team, op.cp, op.at) : await removeCheckin(raceId, op.team, op.cp);
          if ('error' in r && r.error === 'tm_locked') { toast(t('tm_locked')); break; }
        } catch { setOnline(false); break; }
        pending = pending.slice(1);
        store.set(qKey, pending); setQueue(pending);
        setOnline(true);
      }
      if (!pending.length) router.refresh();
    } finally { flushing.current = false; }
  }, [qKey, raceId, router, t, toast]);

  useEffect(() => {
    flush();
    const id = setInterval(() => { if (store.get<Op[]>(qKey, []).length) flush(); else if (document.visibilityState === 'visible') router.refresh(); }, 15000);
    const on = () => { setOnline(true); flush(); }, off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { clearInterval(id); window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [flush, qKey, router]);

  // Server state + pending local writes = what this phone shows.
  const times = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of checkins) m.set(`${c.team_id}|${c.checkpoint_id}`, c.at);
    for (const op of queue) { const k = `${op.team}|${op.cp}`; if (op.k === 'set') m.set(k, op.at); else m.delete(k); }
    return m;
  }, [checkins, queue]);
  const pendingKeys = new Set(queue.map((o) => `${o.team}|${o.cp}`));
  const push = (op: Op) => { saveQueue([...store.get<Op[]>(qKey, []), op]); setTimeout(flush, 0); };

  const tap = (team: T) => {
    const key = `${team.id}|${cp}`;
    if (times.has(key)) { setEdit(edit === team.id ? null : team.id); return; }
    const at = new Date().toISOString();
    push({ k: 'set', team: team.id, cp, at });
    setUndo({ team: team.id, cp, name: team.name });
    setQ(''); search.current?.focus();
  };
  useEffect(() => { if (!undo) return; const id = setTimeout(() => setUndo(null), 6000); return () => clearTimeout(id); }, [undo]);

  const cpObj = checkpoints.find((c) => c.id === cp);
  const filtered = teams.filter((x) => !q || (/^\d+$/.test(q.trim()) ? String(x.no ?? '') === q.trim() || String(x.no ?? '').startsWith(q.trim()) : x.name.toLowerCase().includes(q.toLowerCase())));
  const done = teams.filter((x) => times.has(`${x.id}|${cp}`));
  const recent = done.map((x) => ({ x, at: times.get(`${x.id}|${cp}`)! })).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  const startOf = (id: string) => times.get(`${id}|${START}`);

  return (
    <div className="stack ck">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div><div className="label">{raceName} · {t('tm_title')}</div><div className="muted" style={{ fontSize: 13 }}>{staff}</div></div>
        <div className="row" style={{ gap: 6 }}>
          {queue.length > 0 && <span className="chip warn">{queue.length} {t('tm_pending')}</span>}
          <span className={'chip ' + (online ? 'ok' : 'bad')}>{online ? t('tm_online') : t('tm_offline')}</span>
        </div>
      </div>

      <div className="ck-cps" role="tablist" aria-label={t('lb_checkpoint')}>
        <button type="button" role="tab" aria-selected={cp === START} onClick={() => setCp(START)}>{t('tm_start')}</button>
        {checkpoints.map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={cp === c.id} onClick={() => setCp(c.id)}>PC {c.num}<span>{c.name}</span></button>
        ))}
      </div>

      <div className="card ck-head">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>{cp === START ? t('tm_start') : `PC ${cpObj?.num} · ${cpObj?.name}`}</h2>
          <b className="num">{done.length}/{teams.length}</b>
        </div>
        {cpObj?.km != null && <div className="muted">km {cpObj.km}</div>}
        {cp === START && <WaveStart raceId={raceId} waves={waves} onDone={() => router.refresh()} />}
      </div>

      <input ref={search} className="search ck-search" type="search" inputMode="search" placeholder={t('tm_search')} value={q} onChange={(e) => setQ(e.target.value)}
        aria-label={t('tm_search')} onKeyDown={(e) => { if (e.key === 'Enter' && filtered.length === 1) tap(filtered[0]); }} />

      {undo && (
        <div className="note row ck-undo" style={{ justifyContent: 'space-between', color: 'var(--ink)' }}>
          <span>✓ {undo.name} · {clock(times.get(`${undo.team}|${undo.cp}`) || new Date().toISOString())}</span>
          <button type="button" className="btn btn-sm" onClick={() => { push({ k: 'del', team: undo.team, cp: undo.cp }); setUndo(null); }}>{t('tm_undo')}</button>
        </div>
      )}

      <div className="ck-list">
        {filtered.map((x) => {
          const key = `${x.id}|${cp}`, at = times.get(key), st = startOf(x.id);
          return (
            <div key={x.id} className={'ck-row' + (at ? ' done' : '')}>
              <button type="button" className="ck-tap" onClick={() => tap(x)} aria-label={`${x.name}: ${at ? t('tm_edit') : t('tm_record')}`}>
                <span className="ck-no num">{x.no ?? '–'}</span>
                <span className="ck-name"><b>{x.name}</b><small className="muted">{x.solo ? 'Solo' : x.group ? `${t('group')} ${x.group}` : ''}{cp !== START && !st ? ` · ${t('tm_noStart')}` : ''}</small></span>
                <span className="ck-time num">{at ? <>{clock(at)}{pendingKeys.has(key) && ' ⏳'}{cp !== START && st && <small>{fmtElapsed(Date.parse(at) - Date.parse(st))}</small>}</> : <span className="ck-plus">＋</span>}</span>
              </button>
              {edit === x.id && at && <TimeEditor at={at} onSave={(v) => { push({ k: 'set', team: x.id, cp, at: v }); setEdit(null); }}
                onDelete={() => { if (confirm(t('tm_delConfirm'))) { push({ k: 'del', team: x.id, cp }); setEdit(null); } }} onCancel={() => setEdit(null)} />}
            </div>
          );
        })}
        {!filtered.length && <div className="empty">{t('noTeams')}</div>}
      </div>

      {recent.length > 0 && (
        <details className="card">
          <summary style={{ cursor: 'pointer' }}><b>{t('tm_recent')}</b></summary>
          <div className="list" style={{ marginTop: 8 }}>
            {recent.map(({ x, at }) => <div className="it" key={x.id}><span>#{x.no ?? '–'} {x.name}</span><span className="num">{clock(at)}</span></div>)}
          </div>
        </details>
      )}
    </div>
  );
}

function TimeEditor({ at, onSave, onDelete, onCancel }: { at: string; onSave: (iso: string) => void; onDelete: () => void; onCancel: () => void }) {
  const { t } = useT();
  const [v, setV] = useState(toLocalInput(at));
  return (
    <div className="ck-edit">
      <label className="label" htmlFor="ck-time">{t('tm_time')}</label>
      <input id="ck-time" type="datetime-local" step={1} value={v} onChange={(e) => setV(e.target.value)} />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--bad)' }} onClick={onDelete}>{t('del')}</button>
        <span className="row" style={{ gap: 6 }}>
          <button type="button" className="btn btn-sm" onClick={onCancel}>{t('cancel')}</button>
          <button type="button" className="btn btn-primary btn-sm" disabled={!v} onClick={() => onSave(fromLocalInput(v))}>{t('save')}</button>
        </span>
      </div>
    </div>
  );
}

function WaveStart({ raceId, waves, onDone }: { raceId: string; waves: string[]; onDone: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const [wave, setWave] = useState(waves[0] || 'all');
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setV(toLocalInput(new Date().toISOString())), []);
  return (
    <div className="ck-wave">
      <div className="label">{t('tm_wave')}</div>
      <p className="muted" style={{ fontSize: 13 }}>{t('tm_waveSub')}</p>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <select value={wave} onChange={(e) => setWave(e.target.value)} aria-label={t('tm_wave')}>
          {waves.map((w) => <option key={w} value={w}>{w === 'solo' ? 'Solos' : `${t('group')} ${w}`}</option>)}
          <option value="all">{t('lb_all')}</option>
        </select>
        <input type="datetime-local" step={1} value={v} onChange={(e) => setV(e.target.value)} aria-label={t('tm_time')} />
        <button type="button" className="btn btn-primary" disabled={busy || !v} onClick={async () => {
          setBusy(true);
          const r = await startWave(raceId, wave, fromLocalInput(v));
          setBusy(false);
          if ('error' in r) return toast(t(r.error));
          toast(t('tm_waveDone').replace('{n}', String(r.count))); onDone();
        }}>{t('tm_waveGo')}</button>
      </div>
    </div>
  );
}
