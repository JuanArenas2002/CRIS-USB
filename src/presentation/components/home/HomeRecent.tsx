import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { PublicationFilters } from '@/application/publications/publication-queries';
import type { ListedPublication } from '@/domain/publications/publication';
import { EmptyState, ErrorState } from '@/presentation/components/feedback/Feedback';
import { ModuleAccess } from '@/presentation/components/home/ModuleAccess';
import { Icon } from '@/presentation/components/ui/Icon';
import { useLabels } from '@/presentation/hooks/use-labels';
import { usePublications } from '@/presentation/hooks/use-publications';
import type { ResearchIndicatorMap } from '@/presentation/hooks/use-research-indicators';

/** Consulta de la portada; el prerender la precarga con estos mismos filtros. */
export const HOME_RECENT_FILTERS: PublicationFilters = { search: '', sort: 'recent', page: 1 };
const SHOWN = 4;

const external = (p: ListedPublication) => (p.doi ? `https://doi.org/${p.doi}` : null);

function PublicationLink({
  publication,
  className,
  children,
}: {
  publication: ListedPublication;
  className: string;
  children: React.ReactNode;
}) {
  const href = external(publication);
  return href ? (
    <a href={href} target="_blank" rel="noopener" className={className}>
      {children}
    </a>
  ) : (
    <Link to="/productos" className={className}>
      {children}
    </Link>
  );
}

/** Tipo y año, en el lugar de la categoría y la fecha de la plantilla. */
function Meta({ publication }: { publication: ListedPublication }) {
  const { domain } = useLabels();
  return (
    <p className="flex flex-wrap items-center gap-2 text-label-sm font-bold tracking-wider">
      {publication.type ? (
        <span className="rounded bg-badge-sage-bg px-1.5 py-0.5 text-badge-sage-text uppercase">
          {domain(publication.type)}
        </span>
      ) : null}
      {publication.year ? <span className="text-neutral-muted">{publication.year}</span> : null}
    </p>
  );
}

function LeadPublication({ publication }: { publication: ListedPublication }) {
  const { t } = useTranslation('home');
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-surface-container bg-surface-container-lowest shadow-sm md:col-span-7">
      <div className="relative flex min-h-40 flex-col justify-end bg-surface-dark-forest p-5 text-on-primary sm:p-6">
        {publication.quartile ? (
          <span className="absolute top-4 left-4 rounded-sm bg-primary-container px-2.5 py-1 text-label-sm font-bold tracking-wider uppercase">
            {publication.quartile}
          </span>
        ) : null}
        <Icon name="menu_book" className="absolute top-4 right-4 text-[28px] text-secondary-fixed" />
        <p className="line-clamp-2 text-body-md font-semibold text-primary-fixed">{publication.journal}</p>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-5 sm:p-6">
        <Meta publication={publication} />
        <h3 className="line-clamp-3 text-headline-sm font-bold text-on-surface">{publication.title}</h3>
        {publication.abstract ? (
          <p className="line-clamp-3 text-body-sm text-on-surface-variant">{publication.abstract}</p>
        ) : null}
        <div className="min-h-2 flex-1" />
        <PublicationLink
          publication={publication}
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-body-sm font-bold text-primary-container hover:underline"
        >
          {t('recent.read')}
          <span className="sr-only">: {publication.title}</span>
          <Icon name="arrow_forward" className="text-[18px]" />
        </PublicationLink>
      </div>
    </article>
  );
}

function PublicationRow({ publication }: { publication: ListedPublication }) {
  return (
    <article className="flex gap-3.5 rounded-xl border border-surface-container bg-surface-container-lowest p-4 shadow-sm">
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-badge-sage-bg text-body-md font-bold text-primary-container">
        {publication.quartile ?? <Icon name="article" className="text-[24px]" />}
      </span>
      <div className="min-w-0 space-y-1.5">
        <Meta publication={publication} />
        <h3 className="line-clamp-3 text-label-md font-bold text-on-surface">
          <PublicationLink publication={publication} className="hover:text-primary-container hover:underline">
            {publication.title}
          </PublicationLink>
        </h3>
      </div>
    </article>
  );
}

function RecentPublications() {
  const { t } = useTranslation(['home', 'common']);
  const { data, isError, error, refetch } = usePublications(HOME_RECENT_FILTERS);
  if (!data)
    return isError ? (
      <ErrorState error={error} onRetry={() => void refetch()} />
    ) : (
      <div
        aria-busy="true"
        aria-label={t('recent.loading')}
        className="grid grid-cols-1 gap-6 md:grid-cols-12"
      >
        <div className="h-96 animate-pulse rounded-2xl bg-surface-cream-alt motion-reduce:animate-none md:col-span-7" />
        <div className="h-96 animate-pulse rounded-2xl bg-surface-cream-alt motion-reduce:animate-none md:col-span-5" />
      </div>
    );
  const [lead, ...rest] = data.items.slice(0, SHOWN);
  if (!lead) return <EmptyState title={t('recent.emptyTitle')}>{t('recent.emptyBody')}</EmptyState>;
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
      <LeadPublication publication={lead} />
      <div className="flex flex-col justify-between gap-4 md:col-span-5">
        {rest.map((p) => (
          <PublicationRow key={p.eid} publication={p} />
        ))}
      </div>
    </div>
  );
}

export function HomeRecent({ indicators }: { indicators: ResearchIndicatorMap }) {
  const { t } = useTranslation('home');
  return (
    <section aria-labelledby="recent-title" className="w-full py-16">
      <div className="container-page grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-8">
          <div className="flex items-end justify-between gap-4 border-b border-surface-container pb-3">
            <div>
              <p className="inline-flex items-center gap-2 text-label-md font-bold tracking-wider text-primary-container uppercase">
                <span className="h-0.5 w-5 bg-primary-container" />
                {t('recent.eyebrow')}
              </p>
              <h2
                id="recent-title"
                className="mt-1 text-headline-lg-mobile font-bold tracking-tight text-on-surface md:text-headline-lg"
              >
                {t('recent.title')}
              </h2>
            </div>
            <Link
              to="/productos?orden=recent"
              className="inline-flex min-h-11 shrink-0 items-center gap-1 text-label-md font-bold text-primary-container hover:underline"
            >
              {t('recent.all')} <Icon name="arrow_forward" className="text-[18px]" />
            </Link>
          </div>
          <RecentPublications />
        </div>
        <ModuleAccess indicators={indicators} />
      </div>
    </section>
  );
}
