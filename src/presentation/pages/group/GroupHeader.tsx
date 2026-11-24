import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { GroupDetail } from '@/domain/groups/group';
import { Icon } from '@/presentation/components/ui/Icon';
import { card } from './styles';

/** Migas de pan del grupo. */
export function GroupBreadcrumb({ code }: { code: string }) {
  const { t } = useTranslation(['groups', 'common', 'authors']);
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
            <Link to="/grupos" className="hover:text-primary">
              {t('common:nav.items.groups.label')}
            </Link>
          </li>
          <li aria-hidden="true">
            <Icon name="chevron_right" className="text-[16px]" />
          </li>
          <li aria-current="page" className="font-semibold text-on-surface">
            {code}
          </li>
        </ol>
      </nav>
    </div>
  );
}

/** Nombre del grupo y acciones: ver en GrupLAC e imprimir. */
export function GroupHeader({ group }: { group: Pick<GroupDetail, 'name' | 'gruplacUrl'> }) {
  const { t } = useTranslation(['groups', 'common', 'authors']);
  return (
    <section
      className={`${card} relative flex flex-col items-start justify-between gap-5 overflow-hidden p-5 md:p-6 lg:flex-row lg:items-center`}
    >
      <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-surface-cream-alt/40" />
      <div className="z-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary shadow-inner md:h-16 md:w-16">
          <Icon name="hub" className="text-[32px] md:text-[36px]" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-headline-lg-mobile font-bold tracking-tight text-primary md:text-headline-lg">
            {group.name}
          </h1>
        </div>
      </div>
      <div className="z-10 flex w-full shrink-0 flex-col items-center gap-2.5 sm:w-auto sm:flex-row lg:flex-col xl:flex-row print:hidden">
        {group.gruplacUrl ? (
          <a
            href={group.gruplacUrl}
            target="_blank"
            rel="noopener"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-secondary sm:w-auto"
          >
            {t('detail.viewGruplac')} <Icon name="open_in_new" className="text-[16px]" />
            <span className="sr-only">{t('common:newTab')}</span>
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-surface-cream-alt px-4 text-label-md font-semibold text-primary transition-colors hover:bg-badge-sage-bg sm:w-auto"
        >
          <Icon name="picture_as_pdf" className="text-[18px]" /> {t('detail.downloadPdf')}
        </button>
      </div>
    </section>
  );
}
