'use client';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

// SAV photo gallery: mosaic grid + full-screen viewer (no page navigation).
// Arrows / swipe / keyboard to move, thumbnail strip, Esc to close.
type P = { id: string; full: string; thumb: string };
const FIRST = 9; // 1 big + 8 small = full rows on desktop (4 cols) and mobile (2 cols)
const pad = (n: number) => String(n).padStart(2, '0');

export function SavGallery({ photos, frames, moreLabel, lessLabel }: { photos: P[]; frames?: string; moreLabel: string; lessLabel: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  const shown = all ? photos : photos.slice(0, FIRST);
  // Stretch the last tile so the mosaic never ends with an empty hole (4 cols desktop, 2 mobile).
  const fill = (cols: number) => { const r = (4 + shown.length - 1) % cols; return r ? cols - r + 1 : 1; };
  const sd = fill(4), sm = fill(2);
  return (
    <>
      <section className={'sv-gal sv-bleed' + (all ? ' all' : '')}>
        {shown.map((p, i) => (
          <button key={p.id} type="button" className="sv-gal-it" style={i > 0 && i === shown.length - 1 ? ({ '--sd': sd, '--sm': sm } as React.CSSProperties) : undefined} onClick={() => setOpen(i)} aria-label={`Foto ${i + 1}`}>
            <img src={i === 0 || (i === shown.length - 1 && sd > 1) ? p.full : p.thumb} alt="" loading={i < 3 ? 'eager' : 'lazy'} decoding="async" />
            {i === 0 && frames && <img className="sv-el sv-frames" src={frames} alt="" aria-hidden />}
            <span className="mono">{pad(i + 1)}</span>
            <i className="sv-gal-zoom" aria-hidden>+</i>
          </button>
        ))}
      </section>
      {photos.length > FIRST && (
        <div className="sv-gal-more sv-bleed">
          <button type="button" className="mono" onClick={() => setAll((v) => !v)}>
            {all ? lessLabel : moreLabel.replace('{n}', String(photos.length))} {all ? '↑' : '↓'}
          </button>
        </div>
      )}
      {open !== null && <Viewer photos={photos} start={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function Viewer({ photos, start, onClose }: { photos: P[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const [dir, setDir] = useState(0);
  const n = photos.length;
  const go = useCallback((d: number) => { setDir(d); setI((x) => (x + d + n) % n); }, [n]);
  const strip = useRef<HTMLDivElement>(null);
  const touch = useRef<number | null>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', k);
    const o = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = o; };
  }, [go, onClose]);

  useEffect(() => {
    // preload neighbours, keep the active thumb in view
    [1, -1].forEach((d) => { const im = new Image(); im.src = photos[(i + d + n) % n].full; });
    strip.current?.querySelector<HTMLElement>('[data-on="1"]')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [i, n, photos]);

  const p = photos[i];
  return (
    <div className="sv-lb" role="dialog" aria-modal="true" aria-label="Fotos"
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touch.current === null) return; const dx = e.changedTouches[0].clientX - touch.current; touch.current = null; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); }}>
      <div className="sv-lb-bar mono">
        <span><b>{pad(i + 1)}</b> / {pad(n)}</span>
        <span className="sv-lb-tag">SAV · Field archive</span>
        <button type="button" onClick={onClose} aria-label="Cerrar">Cerrar ✕</button>
      </div>
      <div className="sv-lb-stage" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <img key={p.id} src={p.full} alt="" className={'sv-lb-img' + (dir > 0 ? ' r' : dir < 0 ? ' l' : '')} />
        <div className="sv-lb-scan" key={'s' + p.id} aria-hidden />
        {n > 1 && <>
          <button type="button" className="sv-lb-nav prev mono" onClick={() => go(-1)} aria-label="Anterior">←</button>
          <button type="button" className="sv-lb-nav next mono" onClick={() => go(1)} aria-label="Siguiente">→</button>
        </>}
      </div>
      <div className="sv-lb-strip" ref={strip}>
        {photos.map((x, j) => (
          <button key={x.id} type="button" data-on={j === i ? '1' : '0'} onClick={() => { setDir(j > i ? 1 : -1); setI(j); }} aria-label={`Foto ${j + 1}`}>
            <img src={x.thumb} alt="" loading="lazy" />
          </button>
        ))}
      </div>
      <div className="sv-lb-prog" aria-hidden><i style={{ width: `${((i + 1) / n) * 100}%` }} /></div>
    </div>
  );
}
