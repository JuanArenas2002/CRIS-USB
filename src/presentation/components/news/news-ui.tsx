import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { newsApi, responsiveImage, type News } from '@/infrastructure/news/news-api';
import { Icon } from '@/presentation/components/ui/Icon';

/** Piezas comunes de la portada de noticias y de cada noticia (estructura de portal informativo). */

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
 * Tarjeta blanca de portada: imagen arriba, título y (en la principal) resumen; el pie con sección y
 * tiempo de lectura queda siempre abajo, alineado entre tarjetas de la misma fila.
 */
export function NewsTile({ news, section, lead = false }: { news: News; section?: string; lead?: boolean }) {
  return (
    <Link
      to={newsPath(news.slug)}
      className="group flex h-full flex-col overflow-hidden bg-surface-container-lowest shadow-sm transition-shadow hover:shadow-md"
    >
      <NewsImage
        news={news}
        eager={lead}
        sizes={lead ? '(min-width: 1024px) 66vw, 100vw' : undefined}
        className="aspect-[16/9] w-full"
      />
      <span className={`flex flex-1 flex-col ${lead ? 'gap-5 p-6 sm:p-8' : 'gap-3 p-4'}`}>
        <span
          className={`font-extrabold text-on-surface group-hover:underline ${
            lead
              ? 'line-clamp-3 text-2xl leading-tight sm:text-4xl sm:leading-tight'
              : 'line-clamp-3 text-body-md leading-snug'
          }`}
        >
          {news.title}
        </span>
        {lead && <span className="line-clamp-2 text-body-lg text-on-surface-variant">{news.summary}</span>}
        <span className="mt-auto pt-2">
          <NewsMeta news={news} section={section} />
        </span>
      </span>
    </Link>
  );
}

/** Encabezado de sección: barra de color + título en mayúsculas. */
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
    <div className="mb-5 flex items-end justify-between gap-4 border-b-2 border-on-surface pb-2">
      <h2
        id={id}
        className="flex items-center gap-3 text-headline-sm font-extrabold tracking-wide text-on-surface uppercase"
      >
        <span aria-hidden="true" className="h-6 w-1.5 rounded-full bg-secondary" />
        {children}
      </h2>
      {action}
    </div>
  );
}

/** Antetítulo: la sección de la noticia. */
export const Kicker = ({ children }: { children: ReactNode }) => (
  <span className="text-label-sm font-extrabold tracking-wider text-secondary uppercase">{children}</span>
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
    <span className={`block overflow-hidden bg-badge-sage-bg ${className}`}>
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
        <span className="flex h-full items-center justify-center text-primary-container">
          <Icon name="newspaper" className="text-[40px]" />
        </span>
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
      className={`group flex h-full gap-4 ${row ? 'flex-row items-start' : 'flex-col'}`}
    >
      <NewsImage
        news={news}
        sizes={row ? '160px' : undefined}
        className={row ? 'aspect-[4/3] w-32 shrink-0 rounded-xl sm:w-40' : 'aspect-video w-full rounded-xl'}
      />
      <span className="flex min-w-0 flex-col gap-1.5">
        {section && <Kicker>{section}</Kicker>}
        <span
          className={`font-bold text-on-surface group-hover:text-primary-container group-hover:underline ${row ? 'line-clamp-3 text-body-md' : 'line-clamp-3 text-headline-sm'}`}
        >
          {news.title}
        </span>
        {!row && <span className="line-clamp-2 text-body-sm text-on-surface-variant">{news.summary}</span>}
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
