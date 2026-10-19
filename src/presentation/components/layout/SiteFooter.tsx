import { Link } from 'react-router';
import { CONTACT_EMAIL } from '@/shared/contact';
import { NAV_ITEMS } from '@/shared/navigation';

export function SiteFooter() {
  return (
    <footer className="w-full bg-surface-dark-forest py-16 text-on-primary">
      <div className="container-page">
        <div className="mb-10 grid grid-cols-1 gap-gutter md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <img
              src="/assets/unisimon-logo.png"
              alt="Universidad Simón Bolívar"
              width={172}
              height={28}
              loading="lazy"
              className="h-7 w-auto self-start brightness-0 invert"
            />
            <span className="mt-1 text-headline-sm font-semibold tracking-tight">UNISIMÓN RESEARCH</span>
            <p className="text-body-sm text-primary-fixed-dim">
              Portal institucional de divulgación científica y producción académica de la Universidad Simón
              Bolívar.
            </p>
          </div>
          <nav aria-label="Pie de página" className="flex flex-col gap-2">
            <span className="text-label-md tracking-wider text-tertiary-fixed uppercase">Navegación</span>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-body-sm text-primary-fixed-dim hover:text-on-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-2 text-body-sm text-primary-fixed-dim">
            <span className="text-label-md tracking-wider text-tertiary-fixed uppercase">
              Contacto institucional
            </span>
            <p>Barranquilla &amp; Cúcuta, Colombia</p>
            <p>Vicerrectoría de Investigación, Extensión e Innovación</p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="underline-offset-2 hover:text-on-primary hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>
        <p className="border-t border-primary-container pt-6 text-label-sm text-primary-fixed-dim">
          © Universidad Simón Bolívar. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
