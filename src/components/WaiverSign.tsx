'use client';
import { useState } from 'react';
import { useT } from './I18n';
import { acceptWaiverByToken } from '@/app/actions/portal';

export function WaiverSign({ token, intro, text }: { token: string; intro: string; text: string }) {
  const { t } = useT();
  const [ok, setOk] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (done) return <p className="chip ok" style={{ alignSelf: 'flex-start', fontSize: 15 }}>✓ {t('wv_done')}</p>;
  return (
    <div className="stack" style={{ gap: 12 }}>
      <p>{intro}</p>
      <div className="note" style={{ whiteSpace: 'pre-wrap', maxHeight: 320, overflow: 'auto', color: 'var(--ink)', fontSize: 14 }}>{text}</div>
      <label className="check"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> <span>{t('p_waiverAccept')}</span></label>
      {err && <p className="err">{t(err)}</p>}
      <div><button type="button" className="btn btn-primary btn-lg" disabled={!ok || busy}
        onClick={async () => { setBusy(true); const r = await acceptWaiverByToken(token); setBusy(false); if ('error' in r) setErr(r.error); else setDone(true); }}>
        {busy ? <span className="spin" /> : t('wv_accept')}</button></div>
    </div>
  );
}
