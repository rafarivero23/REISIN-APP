'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { LangToggle, useT } from './I18n';

export type HomeRace = {
  id: string; name: string; brand: string; when: string; race: string; shop: string | null; closed: boolean;
  imgs: { src: string; pos: string }[]; shopImgs: { src: string; pos: string }[];
};

// Full-screen Reisin landing: race photos cross-dissolve in the background; hovering a
// race button brings up that race's photo. Two entries: RACE and SHOP.
export function HomeLanding({ races }: { races: HomeRace[] }) {
  const { lang } = useT();
  const tx = (es: string, en: string) => (lang === 'en' ? en : es);
  const slides = useMemo(() => races.flatMap((r) => r.imgs.map((im) => ({ ...im, id: r.id, key: 'r' + im.src }))), [races]);
  const shopSlides = useMemo(() => races.filter((r) => r.shop).flatMap((r) => r.shopImgs.map((im) => ({ ...im, id: r.id, key: 's' + im.src }))), [races]);
  const all = useMemo(() => { const m = new Map<string, (typeof slides)[number]>(); for (const s of [...slides, ...shopSlides]) m.set(s.key, s); return [...m.values()]; }, [slides, shopSlides]);
  const [i, setI] = useState(0);
  const [hover, setHover] = useState<string | null>(null); // slide key forced by hover
  useEffect(() => {
    if (slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setI((x) => (x + 1) % slides.length), 6000);
    return () => clearInterval(id);
  }, [slides.length]);
  const on = hover || slides[i]?.key;
  const current = all.find((s) => s.key === on);
  const raceOf = (id?: string) => races.find((r) => r.id === id);
  const shops = races.filter((r) => r.shop);
  const first = (k: 'r' | 's', r: HomeRace) => (k === 'r' ? r.imgs[0] : r.shopImgs[0]) && ('' + k + (k === 'r' ? r.imgs[0].src : r.shopImgs[0].src));

  return (
    <section className="hl">
      <div className="hl-bg" aria-hidden>
        {all.map((s) => <img key={s.key} src={s.src} alt="" className={s.key === on ? 'on' : ''} style={{ objectPosition: s.pos }} loading={s.key === slides[0]?.key ? 'eager' : 'lazy'} />)}
        <div className="hl-shade" />
      </div>

      <header className="hl-top">
        <span />
        <img className="hl-logo" src="/reisin-wordmark-white.png" alt="Reisin" />
        <div className="hl-lang"><LangToggle /></div>
      </header>

      <div className="hl-main">
        <div className="hl-col">
          <Link href={races[0]?.race || '#'} className="hl-big" onMouseEnter={() => races[0] && setHover(first('r', races[0]) || null)} onMouseLeave={() => setHover(null)}>RACE<span aria-hidden>→</span></Link>
          <ul className="hl-list">
            {races.map((r) => (
              <li key={r.id}>
                <Link href={r.race} className="hl-btn" onMouseEnter={() => setHover(first('r', r) || null)} onFocus={() => setHover(first('r', r) || null)} onMouseLeave={() => setHover(null)} onBlur={() => setHover(null)}>
                  <b>{r.name}</b><small>{r.when}{r.closed ? ` · ${tx('Resultados', 'Results')}` : ''}</small><span aria-hidden>→</span>
                </Link>
              </li>
            ))}
            {!races.length && <li className="hl-none">{tx('Próximamente', 'Coming soon')}</li>}
          </ul>
        </div>

        <div className="hl-col">
          <Link href={shops[0]?.shop || '#'} className={'hl-big' + (shops.length ? '' : ' off')} aria-disabled={!shops.length || undefined}
            onMouseEnter={() => shops[0] && setHover(first('s', shops[0]) || null)} onMouseLeave={() => setHover(null)}>SHOP<span aria-hidden>→</span></Link>
          <ul className="hl-list">
            {shops.map((r) => (
              <li key={r.id}>
                <Link href={r.shop!} className="hl-btn" onMouseEnter={() => setHover(first('s', r) || null)} onFocus={() => setHover(first('s', r) || null)} onMouseLeave={() => setHover(null)} onBlur={() => setHover(null)}>
                  <b>{r.name}</b><small>{tx('Merch oficial', 'Official merch')}</small><span aria-hidden>→</span>
                </Link>
              </li>
            ))}
            {!shops.length && <li className="hl-none">{tx('Próximamente', 'Coming soon')}</li>}
          </ul>
        </div>
      </div>

      <footer className="hl-foot">
        <span>{raceOf(current?.id)?.name || 'Reisin'}</span>
        {slides.length > 1 && !hover && (
          <div className="hl-dots" role="tablist">{slides.map((s, j) => <button key={s.key} type="button" aria-label={String(j + 1)} aria-selected={j === i} onClick={() => setI(j)} />)}</div>
        )}
        <span>reisin.mx</span>
      </footer>
    </section>
  );
}
