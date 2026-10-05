import { getT } from '@/lib/lang';
import { listedTeamsWithCounts } from '@/lib/repo';
import { JoinForm } from '@/components/portal';
import { RaceHeader, Back, loadOpenRace, Closed } from '../../../shared';

export default async function JoinPage({ params }: { params: { raceId: string } }) {
  const { lang } = getT();
  const res = await loadOpenRace(params.raceId);
  if ('closed' in res) return <Closed name={res.closed} />;
  const teams = (await listedTeamsWithCounts(res.race.id)).map((x) => ({ id: x.id, name: x.name, category: x.category, members: Number(x.members) }));
  return (
    <>
      <Back href={`/r/${params.raceId}`} />
      <RaceHeader race={res.race} lang={lang} />
      <JoinForm raceId={res.race.id} teamSize={res.race.team_size} teams={teams} />
    </>
  );
}
