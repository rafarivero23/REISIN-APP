import { redirect } from 'next/navigation';
import { getSession } from './session';
import { one } from './db';

export type CurrentUser = { userId: string; name: string; email: string; role: string };

// Looks the user up fresh on every call so removing someone takes effect
// immediately, not only when their cookie expires.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;
  const user = await one<{ id: string; name: string; email: string; role: string }>(
    'SELECT id, name, email, role FROM users WHERE id = ?',
    [session.userId]
  );
  if (!user) return null;
  return { userId: user.id, name: user.name, email: user.email, role: user.role };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}
