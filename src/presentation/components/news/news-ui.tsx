import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { newsApi, responsiveImage, type News } from '@/infrastructure/news/news-api';
import { Icon } from '@/presentation/components/ui/Icon';
import { Marker } from '@/presentation/components/ui/Trajectory';

/** Piezas comunes de la portada de noticias y de cada noticia (estructura de portal informativo). */

/** Tarjeta de datos de la guía de marca: blanca sobre linen, radio 16, borde de 1 px, sombra que sube al pasar. */
export const NEWS_CARD =
  'rounded-2xl border border-border-subtle bg-surface-container-lowest shadow-sm transition-shadow duration-200 hover:shadow-md';
/** Panel (lista o columna) con la misma piel que las tarjetas, sin la sombra de hover. */
export const NEWS_PANEL =
  'rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 shadow-sm sm:p-6';

export const newsPath = (slug: string) => `/noticias/${slug}`;
export const sectionPath = (categoryId: number) => `/noticias?seccion=${categoryId}`;

/** Nombres de las secciones (categorías): el catálogo es público. */
export function useNewsSections() {
  const catalogs = useQuery({
    queryKey: ['public-news', 'catalogs'],
    queryFn: newsApi.catalogs,
    retry: false,
  });
  const categories = catalogs.data?.categories ?? [];
  return {
    categories,
    catalogs: catalogs.data,
    name: (id: number) => categories.find((c) => c.id === id)?.name,
  };
}

/** "Hace 3 horas" hasta una semana; luego la fecha. */
export function timeAgo(iso: string | null, lang: string, now = Date.now()): string | null {
  if (!iso) return null;
  const seconds = (new Date(iso).getTime() - now) / 1000;
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const abs = Math.abs(seconds);
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
  if (abs < 7 * 86400) return rtf.format(Math.round(seconds / 86400), 'day');
  return new Date(iso).toLocaleDateString(lang, { dateStyle: 'medium' });
}

/** Minutos de lectura (200 palabras por minuto, mínimo 1). */
export const readingMinutes = (html: string) =>
  Math.max(
    1,
    Math.round(
      html
        .replace(/<[^>]*>/g, ' ')
        .split(/\s+/)
        .filter(Boolean).length / 200,
    ),
  );

/** Pie de tarjeta: "Sección | ⏱ 2 min". */
export function NewsMeta({ news, section }: { news: News; section?: string }) {
  const { t } = useTranslation('home');
  return (
    <span className="flex items-center gap-2 text-label-sm text-neutral-muted">
      {section && (
        <>
          <span className="font-bold text-on-surface">{section}</span>
          <span aria-hidden="true" className="h-3 w-px bg-outline-variant" />
        </>
      )}
      <span className="inline-flex items-center gap-1">
        <Icon name="schedule" className="text-[15px]" />
        {t('newsPage.readingTime', { count: readingMinutes(news.content) })}
      </span>
    </span>
  );
}

/**
 * Tarjeta de portada. La principal (`lead`) sigue la tarjeta mosaico de la marca: foto bajo un degradado forest
 * con el texto en blanco. Las demás son tarjetas de datos con la imagen arriba, recortada por la tarjeta. El
 * pie (sección y tiempo de lectura) queda siempre abajo, alineado entre tarjetas de la misma fila.
 */
export function NewsTile({ news, section, lead = false }: { news: News; section?: string; lead?: boolean }) {
  const { t } = useTranslation('home');
  if (lead)
    return (
      <Link
        to={newsPath(news.slug)}
        className="group relative flex h-full min-h-[26rem] flex-col justify-end overflow-hidden rounded-2xl bg-primary shadow-sm transition-shadow duration-200 hover:shadow-md lg:min-h-[32rem]"
      >
        <NewsImage
          news={news}
          eager
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="absolute inset-0 h-full w-full"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-b from-primary/0 via-primary/75 via-55% to-primary"
        />
        <span className="relative flex flex-col gap-4 p-6 sm:p-8">
          {section && (
            <span className="self-start rounded-full bg-badge-sage-bg px-3 py-1 text-label-sm font-semibold text-badge-sage-text">
              {section}
            </span>
          )}
          <span className="line-clamp-3 text-2xl leading-tight font-bold text-on-primary sm:text-4xl sm:leading-tight">
            {news.title}
          </span>
          <span className="line-clamp-2 text-body-lg text-primary-fixed">{news.summary}</span>
          <span className="flex flex-wrap items-center justify-between gap-3 border-t border-on-primary/15 pt-4 text-label-sm text-primary-fixed">
            <span className="inline-flex items-center gap-1">
              <Icon name="schedule" className="text-[15px]" />
              {t('newsPage.readingTime', { count: readingMinutes(news.content) })}
            </span>
            <span className="inline-flex items-center gap-1 text-label-md font-semibold text-secondary-fixed group-hover:underline">
              {t('newsSpotlight.read')} <span aria-hidden="true">→</span>
            </span>
          </span>
        </span>
      </Link>
    );
  return (
    <Link to={newsPath(news.slug)} className={`group flex h-full flex-col overflow-hidden ${NEWS_CARD}`}>
      <NewsImage news={news} className="aspect-[16/10] w-full" />
      <span className="flex flex-1 flex-col gap-3 p-5">
        <span className="line-clamp-3 text-body-md leading-snug font-bold text-primary group-hover:underline">
          {news.title}
        </span>
        <span className="mt-auto pt-2">
          <NewsMeta news={news} section={section} />
        </span>
      </span>
    </Link>
  );
}

