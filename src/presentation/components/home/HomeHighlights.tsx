import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { DirectoryFilters } from '@/application/authors/author-queries';
import { RANKING_TIERS, authorSlug, displayName, initials, type Author } from '@/domain/authors/author';
import { ErrorState } from '@/presentation/components/feedback/Feedback';
import { Icon } from '@/presentation/components/ui/Icon';
import { useAuthors } from '@/presentation/hooks/use-authors';
import { useLabels } from '@/presentation/hooks/use-labels';
import { withBaseUrl } from '@/shared/base';

/** Consulta del Top de la portada; el prerender la precarga con estos mismos filtros. */
export const HOME_TOP_FILTERS: DirectoryFilters = { search: '', tier: 'top12', page: 1 };

function TopResearcher({ author }: { author: Author }) {
  const { t } = useTranslation('home');
  const labels = useLabels();
  const name = displayName(author.name);
  const n = RANKING_TIERS.top12;
  return (
    <>
      <div className="h-72 w-60 shrink-0 overflow-hidden rounded-2xl bg-surface-dark-forest">
        {author.photoUrl ? (
          <img
            src={withBaseUrl(author.photoUrl)}
            alt=""
            width={480}
            height={360}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center text-[56px] font-bold text-secondary-fixed"
          >
            {initials(name)}
          </span>
        )}
      </div>
      <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
        <p className="inline-flex items-center gap-2 text-label-sm font-bold tracking-wider text-primary-container uppercase">
          <span className="h-0.5 w-4 bg-primary-container" />
          {t('highlight.eyebrow', { n })}
        </p>
        <h3 className="text-headline-sm font-bold text-on-surface md:text-[22px] md:leading-8">{name}</h3>
        <p className="text-body-sm text-on-surface-variant">
          {labels.researcher(author.category)}
          {author.mainGroup ? ` · ${author.mainGroup.name}` : ''}
        </p>
        {author.ranking ? (
          <p className="text-body-sm font-semibold text-primary-container">
            {t('highlight.index', { value: labels.number(author.ranking.index) })}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
          <Link
            to={`/investigadores/${authorSlug(author)}`}
            aria-label={`${t('highlight.profile')}: ${name}`}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-primary-container px-5 text-label-md font-semibold text-on-primary transition-colors hover:bg-primary"
          >
            {t('highlight.profile')} <Icon name="arrow_forward" className="text-[16px]" />
          </Link>
          <Link
            to="/investigadores?vista=top12"
            className="inline-flex min-h-11 items-center text-label-md font-bold text-primary-container hover:underline"
          >
            {t('highlight.top', { n })}
          </Link>
        </div>
      </div>
    </>
  );
}

function CommunityCard() {
  const { t } = useTranslation('home');
  return (
    <div className="flex flex-col justify-between rounded-3xl border border-badge-sage-bg bg-cta-sage p-6 shadow-sm sm:p-8 lg:col-span-4">
      <div className="flex flex-col gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container-lowest text-primary-container shadow-sm">
          <Icon name="handshake" className="text-[24px]" />
        </span>
        <h3 className="text-headline-sm font-bold text-primary-container">{t('highlight.communityTitle')}</h3>
        <p className="text-body-sm text-on-surface-variant">{t('highlight.communityBody')}</p>
      </div>
      <div className="mt-4 border-t border-primary-container/15 pt-4">
        <Link
          to="/relacionamiento"
          className="inline-flex min-h-11 items-center gap-1.5 text-label-md font-bold text-primary-container hover:underline"
        >
          {t('highlight.communityAction')} <Icon name="arrow_forward" className="text-[16px]" />
        </Link>
      </div>
    </div>
  );
}

export function HomeHighlights() {
  const { t } = useTranslation('home');
  const { data, isError, error, refetch } = useAuthors(HOME_TOP_FILTERS);
  const top = data?.items[0];
  const box =
    'flex flex-col items-center gap-6 rounded-3xl border border-border-subtle bg-surface-container-lowest p-6 shadow-sm sm:p-8 md:flex-row lg:col-span-8';
  return (
    <section aria-labelledby="highlights-title" className="w-full bg-surface-cream-alt/50 py-16">
      <h2 id="highlights-title" className="sr-only">
        {t('highlight.title')}
      </h2>
      <div className="container-page grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
        {top ? (
          <div className={box}>
            <TopResearcher author={top} />
          </div>
        ) : isError ? (
          <div className="lg:col-span-8">
            <ErrorState error={error} onRetry={() => void refetch()} />
          </div>
        ) : !data ? (
          <div
            aria-busy="true"
            aria-label={t('highlight.loading')}
            className="h-72 animate-pulse rounded-3xl bg-surface-cream-alt motion-reduce:animate-none lg:col-span-8"
          />
        ) : null}
        <CommunityCard />
      </div>
    </section>
  );
}
