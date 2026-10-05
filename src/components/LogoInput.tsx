'use client';
import { useRef, useState } from 'react';
import { useT } from './I18n';

// Picks an image, shrinks it to fit 400×400 in the browser and hands back a data: URL.
export function LogoInput({ current, onChange }: { current: string | null; onChange: (dataUrl: string | null) => Promise<void> }) {
  const { t } = useT();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(f); });
      const k = Math.min(1, 400 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      let url = c.toDataURL('image/png');
      if (url.length > 350_000) url = c.toDataURL('image/jpeg', 0.85);
      await onChange(url);
    } finally { setBusy(false); }
  };
  return (
    <div className="row" style={{ gap: 12 }}>
      <div style={{ width: 64, height: 64, borderRadius: 10, border: '1px dashed var(--line)', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'var(--surface-2)' }}>
        {current ? <img src={current} alt={t('logo')} style={{ maxWidth: '100%', maxHeight: '100%' }} /> : <span className="muted" style={{ fontSize: 12 }}>{t('logo')}</span>}
      </div>
      <button type="button" className="btn btn-sm" disabled={busy} onClick={() => ref.current?.click()}>{busy ? <span className="spin" /> : current ? t('logoChange') : t('logoUpload')}</button>
      {current && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>{t('del')}</button>}
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pick} />
    </div>
  );
}
