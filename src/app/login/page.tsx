import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth-guard';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  if (await getCurrentUser()) redirect('/admin');
  return <LoginForm next={searchParams.next || '/admin'} />;
}
