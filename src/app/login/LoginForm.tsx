'use client';
import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { login } from '@/app/actions/admin';
import { useT, LangToggle } from '@/components/I18n';

function Submit() {
  const { t } = useT();
  const { pending } = useFormStatus();
  return <button className="btn btn-primary btn-lg" type="submit" disabled={pending}>{pending ? <span className="spin" /> : t('signIn')}</button>;
}

export default function LoginForm({ next }: { next: string }) {
  const { t } = useT();
  const [state, action] = useFormState(login, {});
  return (
    <div className="login">
      <form className="card stack" action={action}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="brand"><img src="/reisin-mark-white.png" alt="Reisin" className="brand-logo" /><div><div className="brand-name">Reisin</div><div className="brand-sub">{t('admin')}</div></div></div>
        </div>
        <div><h2>{t('login')}</h2><p className="muted" style={{ fontSize: 14, marginTop: 6 }}>{t('loginSubN')}</p></div>
        <input type="hidden" name="next" value={next} />
        <div className="field"><label htmlFor="l-email">{t('email')}</label><input id="l-email" name="email" type="email" required autoComplete="username" /></div>
        <div className="field"><label htmlFor="l-pass">{t('password')}</label><input id="l-pass" name="password" type="password" required autoComplete="current-password" /></div>
        {state?.error && <p className="err">{t(state.error)}</p>}
        <Submit />
        <Link href="/" className="btn btn-ghost">{t('openPortal')} ↗</Link>
      </form>
    </div>
  );
}
