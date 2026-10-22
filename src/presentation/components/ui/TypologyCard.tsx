import { useTranslation } from 'react-i18next';
import { TYPOLOGIES, type TypologyId } from '@/domain/authors/author';
import { useLabels } from '@/presentation/hooks/use-labels';
import { Icon } from './Icon';

/**
 * Color por tipología Minciencias (plantilla de grupo): verde institucional, índigo, cielo y
 * ámbar. El color sigue a la tipología en todo el portal (tarjetas, insignias, iconos), nunca al orden.
 */
export const TYPOLOGY_STYLE: Record<
  TypologyId,
  { bar: string; hover: string; iconBox: string; value: string; chip: string; link: string }
> = {
  GNC: {
    bar: 'bg-[#16834B]',
    hover: 'hover:border-secondary',
    iconBox: 'bg-badge-sage-bg text-secondary',
    value: 'text-secondary',
    chip: 'bg-badge-sage-bg text-secondary',
    link: 'text-secondary',
  },
  DTI: {
    bar: 'bg-[#4F46E5]',
    hover: 'hover:border-[#4F46E5]',
    iconBox: 'bg-surface-cream-alt text-primary-container',
    value: 'text-primary',
    chip: 'bg-surface-cream-alt text-primary',
    link: 'text-secondary',
  },
  ASC: {
    bar: 'bg-sky-600',
    hover: 'hover:border-sky-600',
    iconBox: 'bg-sky-50 text-sky-700',
    value: 'text-sky-800',
    chip: 'bg-sky-100 text-sky-800',
    link: 'text-sky-700',
  },
  FRH: {
    bar: 'bg-amber-600',
    hover: 'hover:border-amber-600',
    iconBox: 'bg-amber-50 text-amber-700',
    value: 'text-amber-800',
    chip: 'bg-amber-100 text-amber-900',
    link: 'text-amber-800',
  },
};

/** Tarjeta de tipología: barra de color, conteo, participación sobre el total y acceso al listado. */
export function TypologyCard({
  typology,
  count,
  total,
  loading = false,
  onExplore,
}: {
  typology: TypologyId;
  count: number;
  total: number;
  loading?: boolean;
  onExplore: () => void;
}) {
  const { t } = useTranslation(['authors', 'common']);
  const labels = useLabels();
  const icon = TYPOLOGIES.find((x) => x.id === typology)!.icon;
  const label = labels.typology(typology);
  const s = TYPOLOGY_STYLE[typology];
  return (
    <div
      className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border-subtle/80 bg-canvas-cream p-5 transition-all hover:shadow-md ${s.hover}`}
    >
      <span aria-hidden="true" className={`absolute top-0 right-0 left-0 h-1 ${s.bar}`} />
      <div>
        <span
          className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${s.iconBox}`}
        >
          <Icon name={icon} className="text-[24px]" />
        </span>
        <h3 className="text-headline-sm leading-tight font-semibold text-primary">{label}</h3>
      </div>
      <div className="mt-5 rounded-xl border border-border-subtle/50 bg-surface-container-lowest p-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="flex items-baseline gap-2">
            <span className={`text-stat-metric font-bold ${s.value}`}>
              {loading ? '—' : labels.number(count)}
            </span>
            <span className="text-label-sm font-medium text-neutral-muted">
              {t('typologyCard.product', { count })}
            </span>
          </p>
          {!loading && total ? (
            <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${s.chip}`}>
              {labels.percent(count / total)}
            </span>
          ) : null}
        </div>
        {count ? (
          <button
            type="button"
            onClick={onExplore}
            aria-label={t('typologyCard.exploreLabel', { typology: label, count })}
            className={`mt-2.5 inline-flex w-full items-center justify-between border-t border-border-subtle/40 pt-2 text-label-md font-semibold transition-colors hover:text-primary ${s.link}`}
          >
            {t('typologyCard.explore')} <Icon name="arrow_forward" className="text-[16px]" />
          </button>
        ) : (
          <p className="mt-2.5 border-t border-border-subtle/40 pt-2 text-label-md text-neutral-muted">
            {loading ? t('common:loading') : t('typologyCard.empty')}
          </p>
        )}
      </div>
    </div>
  );
}
