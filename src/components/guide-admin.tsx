'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast, useCopy } from './ui';
import { saveGuide } from '@/app/actions/guide';
import { BAJA_GUIDE_TEMPLATE, EMPTY_PERSON, type GuideData, type GuidePerson } from '@/lib/staffGuide';

// Admin → "Guía staff": password + content of the public staff guide (/guia/[raceId]).
const genCode = () => Array.from({ length: 6 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');
const FIELDS: [keyof GuidePerson, string][] = [['flights', 'Vuelos'], ['stay', 'Hospedaje'], ['car', 'Auto'], ['basecamp', 'Basecamp'], ['race', 'Carrera']];
const ta = { width: '100%', minHeight: 90, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', font: 'inherit', fontSize: 14, resize: 'vertical' } as const;
const inp = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', font: 'inherit', fontSize: 14, minWidth: 0 } as const;

export function GuideEditor({ race, initial, exists }: { race: { id: string; name: string; brand: string; slug: string | null }; initial: { password: string; data: GuideData }; exists: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const copy = useCopy();
  const [pw, setPw] = useState(initial.password);
  const [d, setD] = useState<GuideData>(initial.data);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [origin, setOrigin] = useState('');
  const [openP, setOpenP] = useState<number | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/guia/${race.slug || race.id}`;
  const dirty = pw !== initial.password || JSON.stringify(d) !== JSON.stringify(initial.data);
  const baja = /baja/i.test(race.brand + race.name);

  const setSec = (i: number, k: 'title' | 'body', v: string) => setD((x) => ({ ...x, sections: x.sections.map((s, j) => (j === i ? { ...s, [k]: v } : s)) }));
  const moveSec = (i: number, dir: -1 | 1) => setD((x) => { const s = [...x.sections]; const j = i + dir; if (j < 0 || j >= s.length) return x; [s[i], s[j]] = [s[j], s[i]]; return { ...x, sections: s }; });
  const setPer = (i: number, k: keyof GuidePerson, v: string) => setD((x) => ({ ...x, people: x.people.map((p, j) => (j === i ? { ...p, [k]: v } : p)) }));

  const save = async () => {
    setBusy(true); setErr('');
    const r = await saveGuide(race.id, { password: pw, data: d });
    setBusy(false);
    if (r.error) return setErr(r.error === 'p_passMin' ? 'La contraseña debe tener al menos 4 caracteres.' : 'No se pudo guardar.');
    toast('Guía guardada');
    router.refresh();
  };
  const share = `Guía de staff · ${race.name}\n${url}\nContraseña: ${initial.password}`;

  return (
    <div className="stack">
      <div className="card stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div><h3 style={{ textTransform: 'uppercase' }}>Guía de staff</h3><p className="muted" style={{ fontSize: 14, marginTop: 4 }}>Liga pública con contraseña. El staff con login de Reisin entra sin contraseña.</p></div>
          <div className="row">
            {baja && <button type="button" className="btn btn-sm" onClick={() => { if ((!d.sections.length && !d.people.length) || confirm('¿Reemplazar el contenido con la plantilla de Baja Crossing 2026?')) setD(BAJA_GUIDE_TEMPLATE); }}>Cargar plantilla Baja 2026</button>}
            {exists && <a className="btn btn-sm" href={`/guia/${race.slug || race.id}`} target="_blank" rel="noreferrer">Ver guía ↗</a>}
          </div>
        </div>
        <div className="form">
          <div className="field">
            <label htmlFor="sg-pw">Contraseña de staff *</label>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input id="sg-pw" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off" style={{ ...inp, flex: 1 }} />
              <button type="button" className="btn btn-sm" onClick={() => setPw(genCode())}>Generar</button>
            </div>
            <span className="hint">Si la cambias, todos tienen que volver a escribirla.</span>
          </div>
        </div>
        {exists && !dirty && (
          <div className="note row" style={{ justifyContent: 'space-between', color: 'var(--ink)' }}>
            <span style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{share}</span>
            <button type="button" className="btn btn-sm" onClick={() => copy(share)}>Copiar para WhatsApp</button>
          </div>
        )}
      </div>

      <div className="card stack">
        <h3 style={{ textTransform: 'uppercase' }}>Aviso arriba</h3>
        <p className="muted" style={{ fontSize: 13 }}>Formato: líneas con &quot;- &quot; son viñetas, **negritas**, [texto](https://liga), línea vacía = párrafo nuevo.</p>
        <textarea aria-label="Aviso arriba" style={ta} value={d.intro} onChange={(e) => setD((x) => ({ ...x, intro: e.target.value }))} />
      </div>

      <div className="card stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div><h3 style={{ textTransform: 'uppercase' }}>Mi plan · por persona</h3><p className="muted" style={{ fontSize: 14, marginTop: 4 }}>Cada quien elige su nombre en la guía y ve solo lo suyo.</p></div>
          <button type="button" className="btn btn-sm" onClick={() => { setD((x) => ({ ...x, people: [...x.people, { ...EMPTY_PERSON }] })); setOpenP(d.people.length); }}>+ Persona</button>
        </div>
        {d.people.map((p, i) => (
          <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12 }} className="stack">
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input aria-label="Nombre" placeholder="Nombre" value={p.name} onChange={(e) => setPer(i, 'name', e.target.value)} style={{ ...inp, flex: 2 }} />
              <input aria-label="Etiqueta" placeholder="Etiqueta (ej. Nike)" value={p.tag} onChange={(e) => setPer(i, 'tag', e.target.value)} style={{ ...inp, flex: 1 }} />
              <button type="button" className="btn btn-sm" onClick={() => setOpenP(openP === i ? null : i)}>{openP === i ? 'Cerrar' : 'Editar'}</button>
              <button type="button" className="btn btn-sm" onClick={() => { if (confirm(`¿Quitar a ${p.name || 'esta persona'}?`)) setD((x) => ({ ...x, people: x.people.filter((_, j) => j !== i) })); }}>Quitar</button>
            </div>
            {openP === i && FIELDS.map(([k, l]) => (
              <div key={k} className="field"><label htmlFor={`sg-p${i}-${k}`}>{l}</label><textarea id={`sg-p${i}-${k}`} style={{ ...ta, minHeight: 64 }} value={p[k]} onChange={(e) => setPer(i, k, e.target.value)} /></div>
            ))}
          </div>
        ))}
      </div>

      <div className="card stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div><h3 style={{ textTransform: 'uppercase' }}>Secciones</h3><p className="muted" style={{ fontSize: 14, marginTop: 4 }}>Agenda, basecamp, carrera, vuelos, hospedaje… en el orden que quieras.</p></div>
          <button type="button" className="btn btn-sm" onClick={() => setD((x) => ({ ...x, sections: [...x.sections, { title: 'Nueva sección', body: '' }] }))}>+ Sección</button>
        </div>
        {d.sections.map((s, i) => (
          <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12 }} className="stack">
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input aria-label="Título de la sección" value={s.title} onChange={(e) => setSec(i, 'title', e.target.value)} style={{ ...inp, flex: 1, fontWeight: 600 }} />
              <button type="button" className="btn btn-sm" onClick={() => moveSec(i, -1)} aria-label="Subir">↑</button>
              <button type="button" className="btn btn-sm" onClick={() => moveSec(i, 1)} aria-label="Bajar">↓</button>
              <button type="button" className="btn btn-sm" onClick={() => { if (confirm(`¿Borrar la sección "${s.title}"?`)) setD((x) => ({ ...x, sections: x.sections.filter((_, j) => j !== i) })); }}>Borrar</button>
            </div>
            <textarea aria-label={`Contenido de ${s.title}`} style={{ ...ta, minHeight: 180 }} value={s.body} onChange={(e) => setSec(i, 'body', e.target.value)} />
          </div>
        ))}
      </div>

      <div className="row" style={{ justifyContent: 'flex-end', position: 'sticky', bottom: 12 }}>
        {err && <span className="err">{err}</span>}
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy || (!dirty && exists)}>{busy ? <span className="spin" /> : 'Guardar guía'}</button>
      </div>
    </div>
  );
}
