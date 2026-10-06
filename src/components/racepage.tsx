'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from './I18n';
import { Field, useToast, useCopy } from './ui';
import { RichText } from './RichText';
import { unlockRace, saveRacePage } from '@/app/actions/racepage';
import { BAJA_TEMPLATE, cleanSlug, type PageData } from '@/lib/racepage';

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

export function PageEditor({ race, initial }: { race: { id: string; name: string; brand: string }; initial: Draft }) {
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
              <input id="pg-slug" value={d.slug} placeholder="baja-crossing-2026" onChange={(e) => setD((x) => ({ ...x, slug: e.target.value }))} onBlur={() => setD((x) => ({ ...x, slug: cleanSlug(x.slug) }))} style={{ flex: 1 }} />
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
        </div>
        <Field id="pg-intro" label={t('pg_intro')} type="textarea" value={p.intro} onChange={(v) => setPage((x) => ({ ...x, intro: v }))} />

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
      </div>

      <div className="save-bar row" style={{ justifyContent: 'flex-end' }}>
        {err && <span className="err">{t(err)}</span>}
        {dirty && <button type="button" className="btn" onClick={() => { setD(initial); setErr(null); }}>{t('cancel')}</button>}
        <button type="button" className="btn btn-primary" disabled={busy || !dirty} onClick={save}>{busy ? <span className="spin" /> : t('save')}</button>
      </div>
    </div>
  );
}
