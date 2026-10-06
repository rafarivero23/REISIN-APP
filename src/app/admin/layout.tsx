import Link from 'next/link';
import { requireUser } from '@/lib/auth-guard';
import { listRaces } from '@/lib/repo';
import { getT } from '@/lib/lang';
import { LangToggle } from '@/components/I18n';
import { AdminNav } from '@/components/admin';
import { logout } from '@/app/actions/admin';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { t } = getT();
  const open = (await listRaces()).filter((r) => r.status === 'open').slice(0, 8).map((r) => ({ id: r.id, name: r.name }));
  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand"><img src="/reisin-mark-white.png" alt="Reisin" className="brand-logo" /><div><div className="brand-name">Reisin</div><div className="brand-sub">{t('admin')}</div></div></div>
        <AdminNav races={open} />
        <div className="rail-foot">
          <LangToggle />
          <a href="/" target="_blank" rel="noreferrer" className="rail-btn">{t('viewPortal')} ↗</a>
          <div style={{ opacity: 0.6, fontSize: 12, overflowWrap: 'anywhere' }}>{user.email}</div>
          <form action={logout}><button type="submit" style={{ width: '100%', boxSizing: 'border-box' }}>{t('signOut')}</button></form>
        </div>
      </aside>
      <div style={{ minWidth: 0 }}>
        <div className="mobile-bar">
          <div className="brand">
            <Link href="/admin" style={{ display: 'flex' }}><img src="/reisin-mark-white.png" alt="Reisin" className="brand-logo sm" /></Link>
            <AdminNav races={[]} mobile />
          </div>
          <LangToggle />
        </div>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
