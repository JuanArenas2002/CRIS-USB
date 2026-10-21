import { withBaseUrl } from '@/shared/base';
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

/** Top 3 de cada centro en el ranking USB: mismo estilo sobrio; el puesto lo dice el número. */
const MEDAL = [
  'bg-white text-primary-container ring-primary-container/50',
  'bg-white text-primary-container ring-primary-container/50',
  'bg-white text-primary-container ring-primary-container/50',
];
/** Clase de medalla para un puesto en el centro (undefined fuera del top 3). */
export const medalFor = (centerRank: number | null | undefined) =>
  centerRank && centerRank <= 3 ? MEDAL[centerRank - 1] : undefined;

/** "Maestría/Magister" → "Maestría". */
export const shortDegree = (d: string | null) => (d ? d.split('/')[0]!.trim() : null);

const card =
  'group relative flex flex-col rounded-[24px] bg-surface-container-lowest p-5 shadow-[0_4px_20px_-2px_rgba(21,71,52,0.06),0_2px_6px_-1px_rgba(0,0,0,0.03)]';

/**
 * Tarjeta en tres niveles de lectura:
 * 1. Quién es: retrato, categoría, nombre y grupo principal.
 * 2. Cuánto produce: índice USB destacado, con su puesto en el centro y el general.
 * 3. Detalle: cifras clave y, al pie, centros e identificadores (logos enlazados).
 * Toda la tarjeta enlaza al perfil (pseudo-elemento del nombre); los identificadores van por encima.
 */
