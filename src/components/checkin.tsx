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
const hms = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const dayOf = (iso: string) => new Date(iso).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
const stamp = (iso: string) => `${dayOf(iso)} · ${hms(iso)}`;
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
  const [pick, setPick] = useState<T | null>(null);
  const [day, setDay] = useState('');
  const [hour, setHour] = useState('');
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

  const nowParts = () => { const v = toLocalInput(new Date().toISOString()); return { d: v.slice(0, 10), h: v.slice(11, 19) }; };
  useEffect(() => { const n = nowParts(); setDay(n.d); setHour(n.h); }, []);
  const setNow = () => { const n = nowParts(); setDay(n.d); setHour(n.h); };

  const submit = () => {
    if (!pick || !day || !hour) return;
    const at = fromLocalInput(`${day}T${hour.length === 5 ? hour + ':00' : hour}`);
    if (isNaN(Date.parse(at))) return toast(t('tm_badTime'));
    push({ k: 'set', team: pick.id, cp, at });
    setUndo({ team: pick.id, cp, name: pick.name });
    setPick(null); setQ('');
    setHour(nowParts().h); // keep the chosen date (multi-day events), reset the clock
    setTimeout(() => search.current?.focus(), 0);
  };
  useEffect(() => { if (!undo) return; const id = setTimeout(() => setUndo(null), 8000); return () => clearTimeout(id); }, [undo]);

  const cpObj = checkpoints.find((c) => c.id === cp);
  const qq = q.trim().toLowerCase();
  const matches = !qq ? [] : teams.filter((x) => (/^\d+$/.test(qq) ? String(x.no ?? '').startsWith(qq) : x.name.toLowerCase().includes(qq)))
    .sort((a, b) => Number(String(b.no ?? '') === qq) - Number(String(a.no ?? '') === qq)).slice(0, 6);
  const done = teams.filter((x) => times.has(`${x.id}|${cp}`));
  const todo = teams.filter((x) => !times.has(`${x.id}|${cp}`));
  const log = done.map((x) => ({ x, at: times.get(`${x.id}|${cp}`)! })).sort((a, b) => b.at.localeCompare(a.at));
  const startOf = (id: string) => times.get(`${id}|${START}`);
  const already = pick ? times.get(`${pick.id}|${cp}`) : undefined;
  const cpLabel = (id: string) => (id === START ? t('tm_start') : (() => { const c = checkpoints.find((x) => x.id === id); return c ? `PC ${c.num} · ${c.name}${c.km != null ? ` · km ${c.km}` : ''}` : ''; })());

  return (
    <div className="stack ck">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div><div className="label">{raceName} · {t('tm_title')}</div><div className="muted" style={{ fontSize: 13 }}>{staff}</div></div>
        <div className="row" style={{ gap: 6 }}>
          {queue.length > 0 && <span className="chip warn">{queue.length} {t('tm_pending')}</span>}
          <span className={'chip ' + (online ? 'ok' : 'bad')}>{online ? t('tm_online') : t('tm_offline')}</span>
        </div>
      </div>

      <form className="card ck-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label className="ck-lbl" htmlFor="ck-cp">{t('lb_checkpoint')}</label>
        <select id="ck-cp" className="ck-input" value={cp} onChange={(e) => setCp(e.target.value)}>
          <option value={START}>{t('tm_start')}</option>
          {checkpoints.map((c) => <option key={c.id} value={c.id}>{cpLabel(c.id)}</option>)}
        </select>

        <label className="ck-lbl" htmlFor="ck-team">{t('team')}</label>
        {pick ? (
          <div className="ck-picked">
            <span className="ck-no num">{pick.no ?? '–'}</span>
            <b>{pick.name}</b>
            <button type="button" className="btn btn-ghost btn-sm" aria-label={t('cancel')} onClick={() => { setPick(null); setTimeout(() => search.current?.focus(), 0); }}>✕</button>
          </div>
        ) : (
          <div className="ck-combo">
            <input id="ck-team" ref={search} className="ck-input" type="search" autoComplete="off" placeholder={t('tm_search')} value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (matches.length) setPick(matches[0]); } }} />
            {matches.length > 0 && (
              <div className="ck-sugg" role="listbox">
                {matches.map((x) => {
                  const at = times.get(`${x.id}|${cp}`);
                  return (
                    <button key={x.id} type="button" role="option" aria-selected={false} onClick={() => setPick(x)}>
                      <span className="ck-no num">{x.no ?? '–'}</span>
                      <span className="ck-name"><b>{x.name}</b><small className="muted">{x.solo ? 'Solo' : x.group ? `${t('group')} ${x.group}` : ''}{at ? ` · ✓ ${stamp(at)}` : ''}</small></span>
                    </button>
                  );
                })}
              </div>
            )}
            {qq && !matches.length && <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{t('noTeams')}</p>}
          </div>
        )}

        <div className="ck-when">
          <div><label className="ck-lbl" htmlFor="ck-day">{t('tm_date')}</label><input id="ck-day" className="ck-input" type="date" value={day} onChange={(e) => setDay(e.target.value)} required /></div>
          <div><label className="ck-lbl" htmlFor="ck-hour">{t('tm_time')}</label><input id="ck-hour" className="ck-input" type="time" step={1} value={hour} onChange={(e) => setHour(e.target.value)} required /></div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={setNow}>⟲ {t('tm_now')}</button>
        {already && <p className="note" style={{ color: 'var(--ink)' }}>{t('tm_replace').replace('{t}', stamp(already))}</p>}
        <button type="submit" className="btn btn-primary btn-lg ck-go" disabled={!pick || !day || !hour}>{t('tm_save')}</button>
      </form>

      {undo && (
        <div className="note row ck-undo" style={{ justifyContent: 'space-between', color: 'var(--ink)' }}>
          <span>✓ {undo.name} · {stamp(times.get(`${undo.team}|${undo.cp}`) || new Date().toISOString())}</span>
          <button type="button" className="btn btn-sm" onClick={() => { push({ k: 'del', team: undo.team, cp: undo.cp }); setUndo(null); }}>{t('tm_undo')}</button>
        </div>
      )}

      {cp === START && (
        <details className="card"><summary style={{ cursor: 'pointer' }}><b>{t('tm_wave')}</b></summary>
          <WaveStart raceId={raceId} waves={waves} onDone={() => router.refresh()} />
        </details>
      )}

      <div className="card stack" style={{ gap: 8 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3>{t('tm_logTitle')}</h3><b className="num">{done.length}/{teams.length}</b>
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: -6 }}>{cpLabel(cp)}</div>
        {log.length ? (
          <div className="ck-list">
            {log.map(({ x, at }) => {
              const key = `${x.id}|${cp}`, st = startOf(x.id);
              return (
                <div key={x.id} className="ck-row done">
                  <button type="button" className="ck-tap" onClick={() => setEdit(edit === x.id ? null : x.id)} aria-label={`${x.name}: ${t('tm_edit')}`}>
                    <span className="ck-no num">{x.no ?? '–'}</span>
                    <span className="ck-name"><b>{x.name}</b><small className="muted">{x.solo ? 'Solo' : x.group ? `${t('group')} ${x.group}` : ''}</small></span>
                    <span className="ck-time num">{hms(at)}{pendingKeys.has(key) && ' ⏳'}<small>{dayOf(at)}{cp !== START && st ? ` · ${fmtElapsed(Date.parse(at) - Date.parse(st))}` : ''}</small></span>
                  </button>
                  {edit === x.id && <TimeEditor at={at} onSave={(v) => { push({ k: 'set', team: x.id, cp, at: v }); setEdit(null); }}
                    onDelete={() => { if (confirm(t('tm_delConfirm'))) { push({ k: 'del', team: x.id, cp }); setEdit(null); } }} onCancel={() => setEdit(null)} />}
                </div>
              );
            })}
          </div>
        ) : <p className="muted">{t('tm_logEmpty')}</p>}
      </div>

      {todo.length > 0 && done.length > 0 && (
        <details className="card"><summary style={{ cursor: 'pointer' }}><b>{t('tm_missing')} · {todo.length}</b></summary>
          <div className="list" style={{ marginTop: 8 }}>
            {todo.map((x) => <button key={x.id} type="button" className="it" style={{ all: 'unset', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--line)' }}
              onClick={() => { setPick(x); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><span>#{x.no ?? '–'} {x.name}</span><span className="muted">＋</span></button>)}
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
