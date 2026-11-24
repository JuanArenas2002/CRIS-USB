import { withBaseUrl } from '@/shared/base';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { CenterDetail } from '@/domain/centers/center';
import { Icon } from '@/presentation/components/ui/Icon';
import { card } from './styles';

export function CenterBreadcrumb({ label }: { label: string }) {
  const { t } = useTranslation(['centers', 'common']);
  return (
    <div className="border-b border-border-subtle bg-surface-container-lowest">
      <nav aria-label={t('common:breadcrumb.label')} className="container-page py-3">
        <ol className="flex flex-wrap items-center gap-1 text-label-md text-neutral-muted">
          <li>
            <Link to="/" className="inline-flex items-center gap-1 hover:text-primary">
              <Icon name="home" className="text-[16px]" /> {t('common:breadcrumb.home')}
            </Link>
          </li>
          <li aria-hidden="true">
            <Icon name="chevron_right" className="text-[16px]" />
          </li>
          <li>
            <Link to="/centros" className="hover:text-primary">
              {t('common:nav.items.centers.label')}
            </Link>
          </li>
          <li aria-hidden="true">
            <Icon name="chevron_right" className="text-[16px]" />
          </li>
          <li aria-current="page" className="font-semibold text-on-surface">
            {label}
          </li>
        </ol>
      </nav>
    </div>
  );
}

/** Encabezado limpio: solo identidad. Código, estado y dirección van en Información institucional. */
export function CenterHeader({ center: c }: { center: CenterDetail }) {
  const { t } = useTranslation(['centers', 'common']);
  return (
    <section className={`${card} relative overflow-hidden p-5 md:p-6`}>
      <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-surface-cream-alt/40" />
      <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {c.logoUrl ? (
          <img
            src={withBaseUrl(c.logoUrl)}
            alt={t('detail.logoAlt', { name: c.acronym ?? c.name })}
            className="h-20 w-20 shrink-0 rounded-xl border border-border-subtle bg-white object-contain p-2 md:h-24 md:w-24"
          />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary shadow-inner md:h-16 md:w-16">
            <Icon name="domain" className="text-[32px] md:text-[36px]" />
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          {c.acronym ? <p className="text-headline-sm font-bold text-secondary">{c.acronym}</p> : null}
          <h1 className="text-headline-lg-mobile font-bold tracking-tight text-primary md:text-headline-lg">
            {c.name}
          </h1>
        </div>
      </div>
    </section>
  );
}
