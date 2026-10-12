import type { Metadata } from 'next';
import { getT } from '@/lib/lang';
import { LeaderboardView, currentTimingRace } from '../timing-views';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Leaderboard' };
// /leaderboard (and leaderboard.<domain>/) → the current race's leaderboard.
export default async function CurrentLeaderboard() {
  const { t } = getT();
  const race = await currentTimingRace();
  if (!race) return <div className="card empty">{t('lb_noCps')}</div>;
  return <LeaderboardView race={race} />;
}
