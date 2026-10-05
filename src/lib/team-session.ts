// Narrow cookie "sessions" for the public portal — deliberately separate
// from the staff login (same idea as the check-in door link in Optimist
// Vendors). A captain cookie unlocks one team's dashboard; a member cookie
// lets a runner register into one team; a pay token proves a simulated
// (test-mode) payment belongs to one team/runner.
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { getSecret } from './session';

const CAPTAIN = 'reisin_captain';
const MEMBER = 'reisin_member';

async function sign(payload: Record<string, unknown>, exp: string) {
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(exp).sign(getSecret());
}
async function read(token: string | undefined, kind: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.k === kind ? payload : null;
  } catch {
    return null;
  }
}
const cookieOpts = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge,
});

export async function setCaptain(teamId: string) {
  cookies().set(CAPTAIN, await sign({ k: 'captain', t: teamId }, '60d'), cookieOpts(60 * 60 * 24 * 60));
}
export async function getCaptainTeamId(): Promise<string | null> {
  const p = await read(cookies().get(CAPTAIN)?.value, 'captain');
  return (p?.t as string) ?? null;
}
export function clearCaptain() {
  cookies().set(CAPTAIN, '', { path: '/', maxAge: 0 });
}

export async function setMember(teamId: string) {
  cookies().set(MEMBER, await sign({ k: 'member', t: teamId }, '6h'), cookieOpts(60 * 60 * 6));
}
export async function getMemberTeamId(): Promise<string | null> {
  const p = await read(cookies().get(MEMBER)?.value, 'member');
  return (p?.t as string) ?? null;
}

export async function signPayToken(kind: 'team' | 'runner', id: string) {
  return sign({ k: 'pay', kind, id }, '1h');
}
export async function verifyPayToken(token: string, kind: 'team' | 'runner', id: string) {
  const p = await read(token, 'pay');
  return !!p && p.kind === kind && p.id === id;
}
