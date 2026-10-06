import Link from 'next/link';
import { money } from '@/lib/format';
import { getT } from '@/lib/lang';
import { RaceHeader, Back, loadOpenRace, Closed } from '../../shared';

export default async function RaceChoice({ params }: { params: { raceId: string } }) {
  const { t, lang } = getT();
  const res = await loadOpenRace(params.raceId);
  if ('closed' in res) return <Closed name={res.closed} />;
  const r = res.race;
  return (
    <>
      <Back href="/" />
      <RaceHeader race={r} lang={lang} />
      <div className="choice">
        <Link href={`/r/${r.id}/buy`} aria-disabled={r.teams_left <= 0}>
          <b>{t('p_buy')}</b><span>{r.teams_left > 0 ? t('p_buySub') : t('p_fullRace')}</span>
          <span className="num" style={{ color: 'var(--ink)', fontWeight: 600, marginTop: 6 }}>{money(r.team_price, lang)}</span>
        </Link>
        <Link href={`/r/${r.id}/captain`}><b>{t('p_captain')}</b><span>{t('p_captainSub')}</span></Link>
        <Link href={`/r/${r.id}/join`}><b>{t('p_join')}</b><span>{t('p_joinSub')}</span></Link>
        <Link href={`/r/${r.id}/agents`}><b>{t('fa_title')}</b><span>{t('fa_cardSub')}</span></Link>
      </div>
    </>
  );
}
