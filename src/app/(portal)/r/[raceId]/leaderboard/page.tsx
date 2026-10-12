import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getRace } from '@/lib/repo';
import { getCurrentUser } from '@/lib/auth-guard';
import { buildBoard } from '@/lib/timing';
import { getT } from '@/lib/lang';
import { Leaderboard } from '@/components/leaderboard';
import { RaceHeader } from '../../../shared';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { raceId: string } }): Promise<Metadata> {
  const race = await getRace(params.raceId);
  return { title: race ? `${race.name} · Leaderboard` : 'Leaderboard' };
}

// Public live leaderboard: /r/<race or slug>/leaderboard
export default async function LeaderboardPage({ params }: { params: { raceId: string } }) {
  const { t, lang } = getT();
  const race = await getRace(params.raceId);
  if (!race) notFound();
  if (!race.board_public && !(await getCurrentUser())) {
    return (<><RaceHeader race={race} lang={lang} /><div className="card empty">{t('lb_hidden')}</div></>);
  }
  const board = await buildBoard(race);
  return (
    <div className="lb-wide stack">
      <RaceHeader race={race} lang={lang} />
      <Leaderboard board={board} />
    </div>
  );
}