/** Encabezado de sección: punto marcador de la marca y título en tipo oración, sobre una línea de 1 px. */
export function SectionTitle({
  id,
  children,
  action,
}: {
  id?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 border-b border-border-subtle pb-3">
      <h2 id={id} className="flex items-center gap-2.5 text-headline-sm font-bold text-primary">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-secondary" />
        {children}
      </h2>
      {action}
    </div>
  );
}

/** Antetítulo: la sección de la noticia. */
export const Kicker = ({ children }: { children: ReactNode }) => (
  <span className="text-label-sm font-bold tracking-[0.16em] text-secondary uppercase">{children}</span>
);

/** `sizes`: ancho real en pantalla (el navegador elige la versión WebP más pequeña que lo cubra). */
export function NewsImage({
  news,
  className = '',
  eager = false,
  sizes = '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw',
}: {
  news: News;
  className?: string;
  eager?: boolean;
  sizes?: string;
}) {
  const img = responsiveImage(news.image_url, 640);
  return (
    <span className={`block overflow-hidden bg-primary ${className}`}>
      {img ? (
        <img
          src={img.src}
          srcSet={img.srcSet}
          sizes={sizes}
          width={640}
          height={360}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : undefined}
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
        />
      ) : (
        <Marker />
      )}
    </span>
  );
}

/**
 * Tarjeta de noticia. `stack`: imagen arriba (rejilla). `row`: imagen a la izquierda y texto a la derecha.
 * Toda la tarjeta es un solo enlace (un solo punto de tabulación).
 */
export function NewsCard({
  news,
  section,
  layout = 'stack',
}: {
  news: News;
  section?: string;
  layout?: 'stack' | 'row';
}) {
  const { i18n } = useTranslation();
  const when = timeAgo(news.published_at, i18n.language);
  const row = layout === 'row';
  return (
    <Link
      to={newsPath(news.slug)}
      className={`group flex h-full ${row ? 'flex-row items-start gap-4' : `flex-col overflow-hidden ${NEWS_CARD}`}`}
    >
      <NewsImage
        news={news}
        sizes={row ? '160px' : undefined}
        className={row ? 'aspect-[4/3] w-32 shrink-0 rounded-[10px] sm:w-40' : 'aspect-[16/10] w-full'}
      />
      <span className={`flex min-w-0 flex-1 flex-col gap-1.5 ${row ? '' : 'p-5'}`}>
        {section && <Kicker>{section}</Kicker>}
        <span
          className={`font-bold text-primary group-hover:underline ${row ? 'line-clamp-3 text-body-md' : 'line-clamp-3 text-headline-sm'}`}
        >
          {news.title}
        </span>
        {!row && <span className="line-clamp-2 text-body-sm text-on-surface-variant">{news.summary}</span>}
        <span className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${row ? '' : 'mt-auto pt-2'}`}>
          <NewsMeta news={news} />
          {when && <span className="text-label-sm text-neutral-muted">{when}</span>}
        </span>
      </span>
    </Link>
  );
}

/** Columna "Lo último": las más recientes por fecha de publicación, con hora relativa. */
export function LatestNews({ excludeId, limit = 6 }: { excludeId?: number; limit?: number }) {
  const { t, i18n } = useTranslation('home');
  const list = useQuery({
    queryKey: ['public-news', 'latest'],
    queryFn: () => newsApi.publicList(12),
    retry: false,
  });
  const items = [...(list.data ?? [])]
    .filter((n) => n.id !== excludeId)
    .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
    .slice(0, limit);
  if (!items.length) return null;
  return (
    <section aria-labelledby="latest-news">
      <SectionTitle id="latest-news">{t('newsHome.latest')}</SectionTitle>
      <ol className="flex flex-col">
        {items.map((n) => (
          <li key={n.id} className="border-b border-border-subtle last:border-b-0">
            <Link to={newsPath(n.slug)} className="group flex gap-3 py-3">
              <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-secondary" />
              <span className="min-w-0">
                <span className="block text-label-sm font-semibold text-secondary">
                  {timeAgo(n.published_at, i18n.language)}
                </span>
                <span className="line-clamp-3 text-body-sm font-semibold text-on-surface group-hover:text-primary-container group-hover:underline">
                  {n.title}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
