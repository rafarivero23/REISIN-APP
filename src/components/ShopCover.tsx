'use client';
import { useEffect, useState } from 'react';

// Full-screen shop cover: photos cross-dissolve every 5 s (slow zoom on each).
export function ShopCover({ srcs, alt }: { srcs: string[]; alt: string }) {
  const [i, setI] = useState(0);
  const n = srcs.length;
  useEffect(() => {
    if (n < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setI((x) => (x + 1) % n), 5000);
    return () => clearInterval(id);
  }, [n]);
  return (
    <>
      {srcs.map((s, j) => <img key={s} className={'st-cover-img' + (j === i ? ' on' : '')} src={s} alt={j === 0 ? alt : ''} loading={j === 0 ? 'eager' : 'lazy'} />)}
      {n > 1 && (
        <div className="st-cover-dots" role="tablist">
          {srcs.map((s, j) => <button key={s} type="button" aria-label={String(j + 1)} aria-selected={j === i} onClick={() => setI(j)} />)}
        </div>
      )}
    </>
  );
}