export function AuthorCard({ author }: { author: Author }) {
  const href = `/investigadores/${authorSlug(author)}`;
  const name = displayName(author.name);
  const ids = externalProfiles(author);
  const cat = categoryOf(author.category);
  const { t } = useTranslation('authors');
  const labels = useLabels();
  const r = author.ranking;
  const centerRank = r?.center && r.centerRank ? r.centerRank : null;
  const medal = medalFor(centerRank);
  const degree = shortDegree(author.degree && labels.domain(author.degree));
  const stats = author.metrics
    ? [
        {
          icon: 'article',
          label: t('card.publications'),
          value: labels.number(author.metrics.scopusPublications),
        },
        { icon: 'show_chart', label: t('card.hIndexShort'), value: author.metrics.hIndex ?? '—' },
        { icon: 'menu_book', label: t('card.products'), value: labels.number(author.metrics.products) },
      ]
    : [
        { icon: 'workspace_premium', label: t('mincienciasCategory'), value: cat?.code ?? '—' },
        { icon: 'school', label: t('card.degree'), value: degree ?? '—' },
      ];

  return (
    <article
      className={`${card} transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_32px_-6px_rgba(21,71,52,0.16)] motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
    >
      {/* Nivel 1: identidad */}
      <div className="flex items-start gap-4">
        <div aria-hidden="true" className="relative shrink-0">
          <div className="h-24 w-24 overflow-hidden rounded-2xl bg-badge-sage-bg shadow-sm ring-1 ring-border-subtle">
            {author.photoUrl ? (
              <img
                src={withBaseUrl(author.photoUrl)}
                alt=""
                width={192}
                height={192}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-surface-dark-forest text-[28px] font-bold tracking-tight text-secondary-fixed">
                {initials(name)}
              </span>
            )}
          </div>
          {medal ? (
            <span
              className={`absolute -right-2 -bottom-2 flex h-8 w-8 items-center justify-center rounded-full shadow-md ring-[3px] ring-surface-container-lowest ${medal}`}
            >
              <Icon name="emoji_events" className="text-[17px]" />
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[11px] font-semibold tracking-wider text-secondary uppercase">
            {labels.researcher(author.category)}
          </p>
          <h3 className="mt-1.5 text-[18px] leading-snug font-bold tracking-tight text-[#0F241A] transition-colors group-hover:text-primary">
            {/* El enlace del nombre cubre toda la tarjeta sin anidar controles. */}
            <Link
              to={href}
              className="line-clamp-2 after:absolute after:inset-0 after:rounded-[24px] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-secondary"
            >
              {name}
            </Link>
          </h3>
          <p
            className="mt-1 flex items-center gap-1.5 text-label-md text-neutral-muted"
            title={author.mainGroup?.name}
          >
            <Icon name="groups" className="text-[16px] text-secondary" />
            <span className="truncate">{author.mainGroup?.name ?? 'Universidad Simón Bolívar'}</span>
          </p>
        </div>
      </div>

      {/* Nivel 2: indicador principal (ranking USB) */}
      {r ? (
        <div className="mt-5 rounded-2xl bg-metric-bg p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-neutral-muted uppercase">
                {t('card.usbIndex')}
              </p>
              <p className="mt-1 leading-none text-primary">
                <span className="text-[32px] font-bold tracking-tight tabular-nums">
                  {labels.number(r.index)}
                </span>
                <span className="text-label-md font-semibold text-neutral-muted"> / 100</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 text-right">
              {centerRank ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-label-sm font-bold ${
                    medal ? `shadow-sm ring-1 ${medal}` : 'bg-badge-sage-bg text-badge-sage-text'
                  }`}
                >
                  <Icon name={medal ? 'emoji_events' : 'military_tech'} className="text-[15px]" />
                  {t('card.centerRank', { rank: centerRank, center: r.center })}
                </span>
              ) : null}
              <span className="text-label-sm font-semibold text-neutral-muted">
                {t('card.generalRank', { rank: r.rank })}
              </span>
            </div>
          </div>
          <div
            role="meter"
            aria-label={t('card.usbIndex')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={r.index}
            className="mt-3 h-2 overflow-hidden rounded-full bg-secondary/15"
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, Math.max(0, r.index))}%` }}
            />
          </div>
        </div>
      ) : null}

      {/* Nivel 3: cifras clave */}
      <dl
        className={`mt-4 grid divide-x divide-surface-container rounded-2xl border border-surface-container ${
          stats.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
        }`}
      >
        {stats.map((s) => (
          // Cifra primero (lo que se escanea) y rótulo debajo, sin cortar: con guiones si no cabe.
          <div key={s.label} className="flex min-w-0 flex-col-reverse gap-0.5 px-3 py-3">
            <dt className="flex items-center gap-1 text-[11px] leading-tight font-medium hyphens-auto text-neutral-muted">
              <Icon name={s.icon} className="text-[13px] text-secondary" />
              <span className="min-w-0">{s.label}</span>
            </dt>
            <dd className="truncate text-[20px] leading-tight font-bold text-on-surface tabular-nums">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* Pie: centros e identificadores (logos; el nombre va en texto accesible y tooltip) */}
      {/* Espaciador: el pie queda alineado entre tarjetas de la misma fila. */}
      <div className="min-h-4 flex-1" />
      <div className="flex items-center justify-between gap-3 border-t border-surface-container pt-4">
        {author.centers?.length ? (
          <ul className="flex min-w-0 flex-wrap gap-1.5" aria-label={t('card.centers')}>
            {author.centers.map((c) => (
              <li
                key={c.id}
                title={c.name}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-subtle bg-white px-2 text-label-sm font-semibold text-on-surface-variant"
              >
                {c.logoUrl ? (
                  <img
                    src={withBaseUrl(c.logoUrl)}
                    alt=""
                    loading="lazy"
                    className="h-6 w-auto max-w-16 object-contain"
                  />
                ) : (
                  <Icon name="domain" className="text-[16px] text-secondary" />
                )}
                {c.logoUrl ? <span className="sr-only">{c.acronym ?? c.code}</span> : (c.acronym ?? c.code)}
                <span className="sr-only">{c.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span />
        )}
        {ids.length ? (
          <ul className="flex shrink-0 gap-1.5" aria-label={t('card.idsAvailable')}>
            {ids.map((p) => (
              <li key={p.label}>
                {/* Por encima del enlace que cubre la tarjeta (z-10): abre el perfil externo. */}
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener"
                  title={`${p.label}: ${labels.domain(p.value)}`}
                  className="relative z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-border-subtle bg-white transition-colors hover:border-secondary hover:bg-badge-sage-bg focus-visible:outline-2 focus-visible:outline-secondary"
                >
                  <IdLogo label={p.label} size={20} />
                  <span className="sr-only">
                    {p.label}
                    {t('card.externalProfile', { name })}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-label-sm text-neutral-muted">{t('card.noIds')}</span>
        )}
      </div>
    </article>
  );
}

export function AuthorCardSkeleton() {
  const bar = 'animate-pulse rounded bg-surface-cream-alt motion-reduce:animate-none';
  return (
    <div className={card}>
      <div className="flex items-start gap-4">
        <div className={`h-24 w-24 shrink-0 rounded-2xl ${bar}`} />
        <div className="flex flex-1 flex-col gap-2.5 pt-1">
          <div className={`h-4 w-1/3 rounded-full ${bar}`} />
          <div className={`h-5 w-4/5 ${bar}`} />
          <div className={`h-3.5 w-2/3 ${bar}`} />
        </div>
      </div>
      <div className={`mt-5 h-[92px] rounded-2xl ${bar}`} />
      <div className={`mt-4 h-[68px] rounded-2xl ${bar}`} />
      <div className={`mt-4 h-9 ${bar}`} />
    </div>
  );
}
