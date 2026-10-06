import type { ReactNode } from 'react';
import { getPhoto, photoSrc } from '@/lib/photos';

// Full-width photo band with a dark gradient so white text stays readable.
export function PhotoHero({ photo, children, size = 'md', top }: { photo: string; children: ReactNode; size?: 'md' | 'lg'; top?: ReactNode }) {
  const p = getPhoto(photo);
  return (
    <section className={'hero bleed hero-' + size}>
      {p && (
        <picture>
          <source media="(max-width: 700px)" srcSet={photoSrc(p.id, true)} />
          <img src={photoSrc(p.id)} alt="" style={{ objectPosition: p.pos }} fetchPriority="high" />
        </picture>
      )}
      <div className="hero-in">
        {top && <div className="hero-top">{top}</div>}
        <div className="hero-body">{children}</div>
      </div>
    </section>
  );
}

export function PhotoGallery({ photos, title }: { photos: string[]; title: string }) {
  const list = photos.map(getPhoto).filter((p): p is NonNullable<typeof p> => !!p);
  if (!list.length) return null;
  return (
    <section className="stack" style={{ gap: 12 }}>
      <h2 style={{ fontSize: 28 }}>{title}</h2>
      <div className="gallery">
        {list.map((p) => (
          <a key={p.id} href={photoSrc(p.id)} target="_blank" rel="noreferrer" className={p.wide ? 'wide' : ''}>
            <img src={photoSrc(p.id, true)} alt={p.label} loading="lazy" width={p.w} height={p.h} />
          </a>
        ))}
      </div>
    </section>
  );
}
