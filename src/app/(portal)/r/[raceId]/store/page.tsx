import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRace } from '@/lib/repo';
import { getT } from '@/lib/lang';
import { brandKey } from '@/lib/format';
import { productsOf, imgSrc, heroList } from '@/lib/store';
import { ShopCover } from '@/components/ShopCover';
import { SAV_KIT, BX_KIT } from '@/components/SavLanding';
import { StoreFront, ShopGate } from '@/components/StoreFront';
import { hasShopAccess } from '@/lib/team-session';
import { getCurrentUser } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

// Race store, dressed in the race's own look (SAV or Baja Crossing kit).
export default async function StorePage({ params, searchParams }: { params: { raceId: string }; searchParams: { canceled?: string; p?: string } }) {
  const { lang } = getT();
  const race = await getRace(params.raceId);
  if (!race) notFound();
  const kit = brandKey(race.brand) === 'baja' ? BX_KIT : SAV_KIT;
  const locked = !!race.store_code && !(await hasShopAccess(race.id, race.store_code)) && !(await getCurrentUser());
  const products = race.store_on && !locked ? await productsOf(race.id, true) : [];
  const tx = (es: string, en: string) => (lang === 'en' ? en : es);
  const slug = race.slug || race.id;
  const tick = [tx('Merch oficial', 'Official merch'), race.name, kit.tagline, tx('Recoge en entrega de kits', 'Pick up at kit pickup'), 'A race by Reisin'];
  const ticker: string[] = []; while (ticker.length < 16) ticker.push(...tick);
  return (
    <div className={(kit.key === 'bx' ? 'sv bxl' : 'sv') + ' st-page'} style={{ display: 'contents' }}>
      {heroList(race.store_hero).length ? (
        <section className="st-cover sv-bleed">
          <ShopCover srcs={heroList(race.store_hero).map((id) => imgSrc(id))} alt={`${race.name} merch`} />
          <Link href={`/r/${slug}`} className="st-backlink st-cover-back mono">← {race.name}</Link>
          <div className="st-cover-in">
            <img className="st-logo" src={`${kit.base}/${kit.logo}`} alt={race.name} />
            <h1>SHOP</h1>
            <a href="#productos" className="sv-cta st-cover-cta">{tx('Ver productos', 'Shop now')} ↓</a>
          </div>
        </section>
      ) : (
        <section className="st-hero st-hero-c sv-bleed">
          <div className="sv-grid" aria-hidden />
          <Link href={`/r/${slug}`} className="st-backlink mono">← {race.name}</Link>
          <div className="st-hero-row">
            <img className="st-logo" src={`${kit.base}/${kit.logo}`} alt={race.name} />
            <h1>SHOP</h1>
            <p className="mono">{tx('Merch oficial', 'Official merch')}{locked ? ' · 🔒' : ` · ${products.length} ${tx('productos', 'products')}`}</p>
          </div>
        </section>
      )}
      <div id="productos" className="sv-ticker sv-bleed mono" aria-hidden><div style={{ animationDuration: `${ticker.length * 5}s` }}>{[...ticker, ...ticker].map((x, i) => <span key={i}>{kit.tick} {x}</span>)}</div></div>
      {race.store_on && locked ? <ShopGate raceId={race.id} /> : !race.store_on ? <div className="st-empty">{tx('La tienda abre muy pronto.', 'The store opens soon.')}</div> : (
        <StoreFront raceId={race.id} raceSlug={slug} raceName={race.name} products={products} canceled={!!searchParams.canceled} openId={searchParams.p}
          ship={{ pickup: race.store_pickup, fee: race.store_ship_fee }} />
      )}
    </div>
  );
}
