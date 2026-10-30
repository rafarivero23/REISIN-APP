import Link from 'next/link';
import { notFound } from 'next/navigation';
import { money } from '@/lib/format';
import { getT } from '@/lib/lang';
import { getRace } from '@/lib/repo';
import { getCurrentUser } from '@/lib/auth-guard';
import { hasRaceAccess } from '@/lib/team-session';
import { parsePage } from '@/lib/racepage';
import { checkpointsOf } from '@/lib/timing';
import { RichText } from '@/components/RichText';
import { RaceGate } from '@/components/racepage';
import { Back, loadOpenRace, Closed } from '../../shared';
import { PhotoHero, PhotoGallery } from '@/components/PhotoHero';
import { defaultCover } from '@/lib/photos';
import { sponsorsOf, sponsorMono } from '@/lib/sponsors';
import { SponsorStrip } from '@/components/Sponsors';
import { brandKey, fmtDate } from '@/lib/format';
import { HandFrame } from '@/components/HandFrame';

export default async function RaceChoice({ params }: { params: { raceId: string } }) {
  const { t, lang } = getT();
  const raw = await getRace(params.raceId);
  if (!raw) notFound();
  const res = await loadOpenRace(raw.id);
  if ('closed' in res) return <Closed name={res.closed} />;
  const r = res.race;
  const page = parsePage(raw.page);
  const [cps, sponsors, mono] = await Promise.all([checkpointsOf(raw.id), sponsorsOf(raw.id), sponsorMono(raw.id)]);
  const showBoard = raw.board_public && cps.length > 0;
  const sponsorStrip = <SponsorStrip sponsors={sponsors} mono={mono} title={t('sp_title')} />;
  // Baja Crossing gets the race-manual look (dark, grain, hand-drawn boxes).
  const theme = brandKey(r.brand) === 'baja' ? 'bx' : '';
  const hero = (
    <PhotoHero photo={page.cover || defaultCover(r.brand)} size="lg" top={<Back href="/" />}>
      <span className={'brand-chip ' + brandKey(r.brand)}>{r.brand}</span>
      <h1>{r.name}</h1>
      <p>{fmtDate(r.race_date, lang)}{r.location ? ' · ' + r.location : ''}</p>
    </PhotoHero>
  );
  // Password-protected page: staff always get in (to preview).
  if (raw.access_code && !(await hasRaceAccess(raw.id, raw.access_code)) && !(await getCurrentUser())) {
    return (
      <div className={theme} style={{ display: 'contents' }}>
        {hero}
        <RaceGate raceId={r.id} />
        {sponsorStrip}
      </div>
    );
  }
  const days: { day: string; items: typeof page.agenda }[] = [];
  for (const a of page.agenda) {
    const last = days[days.length - 1];
    if (last && last.day === a.day) last.items.push(a);
    else days.push({ day: a.day, items: [a] });
  }
  return (
    <div className={theme} style={{ display: 'contents' }}>
      {hero}
      {page.intro && <div className="rp-intro"><RichText text={page.intro} /></div>}
      {(page.links.length > 0 || showBoard) && (
        <div className="row rp-links">
          {showBoard && <Link className="btn btn-primary hb rp-live" href={`/r/${raw.slug || r.id}/leaderboard`}><HandFrame seed={9} /><span className="live-dot" aria-hidden style={{ marginRight: 8 }} />{t('lb_title')}</Link>}
          {page.links.map((l, i) => (
            <a key={i} className="btn hb" href={l.url} target={l.url.startsWith('mailto:') ? undefined : '_blank'} rel="noopener noreferrer"><HandFrame seed={i + 20} />{l.label} ↗</a>
          ))}
        </div>
      )}
      <div className="choice">
        <Link href={`/r/${r.id}/buy`} aria-disabled={r.teams_left <= 0} className="hb ch-main"><HandFrame seed={1} />
          <b>{t('p_buy')}</b><span>{r.teams_left > 0 ? t('p_buySub') : t('p_fullRace')}</span>
          <span className="num" style={{ color: 'var(--ink)', fontWeight: 600, marginTop: 6 }}>{money(r.team_price, lang)}</span>
        </Link>
        <Link href={`/r/${r.id}/captain`} className="hb"><HandFrame seed={2} /><b>{t('p_captain')}</b><span>{t('p_captainSub')}</span></Link>
        <Link href={`/r/${r.id}/join`} className="hb"><HandFrame seed={3} /><b>{t('p_join')}</b><span>{t('p_joinSub')}</span></Link>
        <Link href={`/r/${r.id}/agents`} className="hb"><HandFrame seed={4} /><b>{t('fa_title')}</b><span>{t('fa_cardSub')}</span></Link>
        <Link href={`/r/${r.id}/solo`} className="hb"><HandFrame seed={5} /><b>{t('so_card')}</b><span>{raw.solo_price > 0 ? t('so_cardBuy').replace('{p}', money(raw.solo_price, lang)) : t('so_cardSub')}</span></Link>
      </div>
      {(days.length > 0 || page.sections.length > 0) && (
        <div className="rp-grid">
          {days.length > 0 && (
            <section className="card rp-agenda">
              <h2><span className="hb"><HandFrame seed={30} />{t('pg_agenda')}</span></h2>
              {days.map((d, i) => (
                <div key={i} className="rp-day">
                  {d.day && <div className="label">{d.day}</div>}
                  <ul>
                    {d.items.map((a, j) => (
                      <li key={j}>
                        <span className="num rp-time">{a.time}</span>
                        <span><b>{a.title}</b>{a.note && <span className="muted rp-note"><RichText text={a.note} /></span>}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
          {page.sections.map((s, i) => (
            <section key={i} className="card">
              {s.title && <h2><span className="hb"><HandFrame seed={31 + i} />{s.title}</span></h2>}
              <RichText text={s.body} />
            </section>
          ))}
        </div>
      )}
      {page.faq.length > 0 && (
        <section className="rp-faq stack" style={{ gap: 12 }}>
          <h2 style={{ fontSize: 28 }}><span className="hb"><HandFrame seed={45} />{t('pg_faq')}</span></h2>
          <div className="card rp-faq-list">
            {page.faq.map((f, i) => (
              <details key={i}>
                <summary>{f.q}</summary>
                <div className="rp-faq-a"><RichText text={f.a} /></div>
              </details>
            ))}
          </div>
        </section>
      )}
      <PhotoGallery photos={page.photos} title={t('pg_gallery')} />
      {sponsorStrip}
    </div>
  );
}
