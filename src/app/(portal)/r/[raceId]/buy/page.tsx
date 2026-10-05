import { getT } from '@/lib/lang';
import { BuyForm } from '@/components/portal';
import { RaceHeader, Back, loadOpenRace, Closed } from '../../../shared';

export default async function BuyPage({ params }: { params: { raceId: string } }) {
  const { lang } = getT();
  const res = await loadOpenRace(params.raceId);
  if ('closed' in res) return <Closed name={res.closed} />;
  return (
    <>
      <Back href={`/r/${params.raceId}`} />
      <RaceHeader race={res.race} lang={lang} />
      <BuyForm race={res.race} />
    </>
  );
}
