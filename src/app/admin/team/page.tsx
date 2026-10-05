import { requireUser } from '@/lib/auth-guard';
import { listUsers } from '@/lib/repo';
import { getT } from '@/lib/lang';
import { Staff } from '@/components/admin';

export default async function TeamPage() {
  const me = await requireUser();
  const { t } = getT();
  const users = (await listUsers()).map((u) => ({ id: u.id, name: u.name, email: u.email, created_at: u.created_at }));
  return (
    <>
      <div className="top"><div><h1>{t('staff')}</h1><p className="muted" style={{ marginTop: 8 }}>{t('staffSub')}</p></div></div>
      <Staff users={users} meId={me.userId} />
    </>
  );
}
