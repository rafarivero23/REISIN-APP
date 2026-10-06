import Link from 'next/link';
import { listOpenRaces } from '@/lib/repo';
import { brandKey, fmtDate } from '@/lib/format';
import { getT } from '@/lib/lang';
import { PhotoHero } from '@/components/PhotoHero';
import { parsePage } from '@/lib/racepage';
import { defaultCover, getPhoto, photoSrc, HOME_COVER } from '@/lib/photos';

export default async function PortalHome() {
  const { t, lang } = getT();
  const races = await listOpenRaces();
  return (
    <>
      <PhotoHero photo={HOME_COVER} size="lg">
        <div className="label">{t('p_pick')}</div>
        <h1>{t('p_title')}</h1>
        <p>{t('p_sub')}</p>
      </PhotoHero>
      {races.length ? (
        <div className="race-grid">
          {races.map((r) => {
            const bk = brandKey(r.brand);
            const cover = getPhoto(parsePage(r.page).cover || defaultCover(r.brand));
            return (
              <Link key={r.id} href={`/r/${r.id}`} className="race-card" style={{ textDecoration: 'none' }}>
                {cover ? <div className="cover"><img src={photoSrc(cover.id, true)} alt="" style={{ objectPosition: cover.pos }} loading="lazy" /></div> : <div className={'band b-' + bk} />}
                <div className="in">
                  <span className={'brand-chip ' + bk}>{r.brand}</span>
                  <h3>{r.name}</h3>
                  <div className="muted" style={{ fontSize: 14 }}>{fmtDate(r.race_date, lang)}{r.location ? ' · ' + r.location : ''}</div>
                  <div className="row">{r.teams_left > 0 ? <span className="chip ok num">{r.teams_left} {t('slotsLeft')}</span> : <span className="chip bad">{t('raceFull')}</span>}</div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : <div className="card empty">{t('p_noRaces')}</div>}
    </>
  );
}
