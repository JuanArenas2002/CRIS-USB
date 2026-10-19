import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  authorSlug,
  categoryOf,
  displayName,
  externalProfiles,
  initials,
  type Author,
} from '@/domain/authors/author';
import { Icon } from '@/presentation/components/ui/Icon';
import { IdLogo } from '@/presentation/components/ui/IdLogo';
import { useLabels } from '@/presentation/hooks/use-labels';

/** "Maestría/Magister" → "Maestría". */
export const shortDegree = (d: string | null) => (d ? d.split('/')[0]!.trim() : null);

/** Tarjeta con la misma anatomía que la plantilla; cada dato sale de Metri-K. */
export function AuthorCard({ author }: { author: Author }) {
  const href = `/investigadores/${authorSlug(author)}`;
  const name = displayName(author.name);
  const ids = externalProfiles(author);
  const cat = categoryOf(author.category);
  const { t } = useTranslation('authors');
  const labels = useLabels();

  return (
    <article className="group relative flex flex-col justify-between rounded-[24px] bg-surface-container-lowest p-4 shadow-[0_4px_20px_-2px_rgba(21,71,52,0.06),0_2px_6px_-1px_rgba(0,0,0,0.03)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_28px_-4px_rgba(21,71,52,0.12)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex flex-col">
        {/* Retrato: foto asignada en /admin/fotos; si no hay, monograma sobre el mismo marco de la plantilla. */}
        <div
          aria-hidden="true"
          className="relative h-72 w-full overflow-hidden rounded-[20px] bg-gradient-to-br from-badge-sage-bg via-[#d5e4d8] to-[#b9d1c2]"
        >
          {author.photoUrl ? (
            <img
              src={author.photoUrl}
              alt=""
              width={512}
              height={512}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
            />
          ) : (
            <Monogram name={name} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
          <span className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-[#0E382B]/90 px-3 py-1 text-label-sm font-semibold tracking-wide text-surface-container-lowest shadow-sm backdrop-blur-md">
            {author.mainGroup?.name ?? 'Universidad Simón Bolívar'}
          </span>
        </div>

        <div className="pt-4 pb-2">
          <h3 className="text-headline-sm font-bold tracking-tight text-[#0F241A] transition-colors group-hover:text-primary">
            {/* El enlace del título cubre toda la tarjeta (pseudo-elemento) sin anidar controles. */}
            <Link
              to={href}
              className="after:absolute after:inset-0 after:rounded-[24px] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-secondary"
            >
              {name}
            </Link>
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-body-sm text-neutral-muted">
            <Icon name="person" className="text-[18px] text-primary" />
            {labels.researcher(author.category)}
          </p>
        </div>

        <div className="relative my-2 py-1">
          <Icon
            name="school"
            className="pointer-events-none absolute top-1/2 right-0 -translate-y-1/2 text-[64px] text-primary opacity-10"
          />
          <p className="mb-2 inline-flex items-center gap-1 rounded-md bg-badge-sage-bg px-2.5 py-0.5 text-label-sm font-semibold text-badge-sage-text">
            <Icon name="link" className="text-[15px]" /> {t('card.scientificIds')}
          </p>
          {ids.length ? (
            <ul className="flex flex-wrap gap-1.5 pr-8" aria-label={t('card.idsAvailable')}>
              {ids.map((p) => (
                <li key={p.label}>
                  {/* Por encima del enlace que cubre la tarjeta (z-10): abre el perfil externo, no el del portal. */}
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener"
                    title={`${p.label}: ${labels.domain(p.value)}`}
                    className="relative z-10 inline-flex items-center gap-1.5 rounded-md bg-surface-cream-alt py-0.5 pr-2.5 pl-1 text-[12px] text-on-surface-variant transition-colors hover:bg-badge-sage-bg hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-secondary"
                  >
                    <IdLogo label={p.label} size={16} />
                    {p.label}
                    <span className="sr-only">{t('card.externalProfile', { name })}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pr-8 text-[12px] text-neutral-muted">{t('card.noIds')}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {/* Destacados: mismas métricas que la plantilla (publicaciones + índice H). Resto: categoría. */}
        <MetricBox
          headline={
            author.metrics
              ? { icon: 'feed', label: t('card.publications'), value: author.metrics.scopusPublications }
              : { icon: 'workspace_premium', label: t('mincienciasCategory'), value: cat?.code ?? '—' }
          }
          left={
            author.metrics
              ? { label: t('card.hIndex'), value: author.metrics.hIndex ?? '—' }
              : {
                  label: t('card.degree'),
                  value: shortDegree(author.degree && labels.domain(author.degree)) ?? '—',
                }
          }
          right={
            author.metrics
              ? { label: t('card.products'), value: author.metrics.products }
              : { label: t('card.ids'), value: ids.length }
          }
        />
        <span
          aria-hidden="true"
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-label-md font-semibold text-surface-container-lowest transition-colors group-hover:bg-secondary"
        >
          {t('card.viewProfile')} <Icon name="arrow_forward" className="text-[16px]" />
        </span>
      </div>
    </article>
  );
}

export function AuthorCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-[24px] bg-surface-container-lowest p-4">
      <div className="h-72 animate-pulse rounded-[20px] bg-surface-cream-alt motion-reduce:animate-none" />
      <div className="h-5 w-2/3 animate-pulse rounded bg-surface-cream-alt motion-reduce:animate-none" />
      <div className="h-4 w-1/3 animate-pulse rounded bg-surface-cream-alt motion-reduce:animate-none" />
      <div className="h-24 animate-pulse rounded-[14px] bg-surface-cream-alt motion-reduce:animate-none" />
      <div className="h-10 animate-pulse rounded-xl bg-surface-cream-alt motion-reduce:animate-none" />
    </div>
  );
}

interface Metric {
  label: string;
  value: string | number;
}

function MetricBox({
  headline,
  left,
  right,
}: {
  headline: Metric & { icon: string };
  left: Metric;
  right: Metric;
}) {
  const small = 'text-[10px] font-semibold tracking-wider text-neutral-muted uppercase';
  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] bg-metric-bg p-3">
      <div className="flex items-center justify-between border-b border-surface-container pb-2">
        <span className="flex items-center gap-2 text-label-md font-semibold text-primary-container">
          <Icon name={headline.icon} className="text-[20px] text-primary" /> {headline.label}
        </span>
        <span className="text-[26px] leading-none font-bold text-primary">{headline.value}</span>
      </div>
      <dl className="grid grid-cols-2 gap-2 pt-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <Icon name="trending_up" className="text-[20px] text-secondary" />
          <div className="flex min-w-0 flex-col">
            <dt className={small}>{left.label}</dt>
            <dd className="truncate text-[15px] leading-tight font-bold text-on-surface">{left.value}</dd>
          </div>
        </div>
        <div className="flex flex-col border-l border-surface-container pl-3">
          <dt className={small}>{right.label}</dt>
          <dd className="text-[15px] leading-tight font-bold text-on-surface">{right.value}</dd>
        </div>
      </dl>
    </div>
  );
}

function Monogram({ name }: { name: string }) {
  return (
    <>
      <svg
        className="absolute inset-0 h-full w-full text-primary-container/40"
        fill="none"
        viewBox="0 0 400 300"
      >
        <path
          d="M-20 210C80 150 170 260 260 190C350 120 380 200 440 160"
          stroke="currentColor"
          strokeWidth="2.5"
          className="wave-drift"
        />
        <path
          d="M-20 90C90 150 200 40 300 110C360 150 400 90 440 70"
          stroke="currentColor"
          strokeDasharray="6 6"
          strokeWidth="2"
          className="wave-dash"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pb-6">
        <span className="flex h-28 w-28 items-center justify-center rounded-full bg-surface-dark-forest text-[38px] font-bold tracking-tight text-secondary-fixed shadow-[0_10px_30px_-8px_rgba(14,56,43,0.55)] ring-8 ring-white/55 transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none">
          {initials(name)}
        </span>
      </div>
    </>
  );
}
