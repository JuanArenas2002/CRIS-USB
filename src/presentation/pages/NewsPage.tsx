import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { currentAffiliation, orcidUrl } from '@/domain/orcid/orcid';
import {
  articleHtml,
  responsiveImage,
  newsApi,
  type Catalogs,
  type News,
  type NewsPerson,
} from '@/infrastructure/news/news-api';
import { useOrcidProfile } from '@/presentation/hooks/use-orcid';
import { ARTICLE_PROSE } from '@/presentation/components/news/article-prose';
import { NewsShare } from '@/presentation/components/news/NewsShare';
import { NewsBodyImage, NewsHeader } from '@/presentation/components/news/NewsHeader';
import { NewsMediaSections } from '@/presentation/components/news/NewsMedia';
import { startReading } from '@/infrastructure/news/news-reading';
import { useConsent } from '@/infrastructure/privacy/consent';
import { Icon } from '@/presentation/components/ui/Icon';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
import {
  LatestNews,
  NewsCard,
  NEWS_PANEL,
  SectionTitle,
  sectionPath,
  useNewsSections,
} from '@/presentation/components/news/news-ui';

/**
 * Noticia pública (/noticias/:slug). Se pide en el navegador al backend de noticias: no se prerenderiza.
 * El HTML del contenido ya llega sanitizado por el backend (nh3), por eso se inserta tal cual.
 */
