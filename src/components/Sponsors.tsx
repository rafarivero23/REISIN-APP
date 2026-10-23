import type { Sponsor } from '@/lib/sponsors';

// Every logo gets the same visual area (not the same width or height), so a
// square crest and a long wordmark read as equally big. Caps keep extremes tidy.
const AREA = 6200, MAX_W = 220, MAX_H = 72;
export function logoBox(w: number, h: number) {
  const a = w / h;
  let bh = Math.sqrt(AREA / a), bw = bh * a;
  if (bw > MAX_W) { bw = MAX_W; bh = bw / a; }
  if (bh > MAX_H) { bh = MAX_H; bw = bh * a; }
  return { w: Math.round(bw), h: Math.round(bh) };
}

export function SponsorStrip({ sponsors, mono, title }: { sponsors: Sponsor[]; mono: boolean; title: string }) {
  if (!sponsors.length) return null;
  return (
    <section className={'sponsors' + (mono ? ' mono' : '')} aria-label={title}>
      <div className="label">{title}</div>
      <ul>
        {sponsors.map((s) => {
          const b = logoBox(s.w, s.h);
          const img = <img src={`/api/sponsor/${s.id}`} alt={s.name || ''} loading="lazy" width={b.w} height={b.h} style={{ width: `calc(${b.w}px * var(--sp-k))`, height: 'auto' }} />;
          return (
            <li key={s.id} title={s.name || undefined}>
              {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{img}</a> : img}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
