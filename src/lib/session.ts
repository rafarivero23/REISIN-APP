import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

// Staff login session — same mechanism as Optimist Vendors.
const COOKIE_NAME = 'reisin_session';
const ALG = 'HS256';

export function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('SESSION_SECRET is missing or too short. Set a long random value (see .env.example).');
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = { userId: string; name: string; email: string };

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret());
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return { userId: payload.userId as string, name: payload.name as string, email: payload.email as string };
  } catch {
    return null;
  }
}

export function destroySession() {
  cookies().set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
