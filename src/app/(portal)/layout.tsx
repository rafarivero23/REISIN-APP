import Link from 'next/link';
import { LangToggle } from '@/components/I18n';
import { getT } from '@/lib/lang';

export const dynamic = 'force-dynamic';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { t } = getT();
  return (
    <div className="portal">
      <header className="p-top">
        <div className="in">
          <Link href="/" className="brand" style={{ color: 'inherit', textDecoration: 'none' }}>
            <img src="/reisin-wordmark-white.png" alt="Reisin" className="brand-wordmark" />
          </Link>
          <LangToggle />
        </div>
      </header>
      <main className="p-main">{children}</main>
    </div>
  );
}
