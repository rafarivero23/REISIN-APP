'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from './I18n';
import { useToast } from './ui';
import { addSponsor, updateSponsor, deleteSponsor, moveSponsor, setSponsorMono } from '@/app/actions/sponsors';
import { SponsorStrip } from './Sponsors';
import type { Sponsor } from '@/lib/sponsors';

/* ---------- logo clean-up in the browser ----------
   1. Draw at up to 1200px (SVG included).
   2. Solid light background (JPG on white) → made transparent.
   3. All-white logo on transparent → recolored dark so it shows on the white band.
   4. Trim empty edges, export a PNG no bigger than 600×300. */
const loadImg = (file: File) => new Promise<HTMLImageElement>((ok, bad) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => bad(new Error('decode'));
  img.src = url;
});

export async function cleanLogo(file: File): Promise<{ url: string; w: number; h: number }> {
  const img = await loadImg(file);
  let w0 = img.naturalWidth || 1200, h0 = img.naturalHeight || 600;
  const k0 = Math.min(1200 / w0, 1200 / h0, /svg/.test(file.type) ? 99 : 1);
  w0 = Math.max(1, Math.round(w0 * k0)); h0 = Math.max(1, Math.round(h0 * k0));
  const c = document.createElement('canvas'); c.width = w0; c.height = h0;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, w0, h0);
  const data = g.getImageData(0, 0, w0, h0), px = data.data;
  const at = (x: number, y: number) => (y * w0 + x) * 4;

  // background: corners all opaque and alike and light → knock it out
  const corners = [at(0, 0), at(w0 - 1, 0), at(0, h0 - 1), at(w0 - 1, h0 - 1)];
  const opaque = corners.every((i) => px[i + 3] > 245);
  if (opaque) {
    const avg = [0, 1, 2].map((ch) => corners.reduce((a, i) => a + px[i + ch], 0) / 4);
    const alike = corners.every((i) => Math.abs(px[i] - avg[0]) + Math.abs(px[i + 1] - avg[1]) + Math.abs(px[i + 2] - avg[2]) < 36);
    const luma = 0.299 * avg[0] + 0.587 * avg[1] + 0.114 * avg[2];
    if (alike && luma > 200) {
      for (let i = 0; i < px.length; i += 4) {
        const d = Math.abs(px[i] - avg[0]) + Math.abs(px[i + 1] - avg[1]) + Math.abs(px[i + 2] - avg[2]);
        if (d < 30) px[i + 3] = 0;
        else if (d < 90) px[i + 3] = Math.round(px[i + 3] * (d - 30) / 60);
      }
    }
  }

  // white-only logo → dark ink
  let sum = 0, n = 0;
  for (let i = 0; i < px.length; i += 16) if (px[i + 3] > 128) { sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; n++; }
  if (n && sum / n > 225) for (let i = 0; i < px.length; i += 4) { px[i] = 20; px[i + 1] = 24; px[i + 2] = 32; }

  // trim
  let x0 = w0, y0 = h0, x1 = -1, y1 = -1;
  for (let y = 0; y < h0; y++) for (let x = 0; x < w0; x++) if (px[at(x, y) + 3] > 10) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) throw new Error('empty');
  g.putImageData(data, 0, 0);
  const tw = x1 - x0 + 1, th = y1 - y0 + 1;
  const k = Math.min(1, 600 / tw, 300 / th);
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(tw * k)); out.height = Math.max(1, Math.round(th * k));
  const og = out.getContext('2d')!;
  og.imageSmoothingQuality = 'high';
  og.drawImage(c, x0, y0, tw, th, 0, 0, out.width, out.height);
  URL.revokeObjectURL(img.src);
  return { url: out.toDataURL('image/png'), w: out.width, h: out.height };
}

const nameOf = (f: File) => f.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').replace(/\s+(logo|logotipo|isotipo)$/i, '').trim();

/* ---------- admin editor ---------- */
export function SponsorEditor({ raceId, sponsors, mono }: { raceId: string; sponsors: Sponsor[]; mono: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [rows, setRows] = useState(sponsors);
  const key = sponsors.map((s) => `${s.id}${s.name}${s.url}`).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setRows(sponsors), [key]);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    let added = 0;
    for (const [i, f] of files.entries()) {
      setBusy(`${i + 1}/${files.length}`);
      try {
        const l = await cleanLogo(f);
        const r = await addSponsor(raceId, nameOf(f), l.url, l.w, l.h);
        if (r.error) toast(`${f.name}: ${t(r.error)}`); else added++;
      } catch { toast(`${f.name}: ${t('sp_bad')}`); }
    }
    setBusy(null);
    if (added) { toast(t('sp_added').replace('{n}', String(added))); router.refresh(); }
  };
  const saveRow = async (s: Sponsor) => {
    const orig = sponsors.find((x) => x.id === s.id);
    if (orig && orig.name === s.name && (orig.url || '') === (s.url || '')) return;
    const r = await updateSponsor(raceId, s.id, { name: s.name, url: s.url || '' });
    if (r.error) toast(t(r.error)); else { toast(t('saved')); router.refresh(); }
  };
  const inp = { padding: '6px 8px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', font: 'inherit', fontSize: 13, minWidth: 0, width: '100%', boxSizing: 'border-box' } as const;

  return (
    <div className="card stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div><h3 style={{ textTransform: 'uppercase' }}>{t('sp_title')} · {rows.length}</h3><p className="muted" style={{ fontSize: 14, marginTop: 4 }}>{t('sp_sub')}</p></div>
        <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
          {busy ? <><span className="spin" /> {busy}</> : `↑ ${t('sp_upload')}`}
          <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" multiple hidden onChange={pick} disabled={!!busy} />
        </label>
      </div>
      {rows.length > 0 && (
        <>
          <label className="row" style={{ gap: 8, fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={mono} onChange={async (e) => { await setSponsorMono(raceId, e.target.checked); router.refresh(); }} />
            {t('sp_mono')}
          </label>
          <div className="sp-edit">
            {rows.map((s, i) => (
              <div key={s.id} className="sp-card">
                <div className="sp-logo"><img src={`/api/sponsor/${s.id}`} alt={s.name} /></div>
                <input aria-label={t('sp_name')} placeholder={t('sp_name')} value={s.name} style={inp}
                  onChange={(e) => setRows((x) => x.map((y) => (y.id === s.id ? { ...y, name: e.target.value } : y)))} onBlur={() => saveRow(rows[i])} />
                <input aria-label={t('sp_url')} placeholder={t('sp_url')} value={s.url || ''} style={inp}
                  onChange={(e) => setRows((x) => x.map((y) => (y.id === s.id ? { ...y, url: e.target.value } : y)))} onBlur={() => saveRow(rows[i])} />
                <div className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-ghost btn-sm" aria-label="←" disabled={i === 0} onClick={async () => { await moveSponsor(raceId, s.id, -1); router.refresh(); }}>←</button>
                  <button type="button" className="btn btn-ghost btn-sm" aria-label="→" disabled={i === rows.length - 1} onClick={async () => { await moveSponsor(raceId, s.id, 1); router.refresh(); }}>→</button>
                  <button type="button" className="btn btn-ghost btn-sm" aria-label={t('del')} onClick={async () => { if (!confirm(t('sp_delConfirm'))) return; await deleteSponsor(raceId, s.id); router.refresh(); }}>✕</button>
                </div>
              </div>
            ))}
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <div className="label">{t('pg_preview')}</div>
            <SponsorStrip sponsors={rows} mono={mono} title={t('sp_title')} />
          </div>
        </>
      )}
    </div>
  );
}
