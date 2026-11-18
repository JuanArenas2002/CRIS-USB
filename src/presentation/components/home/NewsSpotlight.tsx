import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { newsApi, responsiveImage } from '@/infrastructure/news/news-api';
import { Icon } from '@/presentation/components/ui/Icon';

const SHOWN = 5;
const arrow =
  'flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant ring-1 ring-outline-variant transition-colors hover:bg-badge-sage-bg hover:text-primary-container';

export const newsPath = (slug: string) => `/noticias/${slug}`;

/**
 * Tarjeta compacta del hero: foto a la izquierda; título, fecha y resumen a la derecha.
 * Noticias publicadas y vigentes (fijadas y prioritarias primero). Se piden en el navegador (no en el
 * prerender): sin noticias, la tarjeta no se muestra.
 */
export function NewsSpotlight() {
  const { t, i18n } = useTranslation('home');
  const { data } = useQuery({
    queryKey: ['public-news', SHOWN],
    queryFn: () => newsApi.publicList(SHOWN),
    retry: false,
  });
  const [index, setIndex] = useState(0);
  const items = data ?? [];
  const news = items[index % (items.length || 1)];
  if (!news) return null;
  const image = responsiveImage(news.image_url, 640);
  const move = (step: number) => setIndex((index + step + items.length) % items.length);
  const date = news.published_at
    ? new Date(news.published_at).toLocaleDateString(i18n.language, { dateStyle: 'medium' })
    : null;

  return (
    <aside
      aria-label={t('newsSpotlight.label')}
      className="w-full max-w-lg rounded-2xl border border-surface-container bg-surface-container-lowest/95 p-4 shadow-2xl backdrop-blur-md sm:p-5"
    >
      <p className="mb-3 flex items-center gap-2">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-secondary motion-reduce:animate-none" />
        <span className="rounded-full bg-badge-sage-bg px-2.5 py-0.5 text-label-sm font-bold tracking-wider text-badge-sage-text uppercase">
          {t('newsSpotlight.label')}
        </span>
        <Link
          to="/noticias"
          className="ml-auto text-label-sm font-semibold text-primary-container hover:underline"
        >
          {t('newsHome.viewAll')}
        </Link>
      </p>

      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-4">
        <Link
          to={newsPath(news.slug)}
          tabIndex={-1}
          aria-hidden="true"
          className="group block aspect-[4/5] overflow-hidden rounded-2xl bg-badge-sage-bg"
        >
          {image ? (
            <img
              src={image.src}
              srcSet={image.srcSet}
              sizes="(min-width: 1024px) 220px, 40vw"
              width={400}
              height={500}
              alt={news.image_caption ?? ''}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
              decoding="async"
            />
          ) : (
            <span className="flex h-full items-center justify-center text-primary-container">
              <Icon name="newspaper" className="text-[40px]" />
            </span>
          )}
        </Link>

        <div aria-live="polite" className="flex min-w-0 flex-col gap-2">
          <h2 className="line-clamp-3 text-headline-sm font-bold text-on-surface">
            <Link to={newsPath(news.slug)} className="hover:text-primary-container hover:underline">
              {news.title}
            </Link>
          </h2>
          {date && (
            <p className="flex items-center gap-1.5 text-label-sm text-neutral-muted">
              <Icon name="calendar_today" className="text-[14px]" />
              <time dateTime={news.published_at!}>{date}</time>
            </p>
          )}
          <p className="line-clamp-4 text-body-sm text-on-surface-variant">{news.summary}</p>
          <Link
            to={newsPath(news.slug)}
            aria-label={`${t('newsSpotlight.read')}: ${news.title}`}
            className="inline-flex min-h-9 items-center gap-1 text-body-sm font-semibold text-primary-container hover:underline"
          >
            {t('newsSpotlight.read')} <Icon name="arrow_forward" className="text-[18px]" />
          </Link>
        </div>
      </div>

      {items.length > 1 ? (
        <div className="mt-3 flex items-center justify-end gap-2 border-t border-surface-container pt-3">
          <button
            type="button"
            aria-label={t('newsSpotlight.previous')}
            onClick={() => move(-1)}
            className={arrow}
          >
            <Icon name="chevron_left" className="text-[20px]" />
          </button>
          <span className="text-label-md font-semibold text-neutral-muted tabular-nums">
            {(index % items.length) + 1} / {items.length}
          </span>
          <button
            type="button"
            aria-label={t('newsSpotlight.next')}
            onClick={() => move(1)}
            className={arrow}
          >
            <Icon name="chevron_right" className="text-[20px]" />
          </button>
        </div>
      ) : null}
    </aside>
  );
}
