import Link from 'next/link';
import { brandKey, fmtDate, money, type Lang } from '@/lib/format';
import type { ARace } from '@/components/admin';

type S = { teams: number; runners: number; revenue: number; fill: number };
export default function RaceCard({ r, s, lang, t }: { r: ARace; s: S; lang: Lang; t: (k: string) => string }) {
  const bk = brandKey(r.brand);
  const chip = r.status === 'open' ? <span className="chip ok">{t('open')}</span> : r.status === 'closed' ? <span className="chip bad">{t('closed')}</span> : <span className="chip">{t('draft')}</span>;
  return (
    <Link href={`/admin/races/${r.id}`} className="race-card" style={{ textDecoration: 'none' }}>
      <div className={'band b-' + bk} />
      <div className="in">
        <div className="row" style={{ justifyContent: 'space-between' }}><span className={'brand-chip ' + bk}>{r.brand}</span>{chip}</div>
        <h3>{r.name}</h3>
        <div className="muted" style={{ fontSize: 14 }}>{fmtDate(r.race_date, lang)}{r.location ? ' · ' + r.location : ''}</div>
        <div className="facts num">
          <div><b>{s.teams}<span className="muted" style={{ fontSize: 16 }}>/{r.capacity_teams}</span></b>{t('teams')}</div>
          <div><b>{s.runners}</b>{t('runners')}</div>
          <div><b>{money(s.revenue, lang)}</b>{t('revenue')}</div>
        </div>
        <div className="meter"><i style={{ width: Math.min(100, Math.round(s.fill * 100)) + '%' }} /></div>
      </div>
    </Link>
  );
}
