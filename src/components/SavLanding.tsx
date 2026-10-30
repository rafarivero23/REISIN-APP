import Link from 'next/link';
import type { ReactNode } from 'react';
import { videoEmbed, type PageData } from '@/lib/racepage';
import type { Sponsor } from '@/lib/sponsors';
import { getPhoto, photoSrc } from '@/lib/photos';
import { money, fmtDate } from '@/lib/format';
import { RichText } from './RichText';
import { SponsorStrip } from './Sponsors';
import { ReisinGlitch } from './ReisinGlitch';
import { SAV_ELEV } from '@/lib/savRoute';
import { SavGallery } from './SavGallery';

// Sal a Valle look (SAV27 brand kit): black, thin lines, mono labels,
// one red accent, brand elements from the SAV .ai files in /public/brand/sav.
type R = { id: string; slug: string | null; name: string; race_date: string | null; location: string | null; team_price: number; solo_price: number; teams_left: number };
type T = (k: string) => string;

// One landing, two brand kits: SAV (black, thin lines, red) and Baja Crossing
// (race-manual look: charcoal + grain, BajaCrossing titles, yellow/orange/pink).
export type Kit = {
  key: 'sav' | 'bx'; base: string; logo: string; ed: string; hud: string; tagline: string; tick: string;
  hero: { src: string; cls: string }[]; acc?: string; icons: string[]; galFrame?: string; foot: string;
  elev?: [number, number][]; map?: string; ctaTeam: string; ctaSolo: string;
};
export const SAV_KIT: Kit = {
  key: 'sav', base: '/brand/sav', logo: 'logo-27.svg', ed: 'SAV', hud: 'Field signal', tagline: 'Not your average race', tick: '✚',
  hero: [{ src: 'pyramid.png', cls: 'sv-pyr' }, { src: 'rings.png', cls: 'sv-rings' }, { src: 'plus-red.png', cls: 'sv-plus' }],
  acc: 'braille-red.png', icons: ['head.png', 'plus-red.png'], galFrame: 'frames.png', foot: 'rings.png',
  elev: SAV_ELEV, map: 'route-map.png', ctaTeam: 'Join mission', ctaSolo: 'Solo race',
};
export const BX_KIT: Kit = {
  key: 'bx', base: '/brand/bx', logo: 'logo.png', ed: 'BX', hud: 'Desert signal', tagline: 'Cruce peligroso', tick: '✱',
  hero: [{ src: 'patch.png', cls: 'sv-rings' }, { src: 'cactus.png', cls: 'sv-plus' }],
  acc: 'roadrunner.png', icons: ['meta.png', 'km-muerto.png', 'last-taco.png', 'oasis.png', 'rest.png', 'cruce.png'], galFrame: 'bc.png', foot: 'bolts2.png',
  ctaTeam: 'Join the crew', ctaSolo: 'Solo race',
};
const pad = (n: number) => String(n).padStart(2, '0');
const r10 = (n: number) => Math.round(n / 10) * 10;
const yy = (d: string | null) => (d ? String(new Date(d).getUTCFullYear()).slice(2) : '');

// Elevation profile: 1000 x 140 viewBox, km ticks every 20.
function ElevProfile({ t, data }: { t: T; data: [number, number][] }) {
  const W = 1000, H = 140, top = 14;
  const ms = data.map((p) => p[1]);
  const lo = Math.floor((Math.min(...ms) - 100) / 500) * 500, hi = Math.ceil((Math.max(...ms) + 80) / 500) * 500;
  const km = data[data.length - 1][0];
  const X = (k: number) => (k / km) * W, Y = (m: number) => top + (1 - (m - lo) / (hi - lo)) * (H - top);
  const line = data.map(([k, m], i) => `${i ? 'L' : 'M'}${X(k).toFixed(1)},${Y(m).toFixed(1)}`).join('');
  const peak = data.reduce((a, b) => (b[1] > a[1] ? b : a));
  const grid = [lo + 500, lo + 1000].filter((m) => m < hi);
  const ticks = Array.from({ length: Math.floor(km / 20) + 1 }, (_, i) => i * 20);
  return (
    <div className="sv-elev">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-label={t('sv_elev')}>
        {grid.map((m) => <line key={m} x1="0" x2={W} y1={Y(m)} y2={Y(m)} className="g" />)}
        <path d={`${line}L${W},${H}L0,${H}Z`} className="a" />
        <path d={line} className="l" vectorEffect="non-scaling-stroke" />
        <line x1={X(peak[0])} x2={X(peak[0])} y1={Y(peak[1])} y2={H} className="p" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="mono sv-elev-pk" style={{ left: `${(peak[0] / km) * 100}%` }}>{r10(peak[1]).toLocaleString('en-US')} m</span>
      {grid.map((m) => <span key={m} className="mono sv-elev-y" style={{ top: `${(Y(m) / H) * 100}%` }}>{m.toLocaleString('en-US')}</span>)}
      <div className="sv-elev-x mono">{ticks.map((k, i) => <span key={k} style={{ left: `${(k / km) * 100}%` }}>{k}{i === ticks.length - 1 ? ' km' : ''}</span>)}</div>
    </div>
  );
}

