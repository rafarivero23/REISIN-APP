import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRace, liveTeamCount, sizeOptions, type Race } from '@/lib/repo';
import { brandKey, fmtDate, type Lang } from '@/lib/format';
import { getT } from '@/lib/lang';
import type { PublicRace } from '@/components/portal';

export function RaceHeader({ race, lang }: { race: Pick<Race, 'brand' | 'name' | 'race_date' | 'location'>; lang: Lang }) {
  const bk = brandKey(race.brand);
  return (
    <div className="p-hero">
      <span className={'brand-chip ' + bk}>{race.brand}</span>
      <h1>{race.name}</h1>
      <p className="muted">{fmtDate(race.race_date, lang)}{race.location ? ' · ' + race.location : ''}</p>
    </div>
  );
}

export function Back({ href }: { href: string }) {
  const { t } = getT();
  return <Link className="p-back" href={href}>← {t('back')}</Link>;
}

// Loads an open race for a portal page, or shows a closed/not-found state.
export async function loadOpenRace(raceId: string): Promise<{ race: PublicRace } | { closed: string }> {
  const race = await getRace(raceId);
  if (!race) notFound();
  if (race.status !== 'open') return { closed: race.name };
  const live = await liveTeamCount(race.id);
  const { id, name, brand, race_date, location, team_price, runner_fee, team_size, categories, waiver, hold_slots } = race;
  return { race: { id, name, brand, race_date, location, team_price, runner_fee, team_size, categories, waiver, hold_slots, sizes: sizeOptions(race), teams_left: Math.max(0, race.capacity_teams - live) } };
}

export function Closed({ name }: { name: string }) {
  const { t } = getT();
  return (
    <>
      <Back href="/" />
      <div className="card empty"><b>{name}</b><p style={{ marginTop: 8 }}>{t('race_closed')}</p></div>
    </>
  );
}
