'use client';
import { useEffect, useState, createContext, useContext, useCallback, type ReactNode, type InputHTMLAttributes } from 'react';
import { useT } from './I18n';
import { money } from '@/lib/format';

type FieldProps = {
  id: string; label: string; type?: string; value: string | number | null | undefined; onChange?: (v: string) => void;
  req?: boolean; hint?: string; full?: boolean; options?: (string | [string, string])[];
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type' | 'id'>;

export function Field({ id, label, type = 'text', value, onChange, req, hint, full, options, ...rest }: FieldProps) {
  const set = (e: { target: { value: string } }) => onChange?.(e.target.value);
  let ctl: ReactNode;
  if (options)
    ctl = (
      <select id={id} value={value ?? ''} onChange={set} required={req}>
        {options.map((o) => {
          const [v, l] = Array.isArray(o) ? o : [o, o];
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    );
  else if (type === 'textarea') ctl = <textarea id={id} value={value ?? ''} onChange={set} required={req} />;
  else ctl = <input id={id} type={type} value={value ?? ''} onChange={set} required={req} {...rest} />;
  return (
    <div className={'field' + (full ? ' full' : '')}>
      <label htmlFor={id}>{label}{req ? ' *' : ''}</label>
      {ctl}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function PayChip({ status }: { status: string }) {
  const { t } = useT();
  return status === 'paid' ? <span className="chip ok">{t('paid')}</span> : <span className="chip warn">{t('pending')}</span>;
}
export function StatusChip({ status }: { status: string }) {
  const { t } = useT();
  if (status === 'open') return <span className="chip ok">{t('open')}</span>;
  if (status === 'closed') return <span className="chip bad">{t('closed')}</span>;
  return <span className="chip">{t('draft')}</span>;
}
export const Bib = ({ n, big }: { n: number | null | undefined; big?: boolean }) => <span className={'bib' + (big ? ' big' : '')}>{n || '—'}</span>;

export function Drawer({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: ReactNode }) {
  const { t } = useT();
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-head">
          <div>{sub && <div className="label">{sub}</div>}<h2>{title}</h2></div>
          <button type="button" className="x" onClick={onClose} aria-label={t('cancel')}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Two-step delete: first click arms, second confirms.
export function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const { t } = useT();
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(id);
  }, [armed]);
  return (
    <button type="button" className={'btn btn-danger btn-sm' + (armed ? ' armed' : '')} onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? t('confirmDel') : t('del')}
    </button>
  );
}

const ToastCtx = createContext<(m: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const toast = useCallback((m: string) => {
    setMsg(m);
    clearTimeout((window as any).__rt);
    (window as any).__rt = setTimeout(() => setMsg(null), 2800);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function useCopy() {
  const toast = useToast();
  const { t } = useT();
  return (text: string) => navigator.clipboard?.writeText(text).then(() => toast(t('copied')), () => toast(text));
}

// Simulated checkout, shown only while STRIPE_SECRET_KEY is not set.
export function TestCheckout({ amount, concept, email, onPay, onClose }: { amount: number; concept: string; email?: string; onPay: () => Promise<void>; onClose: () => void }) {
  const { t, lang } = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    await new Promise((r) => setTimeout(r, 900));
    try {
      await onPay();
    } catch (x: any) {
      setErr(x?.message || 'Error');
      setBusy(false);
    }
  };
  return (
    <div className="scrim center">
      <div className="dialog" role="dialog" aria-modal="true" aria-label={t('p_payTitle')}>
        <div className="co-head">
          <div className="row" style={{ gap: 8 }}><b>{t('p_payTitle')}</b><span className="co-test">{t('p_testMode')}</span></div>
          {!busy && <button type="button" className="x" onClick={onClose} aria-label={t('cancel')}>×</button>}
        </div>
        <div className="co-body">
          <div><div className="label">{concept}</div><div className="co-amt num" style={{ marginTop: 6 }}>{money(amount, lang)}</div></div>
          <form className="stack" style={{ gap: 12 }} onSubmit={submit}>
            <div className="field"><label htmlFor="co-email">{t('email')}</label><input id="co-email" type="email" defaultValue={email} /></div>
            <div className="field">
              <label htmlFor="co-num">{t('p_card')}</label>
              <div className="co-card">
                <input id="co-num" defaultValue="4242 4242 4242 4242" inputMode="numeric" aria-label={t('p_card')} />
                <input defaultValue="12 / 29" aria-label="MM / YY" />
                <input defaultValue="123" aria-label="CVC" />
              </div>
            </div>
            {err && <p className="err">{err}</p>}
            <button className="btn btn-primary btn-lg" type="submit" disabled={busy} style={{ width: '100%' }}>
              {busy ? <><span className="spin" /> {t('p_processing')}</> : `${t('p_pay')} ${money(amount, lang)}`}
            </button>
            <p className="muted" style={{ fontSize: 12, textAlign: 'center' }}>{t('p_testNote')}</p>
          </form>
        </div>
      </div>
    </div>
  );
}