export function SavHero({ race, page, lang, kit = SAV_KIT }: { race: R; page: PageData; lang: 'es' | 'en'; kit?: Kit }) {
  const cover = getPhoto(page.cover);
  const B = kit.base, ed = kit.ed + yy(race.race_date);
  return (
    <section className="sv-hero sv-bleed">
      <div className="sv-intro-r" aria-hidden><ReisinGlitch /><span className="mono">Reisin presenta</span></div>
      {cover && <img className="sv-hero-bg" src={photoSrc(cover.id)} alt="" style={{ objectPosition: cover.pos }} />}
      {videoEmbed(page.video) && <iframe className="sv-hero-vid" src={videoEmbed(page.video)!} title="" aria-hidden tabIndex={-1} allow="autoplay; fullscreen; picture-in-picture" loading="eager" />}
      <div className="sv-grid" aria-hidden />
      {kit.hero.map((h) => <img key={h.src} className={'sv-el ' + h.cls} src={`${B}/${h.src}`} alt="" aria-hidden />)}
      <h1 className="sv-logo"><img src={`${B}/${kit.logo}`} alt={race.name} /></h1>
      <div className="sv-c sv-tl mono">{lang === 'en' ? 'Edition' : 'Edición'}<b>{ed}</b></div>
      <div className="sv-c sv-tr mono">{lang === 'en' ? 'Date' : 'Fecha'}<b>{fmtDate(race.race_date, lang)}</b></div>
      {race.location && <div className="sv-c sv-bl mono">{lang === 'en' ? 'Route' : 'Ruta'}<b>{race.location}</b></div>}
      <div className="sv-hud mono"><i />{kit.hud} · {ed}</div>
      <div className="sv-org mono">A race by <ReisinGlitch /></div>
    </section>
  );
}

