import { listRaces, listTeams, listRunners, listPayments } from '@/lib/repo';
import { getT } from '@/lib/lang';
import { NewRaceButton } from '@/components/admin';
import { raceStats } from '@/lib/stats';
import { toARace, toATeams, toARunners } from '../data';
import RaceCard from '../RaceCard';

export default async function RacesPage() {
  const { t, lang } = getT();
  const [races, teams, runners, payments] = await Promise.all([listRaces(), listTeams(), listRunners(), listPayments()]);
  const aTeams = toATeams(teams), aRunners = toARunners(runners);
  return (
    <>
      <div className="top"><h1>{t('races')}</h1><NewRaceButton /></div>
      {races.length ? (
        <div className="race-grid">
          {races.map(toARace).map((r) => (
            <RaceCard key={r.id} r={r} lang={lang} t={t} s={raceStats(r, aTeams.filter((x) => x.race_id === r.id), aRunners.filter((x) => x.race_id === r.id), payments.filter((x) => x.race_id === r.id))} />
          ))}
          <NewRaceButton className="race-card race-new" />
        </div>
      ) : <div className="card empty">{t('noRaces')}<div style={{ marginTop: 12 }}><NewRaceButton /></div></div>}
    </>
  );
}
