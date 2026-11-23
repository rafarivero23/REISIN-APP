import { many } from '@/lib/db';
import type { Race } from '@/lib/repo';
import { getT } from '@/lib/lang';
import { fmtDate } from '@/lib/format';
import { parsePage } from '@/lib/racepage';
import { defaultCover, getPhoto, photoSrc } from '@/lib/photos';
import { heroList, imgSrc } from '@/lib/store-shared';
import { HomeLanding, type HomeRace } from '@/components/HomeLanding';

export const dynamic = 'force-dynamic';

// Reisin home: full-screen race photos behind two entries, RACE and SHOP,
// each with a button per race. Published races (open or closed), never drafts.
export default async function PortalHome() {
  const { lang } = getT();
  const races = await many<Race & { products: string }>(
    `SELECT r.*, (SELECT count(*) FROM store_products p WHERE p.race_id = r.id AND p.active) AS products
     FROM races r WHERE r.status IN ('open', 'closed') ORDER BY r.race_date NULLS LAST`);
  const list: HomeRace[] = races.map((r) => {
    const page = parsePage(r.page);
    const ids = [page.cover || defaultCover(r.brand), ...page.photos].filter(Boolean);
    const imgs = Array.from(new Set(ids)).map((id) => getPhoto(id)).filter((p): p is NonNullable<typeof p> => !!p).slice(0, 3).map((p) => ({ src: photoSrc(p.id), pos: p.pos }));
    const shopImgs = heroList(r.store_hero).slice(0, 3).map((id) => ({ src: imgSrc(id), pos: 'center' }));
    const slug = r.slug || r.id;
    return {
      id: r.id, name: r.name, brand: r.brand, when: [fmtDate(r.race_date, lang), r.location].filter(Boolean).join(' · '),
      race: `/r/${slug}`, shop: r.store_on && Number(r.products) > 0 ? `/r/${slug}/store` : null,
      imgs, shopImgs: shopImgs.length ? shopImgs : imgs, closed: r.status === 'closed',
    };
  });
  return <HomeLanding races={list} />;
}
