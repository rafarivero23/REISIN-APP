'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from './I18n';
import { useToast, useCopy } from './ui';
import { markCodesSent } from '@/app/actions/admin';
import { captainMessage, waLink, mailLink } from '@/lib/capmsg';
import { fmtDT } from '@/lib/format';
import type { ARace, ATeam } from './admin';

// "Capitanes" tab: every team's captain code with one-click Email / WhatsApp
// and a sent/pending checklist so nobody is missed.
export function CaptainsPanel({ race, teams }: { race: ARace; teams: ATeam[] }) {
  const { t, lang } = useT();
  const router = useRouter();
  const toast = useToast();
  const copy = useCopy();
  const [, start] = useTransition();
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const [onlyPending, setOnlyPending] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const sorted = useMemo(() => [...teams].sort((a, b) => a.name.localeCompare(b.name)), [teams]);
  const shown = sorted.filter((x) => (!onlyPending || !x.code_sent_at) && (!q || `${x.name} ${x.captain_name} ${x.captain_email} ${x.claim_code}`.toLowerCase().includes(q.toLowerCase())));
  const sent = teams.filter((x) => x.code_sent_at).length;

  const mark = async (ids: string[], v: boolean, quiet = false) => {
    await markCodesSent(ids, v);
    if (!quiet) toast(t('saved'));
    setSel(new Set());
    start(() => router.refresh());
  };
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOn = shown.length > 0 && shown.every((x) => sel.has(x.id));

  return (
    <div className="stack">
      <div className="card stack" style={{ gap: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div><h3 style={{ textTransform: 'uppercase' }}>{t('cap_title')}</h3><p className="muted" style={{ fontSize: 14, marginTop: 4, maxWidth: '70ch' }}>{t('cap_sub')}</p></div>
          <a className="btn btn-sm" href={`/api/admin/races/${race.id}/captains`}>{t('cap_export')} ↓</a>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <div style={{ flex: 1, minWidth: 160, height: 8, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${teams.length ? (sent / teams.length) * 100 : 0}%`, height: '100%', background: 'var(--ok)' }} />
          </div>
          <b className="num">{sent}/{teams.length}</b><span className="muted">{t('cap_progress')}</span>
        </div>
      </div>
      <div className="toolbar">
        <input className="search" type="search" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('search')} />
        <label className="check" style={{ fontSize: 14 }}><input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} /> {t('cap_onlyPending')}</label>
        {sel.size > 0 && (
          <span className="row" style={{ gap: 6 }}>
            <span className="muted num" style={{ fontSize: 13 }}>{sel.size} {t('cap_selected')}</span>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => mark([...sel], true)}>{t('cap_markSent')}</button>
            <button type="button" className="btn btn-sm" onClick={() => mark([...sel], false)}>{t('cap_markPending')}</button>
          </span>
        )}
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr>
            <th style={{ width: 32 }}><input type="checkbox" aria-label="all" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(shown.map((x) => x.id)))} /></th>
            <th>{t('team')}</th><th>{t('captain')}</th><th>{t('captainCode')}</th><th>{t('status')}</th><th />
          </tr></thead>
          <tbody>
            {shown.map((x) => {
              const wMsg = captainMessage(t, x, race, origin);
              const eMsg = captainMessage(t, x, race, origin, true);
              const mail = mailLink(x.captain_email, eMsg.subject, eMsg.body);
              const wa = waLink(x.captain_phone, wMsg.body);
              return (
                <tr key={x.id}>
                  <td><input type="checkbox" aria-label={x.name} checked={sel.has(x.id)} onChange={() => toggle(x.id)} /></td>
                  <td><b>{x.name}</b></td>
                  <td>{x.captain_name}<div className="muted" style={{ fontSize: 12 }}>{x.captain_email || t('cap_noEmail')}{x.captain_phone ? ' · ' + x.captain_phone : ''}</div></td>
                  <td><span className="code">{x.claim_code}</span></td>
                  <td>{x.code_sent_at
                    ? <button type="button" className="chip ok" style={{ border: 0, cursor: 'pointer' }} title={t('cap_markPending')} onClick={() => mark([x.id], false, true)}>✓ {t('cap_sent')} · {fmtDT(x.code_sent_at, lang)}</button>
                    : <button type="button" className="chip warn" style={{ border: 0, cursor: 'pointer' }} title={t('cap_markSent')} onClick={() => mark([x.id], true, true)}>{t('cap_pending')}</button>}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {mail && <a className="btn btn-sm btn-primary" href={mail} onClick={() => !x.code_sent_at && mark([x.id], true, true)}>{t('email')}</a>}{' '}
                    {wa && <a className="btn btn-sm" href={wa} target="_blank" rel="noreferrer" onClick={() => !x.code_sent_at && mark([x.id], true, true)}>WhatsApp</a>}{' '}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(eMsg.body)}>{t('cap_copyMsg')}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!shown.length && <div className="empty">{t('noTeams')}</div>}
      </div>
    </div>
  );
}
