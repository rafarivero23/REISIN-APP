'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from './I18n';
import { Field, useToast, useCopy } from './ui';
import { RichText } from './RichText';
import { unlockRace, saveRacePage } from '@/app/actions/racepage';
import { BAJA_TEMPLATE, SAV_TEMPLATE, cleanSlug, type PageData } from '@/lib/racepage';
import { PHOTOS, photoSrc, defaultCover, type Photo } from '@/lib/photos';
import { uploadRacePhoto, deleteRacePhoto } from '@/app/actions/photos';

/* ---------- portal: password gate ---------- */
export function RaceGate({ raceId }: { raceId: string }) {
  const { t } = useT();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await unlockRace(raceId, code);
    setBusy(false);
    if ('error' in r) return setErr(r.error);
    router.refresh();
  };
  return (
    <div className="card" style={{ maxWidth: 460 }}>
      <h2 style={{ marginBottom: 6 }}>{t('pg_locked')}</h2>
      <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>{t('pg_lockedSub')}</p>
      <form className="form" onSubmit={submit} style={{ gridTemplateColumns: '1fr' }}>
        <Field id="pg-code" label={t('p_password')} type="password" value={code} onChange={setCode} req autoComplete="off" autoFocus />
        {err && <p className="err">{t(err)}</p>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? <span className="spin" /> : t('p_enter')}</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- admin: page editor ---------- */
type Draft = { slug: string; access_code: string; page: PageData };
const genCode = () => {
  const words = ['baja', 'ruta', 'relevo', 'desierto', 'cabo', 'playa', 'sol', 'mar', 'duna', 'cactus'];
  return words[Math.floor(Math.random() * words.length)] + Math.floor(1000 + Math.random() * 9000);
};
const move = <T,>(list: T[], i: number, d: number) => {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const n = [...list];
  [n[i], n[j]] = [n[j], n[i]];
  return n;
};

export function PageEditor({ race, initial, uploads = [] }: { race: { id: string; name: string; brand: string }; initial: Draft; uploads?: { id: string; w: number; h: number }[] }) {
  const { t } = useT();
  const router = useRouter();
  const toast = useToast();
  const copy = useCopy();
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const initKey = JSON.stringify(initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setD(initial), [initKey]);
  const p = d.page;
  const library: Photo[] = [...uploads.map((u) => ({ id: u.id, label: '', pos: '50% 50%', wide: u.w > u.h, w: u.w, h: u.h })), ...PHOTOS];
  const setPage = (fn: (p: PageData) => PageData) => setD((x) => ({ ...x, page: fn(x.page) }));
  const savedSlug = initial.slug;
  const url = `${origin}/${savedSlug || 'r/' + race.id}`;
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);

  const save = async () => {
    setBusy(true); setErr(null);
    const r = await saveRacePage(race.id, d);
    setBusy(false);
    if (r.error) return setErr(r.error);
    setD((x) => ({ ...x, slug: r.slug || '' }));
    toast(t('saved'));
    router.refresh();
  };
  const shareText = `${race.name}\n${url}${initial.access_code ? `\n${t('p_password')}: ${initial.access_code}` : ''}`;
  const inp = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', font: 'inherit', fontSize: 14, minWidth: 0 } as const;

  return (
    <div className="stack">
      {/* access */}
      <div className="card stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div><h3 style={{ textTransform: 'uppercase' }}>{t('pg_access')}</h3><p className="muted" style={{ fontSize: 14, marginTop: 4 }}>{t('pg_accessSub')}</p></div>
          <a className="btn btn-sm" href={savedSlug ? `/${savedSlug}` : `/r/${race.id}`} target="_blank" rel="noreferrer">{t('pg_view')} ↗</a>
        </div>
        <div className="form">
          <div className="field">
            <label htmlFor="pg-slug">{t('pg_url')}</label>
            <div className="row" style={{ flexWrap: 'nowrap', gap: 0 }}>
              <span className="muted" style={{ fontSize: 14, padding: '0 6px 0 0', whiteSpace: 'nowrap' }}>{origin.replace(/^https?:\/\//, '')}/</span>
              <input id="pg-slug" value={d.slug} placeholder={cleanSlug(race.name)} onChange={(e) => setD((x) => ({ ...x, slug: e.target.value }))} onBlur={() => setD((x) => ({ ...x, slug: cleanSlug(x.slug) }))} style={{ flex: 1 }} />
            </div>
            <span className="hint">{t('pg_urlHint')}</span>
          </div>
          <div className="field">
            <label htmlFor="pg-code">{t('pg_password')}</label>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input id="pg-code" value={d.access_code} onChange={(e) => setD((x) => ({ ...x, access_code: e.target.value }))} autoComplete="off" style={{ flex: 1 }} />
              <button type="button" className="btn btn-sm" onClick={() => setD((x) => ({ ...x, access_code: genCode() }))}>{t('pg_generate')}</button>
            </div>
            <span className="hint">{t('pg_passwordHint')}</span>
          </div>
        </div>
        {!dirty && (
          <div className="note row" style={{ justifyContent: 'space-between', color: 'var(--ink)' }}>
            <span style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{shareText}</span>
            <button type="button" className="btn btn-sm" onClick={() => copy(shareText)}>{t('pg_copyShare')}</button>
          </div>
        )}
      </div>

      {/* content */}
      <div className="card stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div><h3 style={{ textTransform: 'uppercase' }}>{t('pg_content')}</h3><p className="muted" style={{ fontSize: 14, marginTop: 4 }}>{t('pg_contentSub')}</p></div>
          {/baja/i.test(race.brand + race.name) && (
            <button type="button" className="btn btn-sm" onClick={() => { if (!p.sections.length || confirm(t('pg_templateConfirm'))) setPage(() => BAJA_TEMPLATE); }}>{t('pg_template')}</button>
          )}
          {/(sal a valle|\bsav\b)/i.test(race.brand + ' ' + race.name) && (
            <button type="button" className="btn btn-sm" onClick={() => { if (!(p.sections.length || p.faq.length || p.agenda.length) || confirm(t('pg_templateConfirm'))) setPage((x) => ({ ...SAV_TEMPLATE, cover: x.cover, photos: x.photos })); }}>{t('pg_templateSav')}</button>
          )}
        </div>
        <PhotoUploader raceId={race.id} uploads={uploads} onAdded={(ids) => setPage((x) => ({ ...x, photos: [...ids, ...x.photos] }))}
          onRemoved={(id) => setPage((x) => ({ ...x, photos: x.photos.filter((y) => y !== id), cover: x.cover === id ? '' : x.cover }))} />
        <div className="stack" style={{ gap: 8 }}>
          <div><div className="label">{t('pg_cover')}</div><p className="muted" style={{ fontSize: 13, marginTop: 2 }}>{t('pg_coverSub')}</p></div>
          <div className="photo-pick" role="radiogroup" aria-label={t('pg_cover')}>
            {library.map((ph) => {
              const on = (p.cover || defaultCover(race.brand)) === ph.id;
              return (
                <button key={ph.id} type="button" role="radio" aria-checked={on} aria-pressed={on} title={ph.label} onClick={() => setPage((x) => ({ ...x, cover: ph.id }))}>
                  <img src={photoSrc(ph.id, true)} alt={ph.label} loading="lazy" style={{ objectPosition: ph.pos }} />{on && <span className="tick">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div><div className="label">{t('pg_photos')} · {p.photos.length}</div><p className="muted" style={{ fontSize: 13, marginTop: 2 }}>{t('pg_photosSub')}</p></div>
            <span className="row" style={{ gap: 4 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPage((x) => ({ ...x, photos: library.map((ph) => ph.id) }))}>{t('pg_all')}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPage((x) => ({ ...x, photos: [] }))}>{t('pg_none')}</button>
            </span>
          </div>
          <div className="photo-pick">
            {library.map((ph) => {
              const on = p.photos.includes(ph.id);
              return (
                <button key={ph.id} type="button" aria-pressed={on} title={ph.label}
                  onClick={() => setPage((x) => ({ ...x, photos: on ? x.photos.filter((y) => y !== ph.id) : [...x.photos, ph.id] }))}>
                  <img src={photoSrc(ph.id, true)} alt={ph.label} loading="lazy" style={{ objectPosition: ph.pos }} />{on && <span className="tick">{p.photos.indexOf(ph.id) + 1}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <Field id="pg-intro" label={t('pg_intro')} type="textarea" value={p.intro} onChange={(v) => setPage((x) => ({ ...x, intro: v }))} />
        <Field id="pg-video" label={t('pg_video')} value={p.video} onChange={(v) => setPage((x) => ({ ...x, video: v }))} placeholder="https://vimeo.com/…" hint={t('pg_videoHint')} />

        <div className="stack" style={{ gap: 8 }}>
          <div className="label">{t('pg_links')}</div>
          {p.links.map((l, i) => (
            <div key={i} className="row" style={{ flexWrap: 'nowrap' }}>
              <input aria-label={t('pg_linkLabel')} placeholder={t('pg_linkLabel')} value={l.label} style={{ ...inp, width: 200 }} onChange={(e) => setPage((x) => ({ ...x, links: x.links.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)) }))} />
              <input aria-label="URL" placeholder="https://…" value={l.url} style={{ ...inp, flex: 1 }} onChange={(e) => setPage((x) => ({ ...x, links: x.links.map((y, j) => (j === i ? { ...y, url: e.target.value } : y)) }))} />
              <button type="button" className="btn btn-ghost btn-sm" aria-label={t('del')} onClick={() => setPage((x) => ({ ...x, links: x.links.filter((_, j) => j !== i) }))}>✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setPage((x) => ({ ...x, links: [...x.links, { label: '', url: '' }] }))}>+ {t('pg_addLink')}</button>
        </div>

        <div className="stack" style={{ gap: 8 }}>
          <div><div className="label">{t('pg_stats')}</div><p className="muted" style={{ fontSize: 13, marginTop: 2 }}>{t('pg_statsSub')}</p></div>
          {p.stats.map((x, i) => {
            const set = (k: 'value' | 'unit' | 'label') => (e: React.ChangeEvent<HTMLInputElement>) => setPage((pp) => ({ ...pp, stats: pp.stats.map((y, j) => (j === i ? { ...y, [k]: e.target.value } : y)) }));
            return (
              <div key={i} className="row" style={{ flexWrap: 'nowrap' }}>
                <input aria-label={t('pg_statValue')} placeholder="120" value={x.value} onChange={set('value')} style={{ ...inp, width: 90 }} />
                <input aria-label={t('pg_statUnit')} placeholder="km" value={x.unit} onChange={set('unit')} style={{ ...inp, width: 150 }} />
                <input aria-label={t('pg_statLabel')} placeholder={t('pg_statLabel')} value={x.label} onChange={set('label')} style={{ ...inp, flex: 1 }} />
                <button type="button" className="btn btn-ghost btn-sm" aria-label={t('del')} onClick={() => setPage((pp) => ({ ...pp, stats: pp.stats.filter((_, j) => j !== i) }))}>✕</button>
              </div>
            );
          })}
          {p.stats.length < 6 && <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setPage((x) => ({ ...x, stats: [...x.stats, { value: '', unit: '', label: '' }] }))}>+ {t('pg_addStat')}</button>}
        </div>

        <div className="stack" style={{ gap: 8 }}>
          <div className="label">{t('pg_agenda')}</div>
          {p.agenda.map((a, i) => {
            const set = (k: keyof typeof a) => (e: React.ChangeEvent<HTMLInputElement>) => setPage((x) => ({ ...x, agenda: x.agenda.map((y, j) => (j === i ? { ...y, [k]: e.target.value } : y)) }));
            return (
              <div key={i} className="agenda-row">
                <input aria-label={t('pg_day')} placeholder={t('pg_day')} value={a.day} onChange={set('day')} style={inp} />
                <input aria-label={t('pg_time')} placeholder={t('pg_time')} value={a.time} onChange={set('time')} style={inp} />
                <input aria-label={t('pg_what')} placeholder={t('pg_what')} value={a.title} onChange={set('title')} style={inp} />
                <input aria-label={t('pg_note')} placeholder={t('pg_note')} value={a.note} onChange={set('note')} style={inp} />
                <span className="row" style={{ gap: 2, flexWrap: 'nowrap' }}>
                  <button type="button" className="btn btn-ghost btn-sm" aria-label="↑" onClick={() => setPage((x) => ({ ...x, agenda: move(x.agenda, i, -1) }))}>↑</button>
                  <button type="button" className="btn btn-ghost btn-sm" aria-label="↓" onClick={() => setPage((x) => ({ ...x, agenda: move(x.agenda, i, 1) }))}>↓</button>
                  <button type="button" className="btn btn-ghost btn-sm" aria-label={t('del')} onClick={() => setPage((x) => ({ ...x, agenda: x.agenda.filter((_, j) => j !== i) }))}>✕</button>
                </span>
              </div>
            );
          })}
          <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setPage((x) => ({ ...x, agenda: [...x.agenda, { day: x.agenda[x.agenda.length - 1]?.day || '', time: '', title: '', note: '' }] }))}>+ {t('pg_addAgenda')}</button>
        </div>

        <div className="stack" style={{ gap: 10 }}>
          <div className="label">{t('pg_sections')}</div>
          {p.sections.map((x, i) => (
            <div key={i} className="card stack" style={{ padding: 14, gap: 8, background: 'var(--surface-2)' }}>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input aria-label={t('pg_sectionTitle')} placeholder={t('pg_sectionTitle')} value={x.title} style={{ ...inp, flex: 1, fontWeight: 600 }} onChange={(e) => setPage((pp) => ({ ...pp, sections: pp.sections.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)) }))} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPreview(preview === i ? null : i)}>{preview === i ? t('edit') : t('pg_preview')}</button>
                <button type="button" className="btn btn-ghost btn-sm" aria-label="↑" onClick={() => setPage((pp) => ({ ...pp, sections: move(pp.sections, i, -1) }))}>↑</button>
                <button type="button" className="btn btn-ghost btn-sm" aria-label="↓" onClick={() => setPage((pp) => ({ ...pp, sections: move(pp.sections, i, 1) }))}>↓</button>
                <button type="button" className="btn btn-ghost btn-sm" aria-label={t('del')} onClick={() => setPage((pp) => ({ ...pp, sections: pp.sections.filter((_, j) => j !== i) }))}>✕</button>
              </div>
              {preview === i ? <div className="card" style={{ padding: 14 }}><RichText text={x.body} /></div> : (
                <textarea aria-label={t('pg_sectionBody')} value={x.body} rows={Math.min(14, Math.max(4, x.body.split('\n').length + 1))} style={{ ...inp, width: '100%', resize: 'vertical' }}
                  onChange={(e) => setPage((pp) => ({ ...pp, sections: pp.sections.map((y, j) => (j === i ? { ...y, body: e.target.value } : y)) }))} />
              )}
            </div>
          ))}
          <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setPage((x) => ({ ...x, sections: [...x.sections, { title: '', body: '' }] }))}>+ {t('pg_addSection')}</button>
          <p className="muted" style={{ fontSize: 12 }}>{t('pg_formatHelp')}</p>
        </div>

        <div className="stack" style={{ gap: 10 }}>
          <div className="label">{t('pg_faq')} · {p.faq.length}</div>
          {p.faq.map((f, i) => (
            <div key={i} className="card stack" style={{ padding: 14, gap: 8, background: 'var(--surface-2)' }}>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input aria-label={t('pg_faqQ')} placeholder={t('pg_faqQ')} value={f.q} style={{ ...inp, flex: 1, fontWeight: 600 }} onChange={(e) => setPage((pp) => ({ ...pp, faq: pp.faq.map((y, j) => (j === i ? { ...y, q: e.target.value } : y)) }))} />
                <button type="button" className="btn btn-ghost btn-sm" aria-label="↑" onClick={() => setPage((pp) => ({ ...pp, faq: move(pp.faq, i, -1) }))}>↑</button>
                <button type="button" className="btn btn-ghost btn-sm" aria-label="↓" onClick={() => setPage((pp) => ({ ...pp, faq: move(pp.faq, i, 1) }))}>↓</button>
                <button type="button" className="btn btn-ghost btn-sm" aria-label={t('del')} onClick={() => setPage((pp) => ({ ...pp, faq: pp.faq.filter((_, j) => j !== i) }))}>✕</button>
              </div>
              <textarea aria-label={t('pg_faqA')} placeholder={t('pg_faqA')} value={f.a} rows={Math.min(10, Math.max(3, f.a.split('\n').length + 1))} style={{ ...inp, width: '100%', resize: 'vertical' }}
                onChange={(e) => setPage((pp) => ({ ...pp, faq: pp.faq.map((y, j) => (j === i ? { ...y, a: e.target.value } : y)) }))} />
            </div>
          ))}
          <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setPage((x) => ({ ...x, faq: [...x.faq, { q: '', a: '' }] }))}>+ {t('pg_addFaq')}</button>
        </div>
      </div>

      <div className={"row" + (dirty ? " save-bar" : "")} style={{ justifyContent: "flex-end" }}>
        {err && <span className="err">{t(err)}</span>}
        {dirty && <button type="button" className="btn" onClick={() => { setD(initial); setErr(null); }}>{t('cancel')}</button>}
        <button type="button" className="btn btn-primary" disabled={busy || !dirty} onClick={save}>{busy ? <span className="spin" /> : t('save')}</button>
      </div>
    </div>
  );
}

/* ---------- photo uploads ---------- */
// Resize in the browser (1600px + 800px JPEG) so uploads stay small and fast.
async function resize(file: File, max: number, q: number): Promise<{ url: string; w: number; h: number }> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  return { url: c.toDataURL('image/jpeg', q), w, h };
}

function PhotoUploader({ raceId, uploads, onAdded, onRemoved }: { raceId: string; uploads: { id: string }[]; onAdded: (ids: string[]) => void; onRemoved: (id: string) => void }) {
  const { t } = useT();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (!files.length) return;
    const added: string[] = [];
    for (const [i, f] of files.entries()) {
      setBusy(`${i + 1}/${files.length}`);
      try {
        const lg = await resize(f, 1600, 0.82), sm = await resize(f, 800, 0.78);
        const r = await uploadRacePhoto(raceId, lg.url, sm.url, lg.w, lg.h);
        if (r.error || !r.id) toast(`${f.name}: ${t(r.error || 'ph_bad')}`); else added.push(r.id);
      } catch { toast(`${f.name}: ${t('ph_bad')}`); }
    }
    setBusy(null);
    if (added.length) { onAdded(added); toast(t('ph_added').replace('{n}', String(added.length))); router.refresh(); }
  };
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div><div className="label">{t('ph_title')} · {uploads.length}</div><p className="muted" style={{ fontSize: 13, marginTop: 2 }}>{t('ph_sub')}</p></div>
        <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
          {busy ? <><span className="spin" /> {busy}</> : `↑ ${t('ph_upload')}`}
          <input type="file" accept="image/*" multiple hidden onChange={pick} disabled={!!busy} />
        </label>
      </div>
      {uploads.length > 0 && (
        <div className="photo-pick">
          {uploads.map((u) => (
            <div key={u.id} style={{ position: 'relative', aspectRatio: '4/3', borderRadius: 8, overflow: 'hidden' }}>
              <img src={photoSrc(u.id, true)} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <button type="button" className="ph-del" aria-label={t('del')} onClick={async () => {
                if (!confirm(t('ph_delConfirm'))) return;
                await deleteRacePhoto(raceId, u.id); onRemoved(u.id); router.refresh();
              }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
