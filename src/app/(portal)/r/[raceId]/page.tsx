import Link from 'next/link';
import { notFound } from 'next/navigation';
import { money } from '@/lib/format';
import { getT } from '@/lib/lang';
import { getRace } from '@/lib/repo';
import { getCurrentUser } from '@/lib/auth-guard';
import { hasRaceAccess } from '@/lib/team-session';
import { parsePage } from '@/lib/racepage';
import { RichText } from '@/components/RichText';
import { RaceGate } from '@/components/racepage';
import { RaceHeader, Back, loadOpenRace, Closed } from '../../shared';

export default async function RaceChoice({ params }: { params: { raceId: string } }) {
  const { t, lang } = getT();
  const raw = await getRace(params.raceId);
  if (!raw) notFound();
  const res = await loadOpenRace(raw.id);
  if ('closed' in res) return <Closed name={res.closed} />;
  const r = res.race;
  // Password-protected page: staff always get in (to preview).
  if (raw.access_code && !(await hasRaceAccess(raw.id, raw.access_code)) && !(await getCurrentUser())) {
    return (
      <>
        <Back href="/" />
        <RaceHeader race={r} lang={lang} />
        <RaceGate raceId={r.id} />
      </>
    );
  }
  const page = parsePage(raw.page);
  const days: { day: string; items: typeof page.agenda }[] = [];
  for (const a of page.agenda) {
    const last = days[days.length - 1];
    if (last && last.day === a.day) last.items.push(a);
    else days.push({ day: a.day, items: [a] });
  }
  return (
    <>
      <Back href="/" />
      <RaceHeader race={r} lang={lang} />
      {page.intro && <div className="rp-intro"><RichText text={page.intro} /></div>}
      {page.links.length > 0 && (
        <div className="row rp-links">
          {page.links.map((l, i) => (
            <a key={i} className="btn" href={l.url} target={l.url.startsWith('mailto:') ? undefined : '_blank'} rel="noopener noreferrer">{l.label} ↗</a>
          ))}
        </div>
      )}
      <div className="choice">
        <Link href={`/r/${r.id}/buy`} aria-disabled={r.teams_left <= 0}>
          <b>{t('p_buy')}</b><span>{r.teams_left > 0 ? t('p_buySub') : t('p_fullRace')}</span>
          <span className="num" style={{ color: 'var(--ink)', fontWeight: 600, marginTop: 6 }}>{money(r.team_price, lang)}</span>
        </Link>
        <Link href={`/r/${r.id}/captain`}><b>{t('p_captain')}</b><span>{t('p_captainSub')}</span></Link>
        <Link href={`/r/${r.id}/join`}><b>{t('p_join')}</b><span>{t('p_joinSub')}</span></Link>
        <Link href={`/r/${r.id}/agents`}><b>{t('fa_title')}</b><span>{t('fa_cardSub')}</span></Link>
      </div>
      {(days.length > 0 || page.sections.length > 0) && (
        <div className="rp-grid">
          {days.length > 0 && (
            <section className="card rp-agenda">
              <h2>{t('pg_agenda')}</h2>
              {days.map((d, i) => (
                <div key={i} className="rp-day">
                  {d.day && <div className="label">{d.day}</div>}
                  <ul>
                    {d.items.map((a, j) => (
                      <li key={j}>
                        <span className="num rp-time">{a.time}</span>
                        <span><b>{a.title}</b>{a.note && <span className="muted rp-note"><RichText text={a.note} /></span>}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
          {page.sections.map((s, i) => (
            <section key={i} className="card">
              {s.title && <h2>{s.title}</h2>}
              <RichText text={s.body} />
            </section>
          ))}
        </div>
      )}
    </>
  );
}
