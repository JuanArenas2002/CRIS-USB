import { useInfiniteQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { Trans, useTranslation } from 'react-i18next';
import { newsApi, type News } from '@/infrastructure/news/news-api';
import {
  LatestNews,
  NewsCard,
  NewsTile,
  SectionTitle,
  useNewsSections,
} from '@/presentation/components/news/news-ui';
import { Icon } from '@/presentation/components/ui/Icon';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';

/** Primera página: 1 principal + 4 destacadas + 4 en "Más noticias"; "Ver más" trae 4 más cada vez. */
const FIRST = 9;
const MORE = 4;

/**
 * Portada de noticias (/noticias), con estructura de portal informativo: barra de secciones,
 * noticia principal grande con la columna "Lo último", fila de destacadas y la lista de más noticias.
 * Solo publicadas y vigentes (fijadas y prioritarias primero). Se pide en el navegador (no se prerenderiza).
 */
export function NewsHomePage() {
  const { t } = useTranslation(['home', 'common']);
  const [params] = useSearchParams();
  const sectionId = Number(params.get('seccion')) || undefined;
  const sections = useNewsSections();
  const sectionName = sectionId ? sections.name(sectionId) : undefined;
  useDocumentMetadata({
    title: sectionName ? `${sectionName} · ${t('newsHome.title')}` : t('newsHome.title'),
    description: t('newsHome.lead'),
    path: sectionId ? `/noticias?seccion=${sectionId}` : '/noticias',
  });

  const pages = useInfiniteQuery({
    queryKey: ['public-news', 'home', sectionId ?? 'all'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      newsApi.list({ public: true, category_id: sectionId, offset: pageParam, limit: pageParam ? MORE : FIRST }),
    getNextPageParam: (last, all) =>
      last.length === (all.length === 1 ? FIRST : MORE) ? all.reduce((n, p) => n + p.length, 0) : undefined,
    retry: false,
  });
  const items = pages.data?.pages.flat() ?? [];
  const [lead, ...rest] = items;
  const featured = rest.slice(0, 4);
  const more = rest.slice(4);
  const section = (n: News) => (sectionId ? undefined : sections.name(n.category_id));

  return (
    <div className="w-full">
      {/* Encabezado con la misma estructura que las demás secciones del portal (Centros, Grupos…). */}
      <section
        aria-labelledby="news-title"
        className="relative w-full overflow-hidden bg-surface-dark-forest pt-10 pb-16 text-on-primary"
      >
        <div className="relative container-page flex flex-col gap-6">
          <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary-container px-3 py-1 text-label-sm tracking-wide text-primary-fixed hover:bg-primary"
            >
              <span className="h-2 w-2 rounded-full bg-secondary-fixed" /> {t('common:heroBadge')}
            </Link>
            <span className="text-label-sm text-primary-fixed-dim">
              /{' '}
              {sectionName ? (
                <>
                  <Link to="/noticias" className="hover:underline">{t('newsHome.title')}</Link> /{' '}
                  <span aria-current="page">{sectionName}</span>
                </>
              ) : (
                <span aria-current="page">{t('newsHome.title')}</span>
              )}
            </span>
          </nav>
          <div className="flex max-w-3xl flex-col gap-2">
            <h1
              id="news-title"
              className="text-display-hero-mobile font-bold tracking-tight text-surface-container-lowest md:text-display-hero"
            >
              {sectionName ? (
                <span className="text-secondary-fixed">{sectionName}</span>
              ) : (
                <Trans t={t} i18nKey="newsHome.heading" components={{ hl: <span className="text-secondary-fixed" /> }} />
              )}
            </h1>
            <p className="text-body-lg text-primary-fixed-dim">{t('newsHome.lead')}</p>
          </div>
        </div>
      </section>

      {/* Secciones: tarjeta flotante sobre el encabezado, como los filtros de las demás páginas. */}
      {sections.categories.length > 0 && (
        <div className="relative z-30 container-page -mt-7">
          <nav
            aria-label={t('newsHome.sections')}
            className="rounded-2xl bg-surface-container-lowest p-3 shadow-xl"
          >
            <ul className="flex gap-1 overflow-x-auto">
              {[{ id: 0, name: t('newsHome.all') }, ...sections.categories].map((c) => {
                const active = (sectionId ?? 0) === c.id;
                return (
                  <li key={c.id} className="shrink-0">
                    <Link
                      to={c.id ? `/noticias?seccion=${c.id}` : '/noticias'}
                      aria-current={active ? 'page' : undefined}
                      className={`inline-flex min-h-10 items-center rounded-lg px-4 text-label-md transition-colors ${
                        active
                          ? 'bg-primary-container font-bold text-on-primary'
                          : 'font-semibold text-on-surface-variant hover:bg-surface-cream-alt hover:text-primary'
                      }`}
                    >
                      {c.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      )}

      <div className="container-page py-8 lg:py-10">
        {pages.isPending ? (
          <p role="status" className="text-body-md text-neutral-muted">{t('newsHome.loading')}</p>
        ) : pages.isError ? (
          <p role="alert" className="text-body-md text-error">{t('newsHome.error')}</p>
        ) : !lead ? (
          <p className="text-body-md text-on-surface-variant">
            {sectionId ? t('newsHome.emptyCategory') : t('newsHome.empty')}
          </p>
        ) : (
          <>
            {/* Portada: principal a la izquierda + rejilla 2x2 a la derecha (mismo alto). */}
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
              <article className="min-w-0">
                <NewsTile news={lead} section={section(lead)} lead />
              </article>
              {featured.length > 0 && (
                <section aria-labelledby="news-top" className="min-w-0">
                  <h2 id="news-top" className="sr-only">{t('newsHome.top')}</h2>
                  <ul className="grid h-full gap-6 sm:grid-cols-2 lg:gap-8">
                    {featured.map((n) => (
                      <li key={n.id}>
                        <NewsTile news={n} section={section(n)} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* Más noticias + Lo último */}
            <div className="mt-12 grid gap-8 lg:grid-cols-12">
              {more.length > 0 && (
                <section aria-labelledby="news-more" className="bg-surface-container-lowest p-5 shadow-sm sm:p-6 lg:col-span-8">
                  <SectionTitle id="news-more">{t('newsHome.more')}</SectionTitle>
                  <ul className="flex flex-col">
                    {more.map((n) => (
                      <li key={n.id} className="border-b border-border-subtle py-5 first:pt-0 last:border-b-0 last:pb-0">
                        <NewsCard news={n} section={section(n)} layout="row" />
                      </li>
                    ))}
                  </ul>
                  {pages.hasNextPage && (
                    <div className="mt-6 flex justify-center border-t border-border-subtle pt-6">
                      <button
                        type="button"
                        onClick={() => void pages.fetchNextPage()}
                        disabled={pages.isFetchingNextPage}
                        className="inline-flex min-h-12 items-center gap-1 rounded-full border-2 border-on-surface px-8 text-label-md font-bold tracking-wide uppercase hover:bg-on-surface hover:text-surface-container-lowest disabled:opacity-60"
                      >
                        {pages.isFetchingNextPage ? t('newsHome.loading') : t('newsHome.loadMore')}
                        {!pages.isFetchingNextPage && <Icon name="expand_more" className="text-[20px]" />}
                      </button>
                    </div>
                  )}
                </section>
              )}
              <aside className={`bg-surface-container-lowest p-5 shadow-sm sm:p-6 lg:sticky lg:top-24 lg:self-start ${more.length ? 'lg:col-span-4' : 'lg:col-span-12'}`}>
                <LatestNews excludeId={lead.id} limit={6} />
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

