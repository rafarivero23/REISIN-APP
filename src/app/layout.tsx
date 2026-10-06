import type { Metadata } from 'next';
import './globals.css';
import { I18nProvider } from '@/components/I18n';
import { ToastProvider } from '@/components/ui';
import { getLang } from '@/lib/lang';

export const metadata: Metadata = {
  title: 'Reisin Race Hub',
  description: 'Venta de equipos e inscripción de corredores para Sal a Valle y Baja Crossing',
  icons: { icon: '/icon.png', apple: '/apple-icon.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = getLang();
  return (
    <html lang={lang}>
      <head>
        <link rel="preload" href="/fonts/BajaCrossing.woff2" as="font" type="font/woff2" crossOrigin="" />
        {/* Plain <link> rather than next/font: next/font downloads fonts at
            build time, which fails in some build sandboxes. System fonts
            take over if Google Fonts can't load. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Barlow:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <I18nProvider lang={lang}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