export function SavLanding({ race, page, t, lang, showBoard, sponsors, mono, kit = SAV_KIT }: {
  race: R; page: PageData; t: T; lang: 'es' | 'en'; showBoard: boolean; sponsors: Sponsor[]; mono: boolean; kit?: Kit;
}) {
  const B = kit.base;
  const elev = kit.elev && { max: r10(Math.max(...kit.elev.map((p) => p[1]))), min: r10(Math.min(...kit.elev.map((p) => p[1]))) };
  let ic = 0;
  const icon = () => kit.icons[ic++ % kit.icons.length];
  const strava = page.links.find((l) => /strava/i.test(l.url));
  const routeSec = page.sections.find((s) => /ruta|route/i.test(s.title));
  const otherSecs = page.sections.filter((s) => s !== routeSec);
  const photos = page.photos.map(getPhoto).filter((p): p is NonNullable<typeof p> => !!p);
  const thumb = (i: number) => (photos.length ? photoSrc(photos[i % photos.length].id, true) : null);
  const ticker = [kit.tagline, ...page.stats.map((s) => `${s.value} ${s.unit}`.trim()), race.location, fmtDate(race.race_date, lang), t('sv_by')].filter(Boolean) as string[];
  const full = race.teams_left <= 0;
  const rows: { k: string; title: string; sub: string; href: string; price?: string; hot?: boolean; off?: boolean; img: string | null }[] = [
    { k: 'A / ' + t('team'), title: t('p_buy'), sub: full ? t('p_fullRace') : t('p_buySub'), href: `/r/${race.id}/buy`, price: full ? t('sv_sold') : money(race.team_price, lang), hot: !full, off: full, img: thumb(0) },
    ...(race.solo_price > 0 ? [{ k: 'B / Solo', title: 'Solo runner', sub: t('so_cardBuy').replace('{p}', money(race.solo_price, lang)), href: `/r/${race.id}/solo`, price: money(race.solo_price, lang), img: thumb(1) }] : []),
    { k: 'C / ' + t('captain'), title: t('p_captain'), sub: t('p_captainSub'), href: `/r/${race.id}/captain`, img: thumb(2) },
    { k: 'D / ' + t('runner_s'), title: t('p_join'), sub: t('p_joinSub'), href: `/r/${race.id}/join`, img: thumb(3) },
    { k: 'E / Agente libre', title: t('fa_title'), sub: t('fa_cardSub'), href: `/r/${race.id}/agents`, img: thumb(4) },
    ...(race.solo_price > 0 ? [] : [{ k: 'B / Solo', title: t('so_card'), sub: t('so_cardSub'), href: `/r/${race.id}/solo`, img: thumb(1) }]),
  ];
  const days: { day: string; items: PageData['agenda'] }[] = [];
  for (const a of page.agenda) {
    const last = days[days.length - 1];
    if (last && last.day === a.day) last.items.push(a); else days.push({ day: a.day, items: [a] });
  }
  const flat = page.agenda;
  const Head = ({ title, aside, icon }: { title: string; aside?: ReactNode; icon?: string }) => (
    <div className="sv-sh"><h2>{title}{icon && <img src={`${B}/${icon}`} alt="" aria-hidden />}</h2>{aside && <span className="mono">{aside}</span>}</div>
  );

  return (
    <>
      <div className="sv-ticker sv-bleed mono" aria-hidden><div>{[...ticker, ...ticker].map((x, i) => <span key={i}>{kit.tick} {x}</span>)}</div></div>

      <section className="sv-data sv-bleed">
        {page.stats.map((s, i) => (
          <div key={i}><span className="mono">{pad(i + 1)} / {s.label}</span><b>{s.value}<small>{s.unit}</small></b></div>
        ))}
        {!full && (
          <Link href={`/r/${race.id}/buy`} className="sv-acc">
            {kit.acc && <img className="sv-el" src={`${B}/${kit.acc}`} alt="" aria-hidden />}
            <span className="mono">{t('sv_signup')}</span>
            <b className="sv-acc-t">{t('sv_avail')}</b>
            <span className="sv-cta">{kit.ctaTeam} →</span>
          </Link>
        )}
        {race.solo_price > 0 && (
          <Link href={`/r/${race.id}/solo`} className="sv-acc">
            <span className="mono">Solo runner</span>
            <b className="sv-acc-t">{t('sv_soloAvail')}</b>
            <span className="sv-cta">{kit.ctaSolo} →</span>
          </Link>
        )}
      </section>

      {page.intro && <div className="sv-intro sv-bleed"><RichText text={page.intro} /></div>}

      {(showBoard || page.links.length > 0) && (
        <div className="sv-links sv-bleed">
          {showBoard && <Link href={`/r/${race.slug || race.id}/leaderboard`} className="mono sv-live"><i />{t('lb_title')}</Link>}
          {page.links.map((l, i) => <a key={i} className="mono" href={l.url} target={l.url.startsWith('mailto:') ? undefined : '_blank'} rel="noopener noreferrer">{l.label} ↗</a>)}
        </div>
      )}

      <Head title={t('sv_signup')} aside={t('sv_pick')} icon={icon()} />
      <section className="sv-acts sv-bleed">
        {rows.map((x) => (
          <Link key={x.href + x.k} href={x.href} className={'sv-row' + (x.hot ? ' hot' : '')} aria-disabled={x.off || undefined}>
            <span className="mono">{x.k}</span>
            <h3>{x.title}</h3>
            <p>{x.sub}</p>
            {x.price ? <span className="sv-price">{x.price}</span> : x.img ? <span className="sv-thumb" style={{ backgroundImage: `url(${x.img})` }} /> : <span />}
            <span className="sv-go" aria-hidden>→</span>
          </Link>
        ))}
      </section>

      {flat.length > 0 && (
        <>
          <Head title={t('pg_agenda')} aside={days.map((d) => d.day).join(' · ')} icon={kit.key === 'bx' ? icon() : undefined} />
          <section className="sv-tl sv-bleed">
            <ol>
              {flat.map((a, i) => {
                const firstOfDay = i === 0 || flat[i - 1].day !== a.day;
                return (
                  <li key={i} className={i === flat.length - 1 ? 'end' : ''}>
                    <span className="mono sv-day">{firstOfDay ? a.day : ' '}</span>
                    <span className="sv-dot" aria-hidden />
                    <span className="mono">{a.time}</span>
                    <b>{a.title}</b>
                    {a.note && <p><RichText text={a.note} /></p>}
                  </li>
                );
              })}
            </ol>
          </section>
        </>
      )}

      {(routeSec || strava) && (
        <section className="sv-route sv-bleed">
          <div className="sv-route-head">
            <div>
              <span className="mono">{t('sv_route')}{race.location ? ` / ${race.location}` : ''}</span>
              {routeSec && <div className="sv-route-txt"><RichText text={routeSec.body} /></div>}
              {strava && <a className="mono sv-ul" href={strava.url} target="_blank" rel="noopener noreferrer">{t('sv_strava')} ↗</a>}
            </div>
            <dl className="sv-route-stats">
              {page.stats[0] && <div><dt className="mono">{page.stats[0].label}</dt><dd>{page.stats[0].value}<small>{page.stats[0].unit}</small></dd></div>}
              {elev && <div><dt className="mono">{t('sv_elevMax')}</dt><dd>{elev.max.toLocaleString('en-US')}<small>m</small></dd></div>}
              {elev && <div><dt className="mono">{t('sv_elevMin')}</dt><dd>{elev.min.toLocaleString('en-US')}<small>m</small></dd></div>}
            </dl>
          </div>
          {(kit.map || kit.elev) && (
            <figure className="sv-route-map">
              {kit.map && <img src={`${B}/${kit.map}`} alt={race.location || t('sv_route')} loading="lazy" />}
              {kit.elev && <ElevProfile t={t} data={kit.elev} />}
            </figure>
          )}
        </section>
      )}

      {photos.length > 0 && (
        <>
          <Head title={t('sv_photos')} aside={`${photos.length}`} icon={kit.key === 'bx' ? icon() : undefined} />
          <SavGallery photos={photos.map((p) => ({ id: p.id, full: photoSrc(p.id), thumb: photoSrc(p.id, true) }))} frames={kit.galFrame && `${B}/${kit.galFrame}`} moreLabel={t('sv_galMore')} lessLabel={t('sv_galLess')} />
        </>
      )}

      {otherSecs.map((s, i) => (
        <div key={i}>
          <Head title={s.title} aside={pad(i + 1)} icon={kit.key === 'bx' ? icon() : i === 0 ? 'plus-red.png' : undefined} />
          <section className="sv-sec sv-bleed"><RichText text={s.body} /></section>
        </div>
      ))}

      {page.faq.length > 0 && (
        <>
          <Head title="FAQ" aside={`${page.faq.length}`} icon={kit.key === 'bx' ? icon() : undefined} />
          <section className="sv-faq sv-bleed">
            {page.faq.map((f, i) => (
              <details key={i}>
                <summary><span className="mono">{pad(i + 1)}</span><span>{f.q}</span><i aria-hidden>+</i></summary>
                <div className="sv-faq-a"><RichText text={f.a} /></div>
              </details>
            ))}
          </section>
        </>
      )}

      <SponsorStrip sponsors={sponsors} mono={mono} title={t('sp_title')} />

      <footer className="sv-foot sv-bleed">
        <img className="sv-el sv-foot-rings" src={`${B}/${kit.foot}`} alt="" aria-hidden />
        <img className="sv-foot-logo" src={`${B}/${kit.logo}`} alt={race.name} />
        <div className="sv-foot-by"><ReisinGlitch /><span className="mono">{t('sv_by')}</span></div>
      </footer>
    </>
  );
}
