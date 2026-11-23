import { withBase } from '@/shared/base';
import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CONTACT_EMAIL, IRAKA_URL } from '@/shared/contact';
import { NAV_ITEMS, isNavActive } from '@/shared/navigation';
import { Icon } from '@/presentation/components/ui/Icon';
import { LanguageSelector } from './LanguageSelector';

// Barra forest (guía web): sección activa con línea jasmine. El panel móvil es claro y usa panelItemClass.
const itemClass = (active: boolean) =>
  `relative rounded-lg px-2.5 py-1.5 text-label-md font-semibold transition-colors 2xl:px-3 ${
    active
      ? 'text-on-primary after:absolute after:inset-x-2.5 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-secondary-fixed 2xl:after:inset-x-3'
      : 'text-on-primary/75 hover:text-on-primary'
  }`;
const panelItemClass = (active: boolean) =>
  `rounded-lg px-2.5 py-2.5 text-label-md transition-colors ${
    active
      ? 'bg-primary font-bold text-on-primary'
      : 'font-semibold text-on-surface-variant hover:bg-surface-cream-alt hover:text-primary'
  }`;

export function SiteHeader() {
  const { t } = useTranslation(['common', 'home']);
  // Enlace externo: nombre completo para lectores de pantalla y tooltip; en pantalla, solo «Iraka».
  const iraka = `${t('home:hero.iraka')} ${t('newTab')}`;
  const { pathname } = useLocation();
  const newsActive = pathname === '/noticias' || pathname.startsWith('/noticias/');
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  // Cierra el menú móvil al navegar.
  useEffect(() => {
    if (mobileMenu.current) mobileMenu.current.open = false;
  }, [pathname]);

  return (
    <header className="fixed top-0 z-50 w-full bg-primary [&_:focus-visible]:outline-secondary-fixed">
      <div className="container-page flex h-20 items-center justify-between gap-4">
        {/* Brandbook: el logosímbolo de la Universidad va a la izquierda del de Unisimón Research, y este nunca
            por debajo de 255 px de ancho en pantalla.
            ponytail: se muestra a 160 px por decisión del equipo (a 255 px dominaba la barra). */}
        <Link to="/" className="flex shrink-0 items-center gap-5" aria-label={t('homeLink')}>
          <img
            src={withBase('/assets/unisimon-logo.png')}
            alt=""
            width={172}
            height={28}
            className="hidden h-7 w-auto brightness-0 invert 2xl:block"
          />
          <span aria-hidden="true" className="hidden h-10 w-px bg-on-primary/25 2xl:block" />
          {/* ponytail: por debajo de ~350 px de pantalla el logo se encoge para no desbordar; mínimo del
              brandbook en todo lo demás. */}
          <img
            src={withBase('/assets/logo-research-light.svg')}
            alt=""
            width={160}
            height={46}
            className="h-auto w-40"
          />
        </Link>

        <nav aria-label={t('nav.main')} className="hidden items-center gap-0.5 xl:flex 2xl:gap-2">
          {NAV_ITEMS.map((item) => {
            const active = isNavActive(item, pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={itemClass(active)}
              >
                {t(`nav.items.${item.key}.label`)}
              </Link>
            );
          })}
          <Link
            to="/noticias"
            aria-current={newsActive ? 'page' : undefined}
            className={itemClass(newsActive)}
          >
            {t('nav.news')}
          </Link>
          <a
            href={IRAKA_URL}
            target="_blank"
            rel="noopener"
            aria-label={iraka}
            title={t('home:hero.iraka')}
            className={`${itemClass(false)} inline-flex items-center gap-1`}
          >
            Iraka <Icon name="open_in_new" className="text-[14px]" />
          </a>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <LanguageSelector className="hidden sm:block" />
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="hidden h-10 items-center justify-center rounded-full bg-secondary px-5 text-label-md font-semibold text-on-primary transition-colors hover:bg-secondary-fixed hover:text-primary md:inline-flex"
          >
            {t('nav.contact')}
          </a>
          {/* Menú móvil con <details>: accesible por teclado y funciona sin JavaScript. Hasta xl: el menú
              completo no cabe en una línea junto al selector de idioma (≈1 200 px). */}
          <details ref={mobileMenu} className="relative xl:hidden">
            <summary
              aria-label={t('nav.openMenu')}
              className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg text-on-primary hover:bg-on-primary/10 [&::-webkit-details-marker]:hidden"
            >
              <Icon name="menu" className="text-[24px]" />
            </summary>
            <nav
              aria-label={t('nav.mainMobile')}
              className="absolute top-12 right-0 flex w-60 flex-col gap-1 rounded-2xl bg-surface-container-lowest p-2 shadow-xl [&_:focus-visible]:outline-secondary"
            >
              {NAV_ITEMS.map((item) => {
                const active = isNavActive(item, pathname);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    className={panelItemClass(active)}
                  >
                    {t(`nav.items.${item.key}.label`)}
                  </Link>
                );
              })}
              <Link
                to="/noticias"
                aria-current={newsActive ? 'page' : undefined}
                className={panelItemClass(newsActive)}
              >
                {t('nav.news')}
              </Link>
              <a
                href={IRAKA_URL}
                target="_blank"
                rel="noopener"
                aria-label={iraka}
                className={`${panelItemClass(false)} inline-flex items-center gap-1.5`}
              >
                {t('home:hero.iraka')} <Icon name="open_in_new" className="text-[14px]" />
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="rounded-lg px-3 py-2.5 text-label-md font-semibold text-primary hover:bg-surface-cream-alt md:hidden"
              >
                {t('nav.contact')}
              </a>
              <LanguageSelector
                variant="inline"
                className="mt-1 border-t border-surface-cream-alt px-1 pt-2.5 sm:hidden"
              />
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
