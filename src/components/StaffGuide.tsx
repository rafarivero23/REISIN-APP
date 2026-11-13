'use client';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RichText } from './RichText';
import { unlockGuide } from '@/app/actions/guide';
import type { GuideData } from '@/lib/staffGuide';

// Staff guide page (/guia/[raceId]): pick your name to see your own plan,
// then the shared sections. Dark Baja look, same tokens as the route plan.

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sec';
const ROWS: [keyof GuideData['people'][number], string][] = [['flights', 'Vuelos'], ['stay', 'Hospedaje'], ['car', 'Auto'], ['basecamp', 'Basecamp'], ['race', 'Carrera']];

export function StaffGuide({ raceName, data, links, updated }: { raceName: string; data: GuideData; links: { plan?: string; gpx?: string }; updated: string }) {
  const [who, setWho] = useState('');
  useEffect(() => { try { const w = localStorage.getItem('sg-who'); if (w && data.people.some((p) => p.name === w)) setWho(w); } catch {} }, [data.people]);
  const pick = (v: string) => { setWho(v); try { localStorage.setItem('sg-who', v); } catch {} };
  const me = data.people.find((p) => p.name === who);
  const upd = new Date(updated);

  return (
    <main className="sg">
      <header className="sg-head">
        <span className="sg-tag">Guía de staff · {raceName}</span>
        <h1>Guía de staff</h1>
        <p className="sg-mut">Actualizada {upd.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mazatlan' })} (hora BCS)</p>
        {(links.plan || links.gpx) && (
          <div className="sg-links">
            {links.plan && <a href={links.plan}>Plan de ruta y ambulancias ↗</a>}
            {links.gpx && <a href={links.gpx} download>Descargar ruta GPX ↓</a>}
          </div>
        )}
      </header>
      {data.intro && <div className="sg-note"><RichText text={data.intro} /></div>}

      <nav className="sg-nav" aria-label="Secciones">
        <ul>
          {data.people.length > 0 && <li><a href="#mi-plan">Mi plan</a></li>}
          {data.sections.map((s) => <li key={s.title}><a href={`#${slug(s.title)}`}>{s.title}</a></li>)}
        </ul>
      </nav>

      {data.people.length > 0 && (
        <section id="mi-plan" className="sg-sec">
          <h2>Mi plan</h2>
          <label className="sg-lab" htmlFor="sg-who">¿Quién eres?</label>
          <select id="sg-who" value={who} onChange={(e) => pick(e.target.value)}>
            <option value="">Selecciona tu nombre</option>
            {data.people.map((p) => <option key={p.name} value={p.name}>{p.name}{p.tag ? ` (${p.tag})` : ''}</option>)}
          </select>
          <div className="sg-me">
            {!me && <div className="sg-row"><span>Todo el equipo</span><span className="sg-mut">Elige tu nombre para ver tus vuelos, cuarto, auto, rol en basecamp y turno en carrera.</span></div>}
            {me && ROWS.filter(([k]) => (me[k] as string).trim()).map(([k, l]) => (
              <div key={k} className="sg-row"><span>{l}</span><div><RichText text={me[k] as string} /></div></div>
            ))}
          </div>
        </section>
      )}

      {data.sections.map((s) => (
        <section key={s.title} id={slug(s.title)} className="sg-sec">
          <h2>{s.title}</h2>
          <div className="sg-card"><RichText text={s.body} /></div>
        </section>
      ))}
      <footer className="sg-foot">{raceName} · uso interno del staff. No compartas esta liga ni su contraseña.</footer>
    </main>
  );
}

export function GuideGate({ raceId, raceName }: { raceId: string; raceName: string }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    const r = await unlockGuide(raceId, code);
    setBusy(false);
    if ('error' in r) return setErr(r.error === 'p_badPass' ? 'Contraseña incorrecta. Pídela al productor de la carrera.' : 'No se encontró la guía.');
    router.refresh();
  };
  return (
    <main className="sg sg-gate">
      <form className="sg-card" onSubmit={submit}>
        <span className="sg-tag">{raceName}</span>
        <h1>Guía de staff</h1>
        <p className="sg-mut">Escribe la contraseña de staff para entrar.</p>
        <label className="sg-lab" htmlFor="sg-code">Contraseña</label>
        <input id="sg-code" type="password" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoFocus required />
        {err && <p className="sg-err">{err}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </main>
  );
}