export function NewsPage() {
  const { slug = '' } = useParams();
  const { t, i18n } = useTranslation(['home', 'common']);
  const news = useQuery({
    queryKey: ['public-news', 'slug', slug],
    queryFn: () => newsApi.bySlug(slug),
    retry: false,
  });
  useDocumentMetadata({
    title: news.data?.title ?? t('newsSpotlight.label'),
    description: news.data?.summary ?? t('newsSpotlight.label'),
    path: `/noticias/${slug}`,
    noindex: !news.data,
  });
  const newsId = news.data?.id;
  // Vista + lectura activa SOLO con la analítica autorizada; si se revoca mientras lee, se detiene al instante.
  const analytics = useConsent().prefs?.categories.analytics ?? false;
  useEffect(() => (newsId && analytics ? startReading(newsId) : undefined), [newsId, analytics]);
  const sections = useNewsSections();
  const image = responsiveImage(news.data?.image_url, 1280);
  const articleUrl = typeof window === 'undefined' ? `/noticias/${slug}` : window.location.href;
  const category = news.data ? sections.name(news.data.category_id) : undefined;
  const words = (news.data?.content ?? '')
    .replace(/<[^>]*>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;

  // Ancho de lectura del portal: aprovecha pantallas anchas sin que las líneas del texto se alarguen.
  const frame = 'mx-auto w-full max-w-[1280px]';
  const crumbs = (
    <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-2">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 rounded-full bg-primary-container px-3 py-1 text-label-sm tracking-wide text-primary-fixed hover:bg-primary"
      >
        <span className="h-2 w-2 rounded-full bg-secondary-fixed" /> {t('common:heroBadge')}
      </Link>
      <span className="text-label-sm text-primary-fixed-dim">
        /{' '}
        <Link to="/noticias" className="hover:underline">
          {t('newsHome.title')}
        </Link>
        {category && news.data && (
          <>
            {' '}
            /{' '}
            <Link to={sectionPath(news.data.category_id)} aria-current="page" className="hover:underline">
              {category}
            </Link>
          </>
        )}
      </span>
    </nav>
  );

  if (!news.data)
    return (
      <section className="w-full bg-surface-dark-forest pt-10 pb-16 text-on-primary">
        <div className="container-page">
          <div className={`${frame} flex flex-col gap-5`}>
            {crumbs}
            {news.isPending ? (
              <p className="text-body-lg text-primary-fixed-dim" role="status">
                {t('newsPage.loading')}
              </p>
            ) : (
              <div className="flex max-w-3xl flex-col gap-3">
                <h1 className="text-headline-lg-mobile font-bold text-surface-container-lowest md:text-headline-lg">
                  {t('newsPage.notFoundTitle')}
                </h1>
                <p className="text-body-lg text-primary-fixed-dim">{t('newsPage.notFoundBody')}</p>
                <Link
                  to="/noticias"
                  className="inline-flex min-h-11 items-center self-start font-semibold text-secondary-fixed hover:underline"
                >
                  {t('newsHome.viewAll')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    );

  const n = news.data;
  const headerImage = image ? { ...image, alt: n.image_caption ?? '', caption: n.image_caption } : null;
  // Categoría principal destacada; las demás, como etiquetas más discretas al lado.
  const extraCategories = (n.category_ids ?? []).filter((id) => id !== n.category_id);
  const kicker = (
    <ul aria-label={t('newsPage.categories')} className="flex flex-wrap items-center gap-2">
      <li>
        <Link
          to={sectionPath(n.category_id)}
          className="inline-flex rounded-full bg-badge-sage-bg px-3 py-1 text-label-sm font-semibold text-badge-sage-text hover:bg-on-primary"
        >
          {category ?? t('newsSpotlight.label')}
        </Link>
      </li>
      {extraCategories.map((id) =>
        sections.name(id) ? (
          <li key={id}>
            <Link
              to={sectionPath(id)}
              className="inline-flex rounded-full border border-white/25 px-3 py-1 text-label-sm font-semibold text-primary-fixed hover:bg-white/10"
            >
              {sections.name(id)}
            </Link>
          </li>
        ) : null,
      )}
    </ul>
  );
  const meta = (
    <>
      <p className="font-bold text-on-primary">{t('newsPage.publisher')}</p>
      {n.published_at && (
        <p>
          <time dateTime={n.published_at}>
            {t('newsPage.published', {
              date: new Date(n.published_at).toLocaleDateString(i18n.language, { dateStyle: 'long' }),
            })}
          </time>
        </p>
      )}
      <p className="inline-flex items-center gap-1">
        <Icon name="schedule" className="text-[18px]" />
        {t('newsPage.readingTime', { count: Math.max(1, Math.round(words / 200)) })}
      </p>
    </>
  );
  return (
    <div className="w-full">
      <article>
        {/* Encabezado según la plantilla de la noticia (Clásica, Imagen destacada, Título sobre la imagen…). */}
        <NewsHeader
          template={n.template}
          frame={frame}
          crumbs={crumbs}
          kicker={kicker}
          title={n.title}
          summary={n.summary}
          meta={meta}
          image={headerImage}
        />

        <div className="container-page">
          <div className={`${frame} grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-14`}>
            <div className="min-w-0">
              <NewsBodyImage template={n.template} image={headerImage} />
              <div
                className={ARTICLE_PROSE}
                // Las imágenes del contenido (/media/...) se cargan por el proxy del backend de noticias.
                dangerouslySetInnerHTML={{ __html: articleHtml(n.content) }}
              />
              <NewsMediaSections media={n.media ?? []} />
              {n.tags.length > 0 && (
                <section className="mt-10 border-t border-border-subtle pt-6" aria-label={t('newsPage.tags')}>
                  <h2 className="text-label-md font-bold tracking-wide text-on-surface uppercase">
                    {t('newsPage.tags')}
                  </h2>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {n.tags.map((tag) => (
                      <li
                        key={tag}
                        className="rounded-full bg-badge-sage-bg px-3 py-1.5 text-label-sm font-medium text-badge-sage-text"
                      >
                        #{tag}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <NewsPeople news={n} catalogs={sections.catalogs} />
              <NewsShare title={n.title} url={articleUrl} newsId={n.id} />
            </div>
            <div className={`${NEWS_PANEL} lg:sticky lg:top-24 lg:self-start`}>
              <LatestNews excludeId={n.id} />
            </div>
          </div>
        </div>
      </article>
      <div className="container-page pb-10">
        <div className={frame}>
          <MoreNews currentId={n.id} sectionName={sections.name} />
        </div>
      </div>
    </div>
  );
}

/** Otras noticias publicadas (sin la actual). */
function MoreNews({
  currentId,
  sectionName,
}: {
  currentId: number;
  sectionName: (id: number) => string | undefined;
}) {
  const { t } = useTranslation('home');
  const list = useQuery({ queryKey: ['public-news', 5], queryFn: () => newsApi.publicList(5), retry: false });
  const others = (list.data ?? []).filter((n: News) => n.id !== currentId).slice(0, 3);
  if (!others.length) return null;
  return (
    <section aria-labelledby="more-news" className="mt-16 border-t border-border-subtle pt-12">
      <SectionTitle
        id="more-news"
        action={
          <Link to="/noticias" className="text-label-md font-bold text-primary-container hover:underline">
            {t('newsHome.viewAll')}
          </Link>
        }
      >
        {t('newsPage.moreNews')}
      </SectionTitle>
      <ul className="grid gap-8 md:grid-cols-3">
        {others.map((n) => (
          <li key={n.id}>
            <NewsCard news={n} section={sectionName(n.category_id)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Personas de la noticia, identificadas por ORCID: nombre y cargo salen de su perfil público. */
function NewsPeople({ news, catalogs }: { news: News; catalogs?: Catalogs }) {
  const { t } = useTranslation('home');
  if (!news.people.length) return null;
  const role = (code: string) => catalogs?.relationship_types.find((r) => r.code === code)?.name ?? null;
  return (
    <section aria-labelledby="news-people" className="mt-12">
      <SectionTitle id="news-people">{t('newsPage.people')}</SectionTitle>
      <ul className="grid gap-4 sm:grid-cols-2">
        {news.people.map((p) => (
          <PersonCard key={`${p.orcid}-${p.relationship_type}`} person={p} role={role(p.relationship_type)} />
        ))}
      </ul>
    </section>
  );
}

function PersonCard({ person, role }: { person: NewsPerson; role: string | null }) {
  const { t } = useTranslation('home');
  const profile = useOrcidProfile(person.orcid);
  const current = profile.data ? currentAffiliation(profile.data) : null;
  return (
    <li className="flex gap-4 rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 shadow-sm">
      <span
        aria-hidden="true"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-label-md font-bold text-white"
      >
        iD
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-on-surface">
          {profile.data?.displayName ?? person.orcid}
        </span>
        {role && <span className="block text-label-sm font-semibold text-secondary">{role}</span>}
        {current && (
          <span className="block text-body-sm text-on-surface-variant">
            {[current.role, current.organization].filter(Boolean).join(' · ')}
          </span>
        )}
        <a
          href={orcidUrl(person.orcid)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex text-label-sm font-semibold text-primary-container hover:underline"
        >
          {t('newsPage.orcidProfile')}{' '}
          <span className="sr-only">: {profile.data?.displayName ?? person.orcid}</span>
        </a>
      </span>
    </li>
  );
}
