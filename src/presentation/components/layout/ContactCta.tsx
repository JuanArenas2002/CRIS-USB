import { CONTACT_EMAIL } from '@/shared/contact';
import { Icon } from '@/presentation/components/ui/Icon';

export function ContactCta() {
  return (
    <section aria-labelledby="cta-title" className="w-full bg-cta-sage py-10 text-primary-container">
      <div className="container-page flex flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex max-w-2xl items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary">
            <Icon name="handshake" className="text-[26px]" />
          </span>
          <div>
            <h2 id="cta-title" className="text-headline-sm font-bold text-primary">
              ¿Quieres vincularte a un grupo o proponer un proyecto conjunto?
            </h2>
            <p className="mt-0.5 text-body-md text-badge-sage-text">
              Escríbenos y te conectamos con el equipo y los líderes de investigación indicados.
            </p>
          </div>
        </div>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-secondary px-6 text-label-md font-bold tracking-wide text-surface-container-lowest hover:bg-primary"
        >
          <Icon name="mail" className="text-[18px]" /> Contactar a Investigación
        </a>
      </div>
    </section>
  );
}
