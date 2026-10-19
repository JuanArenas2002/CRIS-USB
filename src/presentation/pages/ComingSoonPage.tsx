import { HeroWaves } from '@/presentation/components/layout/HeroWaves';
import { Link } from 'react-router';
import { feedbackButtonClass } from '@/presentation/components/feedback/Feedback';
import { Icon } from '@/presentation/components/ui/Icon';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
import type { NavItem } from '@/shared/navigation';

/** Sección del menú que aún no tiene datos publicados: enlace real, sin contenido falso, sin indexar. */
export function ComingSoonPage({ item }: { item: NavItem }) {
  useDocumentMetadata({ title: item.label, description: item.description, path: item.to, noindex: true });
  return (
    <>
      <section className="relative overflow-hidden bg-surface-dark-forest pt-10 pb-14 text-on-primary">
        <HeroWaves />
        <div className="relative container-page flex flex-col gap-3">
          <p className="inline-flex items-center gap-1.5 self-start rounded-full bg-primary-container px-3 py-1 text-label-sm tracking-wide text-primary-fixed">
            <span className="h-2 w-2 rounded-full bg-tertiary-fixed" /> En construcción
          </p>
          <h1 className="text-display-hero-mobile font-bold tracking-tight md:text-display-hero">
            {item.label}
          </h1>
          <p className="max-w-2xl text-body-lg text-primary-fixed-dim">{item.description}</p>
        </div>
      </section>
      <div className="container-page py-16">
        <div className="flex flex-col items-center rounded-3xl bg-surface-container-lowest px-6 py-14 text-center shadow-sm">
          <Icon name="construction" className="mb-2 text-[48px] text-secondary" />
          <h2 className="text-headline-sm font-semibold text-primary">Estamos preparando esta sección</h2>
          <p className="mt-1 max-w-md text-body-md text-neutral-muted">
            Muy pronto encontrarás aquí la información de {item.label.toLowerCase()}. Mientras tanto, explora
            el directorio de investigadores.
          </p>
          <Link to="/" className={feedbackButtonClass}>
            Ir a Investigadores
          </Link>
        </div>
      </div>
    </>
  );
}
