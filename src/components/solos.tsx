'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from './I18n';
import { Field, Drawer, Bib, useToast, useCopy } from './ui';
import { addSolo, importSolosRows, markCodesSent, removeTeam, saveTeamNotes } from '@/app/actions/admin';
import { waLink, mailLink } from '@/lib/capmsg';
import { money, fmtDT } from '@/lib/format';
import type { ARace, ATeam, ARunner } from './admin';

function soloMessage(t: (k: string) => string, s: ATeam, race: ARace, origin: string, forEmail = false) {
  const url = `${origin}/${race.slug || 'r/' + race.id}`;
  let body = t('so_msg').replace('{name}', s.captain_name.split(/\s+/)[0] || '').replace('{race}', race.name).replace('{url}', url)
    .replace('{pass}', race.access_code ? `\n${t('capMsgPass')}: ${race.access_code}` : '').replace('{code}', s.claim_code);
  if (forEmail) body += '\n\n' + t('capMsgSign');
  return { subject: `${race.name} · Solo · ${t('so_code')}: ${s.claim_code}`, body };
}

export function SolosPanel({ race, solos, runners, openRunner, NoteCell }: {
  race: ARace; solos: ATeam[]; runners: ARunner[]; openRunner: (id: string) => void;
  NoteCell: (p: { value: string | null; onSave: (v: string) => Promise<unknown> }) => JSX.Element;
}) {
  const { t, lang } = useT();
  const router = useRouter();
  const toast = useToast();
  const copy = useCopy();
  const [, start] = useTransition();
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const runnerOf = (id: string) => runners.find((r) => r.team_id === id);
  const shown = [...solos].sort((a, b) => a.name.localeCompare(b.name))
    .filter((s) => !q || `${s.name} ${s.captain_email} ${s.claim_code}`.toLowerCase().includes(q.toLowerCase()));
  const reg = solos.filter((s) => runnerOf(s.id)).length;
  const sent = solos.filter((s) => s.code_sent_at).length;
  const refresh = () => start(() => router.refresh());
  const mark = async (id: string, v: boolean) => { await markCodesSent([id], v); refresh(); };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true); setLog(null);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' })
        .map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [String(k).trim(), String(v ?? '').trim()])));
      const r = await importSolosRows(race.id, rows);
      if ('error' in r && r.error) { setLog(t(r.error)); return; }
      const ok = r as Exclude<typeof r, { error: string }>;
      const cols = Object.entries(ok.columns).filter(([, v]) => v).map(([k, v]) => `${k}→${v}`).join(', ');
      setLog(`${f.name}: ${ok.teamsCreated} Solos · ${ok.runnersCreated} ${t('so_registeredN')} · ${ok.skipped} ${t('alreadyImported')}\n${cols}${ok.warnings.length ? '\n' + ok.warnings.join('\n') : ''}`);
      refresh();
    } catch (err: any) {
      setLog(String(err?.message || err));
    } finally { setBusy(false); }
  };

  return (
    <div className="stack">
      <div className="kpis">
        <div className="kpi"><div className="label">{t('so_tab')}</div><div className="v num">{solos.length}</div><div className="s">{money(solos.reduce((a, s) => a + (s.amount || 0), 0), lang)}</div></div>
        <div className="kpi"><div className="label">{t('so_registered')}</div><div className="v num">{reg}/{solos.length}</div></div>
        <div className="kpi"><div className="label">{t('cap_sent')}</div><div className="v num">{sent}/{solos.length}</div></div>
      </div>
      <div className="card stack" style={{ gap: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div><h3>{t('so_titleAdmin')}</h3><p className="muted" style={{ fontSize: 14, marginTop: 4, maxWidth: '70ch' }}>{t('so_sub')}</p></div>
          <div className="row">
            <input ref={file} type="file" accept=".xlsx,.xls,.csv" hidden onChange={onFile} />
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => file.current?.click()}>{busy ? <span className="spin" /> : '↑'} {t('so_import')}</button>
            <button type="button" className="btn btn-sm" onClick={() => setAdding(true)}>+ {t('so_add')}</button>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>{t('so_importHint')}</p>
        {log && <pre className="note" style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0, color: 'var(--ink)' }}>{log}</pre>}
      </div>
      <div className="toolbar"><input className="search" type="search" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('search')} /></div>
      <div className="tbl-wrap">
        {shown.length ? (
          <table>
            <thead><tr><th>{t('bib')}</th><th>{t('name')}</th><th>{t('so_code')}</th><th>{t('status')}</th><th>{t('cap_sent')}</th><th>{t('notes')}</th><th /></tr></thead>
            <tbody>
              {shown.map((s) => {
                const r = runnerOf(s.id);
                const w = soloMessage(t, s, race, origin), e = soloMessage(t, s, race, origin, true);
                const mail = mailLink(s.captain_email, e.subject, e.body), wa = waLink(s.captain_phone, w.body);
                return (
                  <tr key={s.id} className={r ? 'click' : undefined} onClick={r ? () => openRunner(r.id) : undefined}>
                    <td><Bib n={r?.bib} /></td>
                    <td><b>{s.name}</b><div className="muted" style={{ fontSize: 12 }}>{s.captain_email}{s.captain_phone ? ' · ' + s.captain_phone : ''}</div></td>
                    <td><span className="code">{s.claim_code}</span></td>
                    <td>{r ? <>{<span className="chip ok">{t('so_registered')}</span>} {!r.waiver_accepted_at && <span className="chip warn">{t('reg_waiverMissing')}</span>}</> : <span className="chip warn">{t('so_pending')}</span>}</td>
                    <td onClick={(ev) => ev.stopPropagation()}>{s.code_sent_at
                      ? <button type="button" className="chip ok" style={{ border: 0, cursor: 'pointer' }} onClick={() => mark(s.id, false)}>✓ {fmtDT(s.code_sent_at, lang)}</button>
                      : <button type="button" className="chip warn" style={{ border: 0, cursor: 'pointer' }} onClick={() => mark(s.id, true)}>{t('cap_pending')}</button>}</td>
                    <td onClick={(ev) => ev.stopPropagation()}><NoteCell value={s.notes} onSave={async (v) => { await saveTeamNotes(s.id, v); refresh(); }} /></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(ev) => ev.stopPropagation()}>
                      {mail && <a className="btn btn-sm btn-primary" href={mail} onClick={() => !s.code_sent_at && mark(s.id, true)}>{t('email')}</a>}{' '}
                      {wa && <a className="btn btn-sm" href={wa} target="_blank" rel="noreferrer" onClick={() => !s.code_sent_at && mark(s.id, true)}>WhatsApp</a>}{' '}
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(e.body)}>{t('copy')}</button>{' '}
                      <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--bad)' }} aria-label={t('del')}
                        onClick={async () => { if (confirm(`${t('del')} ${s.name}?`)) { await removeTeam(s.id); toast(t('deleted')); refresh(); } }}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <div className="empty">{t('so_none')}</div>}
      </div>
      {adding && <AddSolo raceId={race.id} fee={race.runner_fee} onClose={() => setAdding(false)} onDone={() => { setAdding(false); refresh(); }} />}
    </div>
  );
}

function AddSolo({ raceId, fee, onClose, onDone }: { raceId: string; fee: number; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const [f, setF] = useState({ name: '', email: '', phone: '', amount: String(fee || '') });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await addSolo(raceId, f);
    if (r.error) return setErr(r.error);
    toast(t('saved')); onDone();
  };
  return (
    <Drawer title={t('so_add')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field id="so-name" label={t('name')} value={f.name} onChange={set('name')} req full />
        <Field id="so-email" label={t('email')} type="email" value={f.email} onChange={set('email')} req />
        <Field id="so-phone" label={t('phone')} type="tel" value={f.phone} onChange={set('phone')} />
        <Field id="so-amount" label={t('so_amount')} type="number" value={f.amount} onChange={set('amount')} />
        {err && <p className="err full">{t(err)}</p>}
        <div className="full row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={onClose}>{t('cancel')}</button><button className="btn btn-primary" type="submit">{t('save')}</button></div>
      </form>
    </Drawer>
  );
}
