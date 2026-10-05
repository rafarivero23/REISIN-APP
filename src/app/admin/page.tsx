import Link from 'next/link';
import { listRaces, listTeams, listRunners, listPayments } from '@/lib/repo';
import { getT } from '@/lib/lang';
import { money } from '@/lib/format';
import { NewRaceButton } from '@/components/admin';
import { raceStats } from '@/lib/stats';
import { toARace, toATeams, toARunners } from './data';
import RaceCard from './RaceCard';

export default async function AdminHome() {
  const { t, lang } = getT();
  const [races, teams, runners, payments] = await Promise.all([listRaces(), listTeams(), listRunners(), listPayments()]);
  const aTeams = toATeams(teams), aRunners = toARunners(runners);
  const rs = races.map(toARace).map((r) => ({ r, s: raceStats(r, aTeams.filter((x) => x.race_id === r.id), aRunners.filter((x) => x.race_id === r.id), payments.filter((x) => x.race_id === r.id)) }));
  const open = rs.filter((x) => x.r.status === 'open');
  const tot = rs.reduce((a, { s }) => ({ teams: a.teams + s.teams, runners: a.runners + s.runners, rev: a.rev + s.revenue, pend: a.pend + s.pending }), { teams: 0, runners: 0, rev: 0, pend: 0 });
  const teamName = (id: string) => teams.find((x) => x.id === id)?.name || '—';
  const raceName = (id: string) => races.find((x) => x.id === id)?.name || '';
  const today = new Date().toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' });
  return (
    <>
      <div className="top">
        <div>
          <div className="label">{today}</div>
          <h1>{t('welcome')}</h1>
          <p className="muted" style={{ marginTop: 8, maxWidth: '60ch' }}>{t('welcomeSub')}</p>
        </div>
        <div className="row">
          <a className="btn" href="/" target="_blank" rel="noreferrer">{t('viewPortal')} ↗</a>
          <NewRaceButton />
        </div>
      </div>
      <div className="stack">
        <div className="kpis">
          <div className="kpi"><div className="label">{t('openRaces')}</div><div className="v num">{open.length}</div><div className="s">{races.length} {t('allRaces').toLowerCase()}</div></div>
          <div className="kpi"><div className="label">{t('teamsSold')}</div><div className="v num">{tot.teams}</div></div>
          <div className="kpi"><div className="label">{t('runners')}</div><div className="v num">{tot.runners}</div></div>
          <div className="kpi"><div className="label">{t('revenue')}</div><div className="v num">{money(tot.rev, lang)}</div><div className="s">{money(tot.pend, lang)} {t('pending').toLowerCase()}</div></div>
        </div>
        <div className="split">
          <section className="stack">
            <div className="row" style={{ justifyContent: 'space-between' }}><h2>{t('openRaces')}</h2><Link className="btn btn-ghost" href="/admin/races">{t('allRaces')} →</Link></div>
            {open.length ? <div className="race-grid">{open.map(({ r, s }) => <RaceCard key={r.id} r={r} s={s} lang={lang} t={t} />)}</div> : (
              <div className="card empty">{races.length ? t('p_noRaces') : t('noRaces')}<div style={{ marginTop: 12 }}><NewRaceButton /></div></div>
            )}
          </section>
          <section className="card">
            <h3 style={{ textTransform: 'uppercase', marginBottom: 8 }}>{t('recent')}</h3>
            {runners.length ? (
              <div className="list">
                {runners.slice(0, 8).map((r) => (
                  <div className="it" key={r.id}>
                    <div style={{ minWidth: 0 }}><b>{r.first_name} {r.last_name}</b><div className="muted" style={{ fontSize: 13 }}>{teamName(r.team_id)} · {raceName(r.race_id)}</div></div>
                    <span className="bib">{r.bib || '—'}</span>
                  </div>
                ))}
              </div>
            ) : <p className="muted">{t('noRecent')}</p>}
          </section>
        </div>
      </div>
    </>
  );
}
