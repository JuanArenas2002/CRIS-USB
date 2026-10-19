import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { CONTACT_EMAIL } from '@/shared/contact';
import { NAV_ITEMS, isNavActive } from '@/shared/navigation';
import { Icon } from '@/presentation/components/ui/Icon';

const itemClass = (active: boolean) =>
  `rounded-lg px-3 py-1.5 text-label-md transition-colors ${
    active
      ? 'bg-primary-container font-bold text-on-primary'
      : 'font-semibold text-on-surface-variant hover:text-primary'
  }`;

export function SiteHeader() {
  const { pathname } = useLocation();
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  // Cierra el menú móvil al navegar.
  useEffect(() => {
    if (mobileMenu.current) mobileMenu.current.open = false;
  }, [pathname]);

  return (
    <header className="fixed top-0 z-50 w-full bg-canvas-cream/90 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-md">
      <div className="container-page flex h-20 items-center justify-between gap-4">
        <Link to="/" className="flex shrink-0 items-center gap-3" aria-label="Unisimón Research — inicio">
          <img src="/assets/unisimon-logo.png" alt="" width={197} height={32} className="h-8 w-auto" />
          <span className="hidden flex-col sm:flex">
            <span className="text-headline-sm leading-none font-semibold tracking-tight text-primary">
              UNISIMÓN RESEARCH
            </span>
            <span className="mt-0.5 text-label-sm tracking-wider text-on-surface-variant uppercase">
              Universidad Simón Bolívar
            </span>
          </span>
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-2 lg:flex">
          {NAV_ITEMS.map((item) => {
            const active = isNavActive(item, pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={itemClass(active)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="hidden h-10 items-center justify-center rounded-lg bg-primary-container px-4 text-label-md font-semibold text-on-primary transition-colors hover:bg-secondary md:inline-flex"
          >
            Contactar
          </a>
          {/* Menú móvil con <details>: accesible por teclado y funciona sin JavaScript. */}
          <details ref={mobileMenu} className="relative lg:hidden">
            <summary
              aria-label="Abrir menú"
              className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg text-primary hover:bg-surface-cream-alt [&::-webkit-details-marker]:hidden"
            >
              <Icon name="menu" className="text-[24px]" />
            </summary>
            <nav
              aria-label="Principal (móvil)"
              className="absolute top-12 right-0 flex w-60 flex-col gap-1 rounded-2xl bg-surface-container-lowest p-2 shadow-xl"
            >
              {NAV_ITEMS.map((item) => {
                const active = isNavActive(item, pathname);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    className={`${itemClass(active)} py-2.5`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="rounded-lg px-3 py-2.5 text-label-md font-semibold text-primary hover:bg-surface-cream-alt md:hidden"
              >
                Contactar
              </a>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
