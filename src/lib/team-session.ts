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

// Test-mode only. qty = slots bought; amount is recomputed server-side.
export async function signPayToken(kind: string, id: string, qty = 1) {
  return sign({ k: 'pay', kind, id, qty, n: crypto.randomUUID() }, '1h');
}
export async function verifyPayToken(token: string, kind: string, id: string): Promise<{ qty: number; amount: number } | null> {
  const p = await read(token, 'pay');
  if (!p || p.kind !== kind || p.id !== id) return null;
  return { qty: Number(p.qty || 1), amount: 0 };
}

// "Busco equipo" listing owner. Long-lived so a runner can come back to see
// invitations; the same token also works as a private link (?k=…).
const AGENT = 'reisin_agent';
export async function agentToken(agentId: string) {
  return sign({ k: 'agent', a: agentId }, '180d');
}
export async function setAgent(token: string) {
  cookies().set(AGENT, token, cookieOpts(60 * 60 * 24 * 180));
}
export async function readAgentToken(token: string | undefined): Promise<string | null> {
  const p = await read(token, 'agent');
  return (p?.a as string) ?? null;
}
export async function getAgentId(): Promise<string | null> {
  return readAgentToken(cookies().get(AGENT)?.value);
}
export function clearAgent() {
  cookies().set(AGENT, '', { path: '/', maxAge: 0 });
}
