import { Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';

export function RootLayout() {
  const { t } = useTranslation();
  return (
    <>
      <a
        href="#contenido"
        className="sr-only z-[60] rounded-lg bg-primary px-4 py-2 text-on-primary focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('skipToContent')}
      </a>
      <SiteHeader />
      <main id="contenido" tabIndex={-1} className="min-h-screen w-full pt-20">
        <Outlet />
      </main>
      <SiteFooter />
    </>
  );
}
