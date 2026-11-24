// Pestaña «Perfil»: indicadores (índice H, publicaciones, citas) y producción por tipología y por año.
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { TYPOLOGIES, toProducts, type AuthorMetrics, type TypologyId } from '@/domain/authors/author';
import { ProductionByYear } from '@/presentation/components/authors/ProductionByYear';
import { Icon } from '@/presentation/components/ui/Icon';
import { TypologyCard } from '@/presentation/components/ui/TypologyCard';
import { useLabels } from '@/presentation/hooks/use-labels';
import { card, eyebrow } from './styles';

type Products = ReturnType<typeof toProducts>;

interface Props {
  metrics: AuthorMetrics | null;
  products: Products;
  citations: number;
  onExploreTypology: (typology: TypologyId) => void;
}

export function ProfileIndicators({ metrics, products, citations, onExploreTypology }: Props) {
  return (
    <div className="flex flex-col gap-gutter">
      <div className="flex flex-col gap-gutter">
        <div className="flex flex-col gap-gutter">
          {metrics ? <Indicators metrics={metrics} citations={citations} /> : <NoIndicators />}
        </div>
      </div>
      {metrics ? <ProductionBreakdown products={products} onExploreTypology={onExploreTypology} /> : null}
    </div>
  );
}

function Indicators({ metrics, citations }: { metrics: AuthorMetrics; citations: number }) {
  const { t } = useTranslation(['authors', 'common']);
  return (
    <>
      <SectionTitle icon="insights">{t('profile.indicatorsTitle')}</SectionTitle>
      <div className="grid gap-gutter sm:grid-cols-3">
        <Kpi label={t('profile.hIndex')} value={metrics.hIndex ?? '—'} icon="show_chart" />
        <Kpi
          label={t('profile.indexed')}
          value={metrics.scopusPublications}
          unit={t('profile.articles', { count: metrics.scopusPublications })}
          icon="article"
        />
        <Kpi label={t('profile.citations')} value={citations} icon="auto_graph" />
      </div>
    </>
  );
}

function NoIndicators() {
  const { t } = useTranslation(['authors', 'common']);
  return (
    <div className={`${card} p-6`}>
      <SectionTitle icon="insights">{t('profile.indicatorsShort')}</SectionTitle>
      <p className="mt-2 text-body-md text-neutral-muted">{t('profile.indicatorsNone')}</p>
    </div>
  );
}

function ProductionBreakdown({
  products,
  onExploreTypology,
}: {
  products: Products;
  onExploreTypology: (typology: TypologyId) => void;
}) {
  const { t } = useTranslation(['authors', 'common']);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-2 pt-2">
        <div>
          <h2 className="text-headline-sm font-semibold text-primary-container">
            {t('profile.byTypologyTitle')}
          </h2>
          <p className="text-body-sm text-neutral-muted">{t('profile.byTypologyLead')}</p>
        </div>
        <span className="rounded-full bg-primary-container px-3 py-1 text-label-md font-semibold text-on-primary">
          {t('profile.totalProducts', { count: products.length })}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 xl:grid-cols-4">
        {TYPOLOGIES.map((typology) => (
          <TypologyCard
            key={typology.id}
            typology={typology.id}
            count={products.filter((p) => p.typology === typology.id).length}
            total={products.length}
            onExplore={() => onExploreTypology(typology.id)}
          />
        ))}
      </div>
      <ProductionByYear products={products} />
    </>
  );
}

function Kpi({
  label,
  value,
  unit,
  icon,
}: {
  label: string;
  value: number | string;
  unit?: string;
  icon: string;
}) {
  const { t } = useTranslation(['authors', 'common']);
  const { number } = useLabels();
  return (
    <div
      className={`${card} relative flex flex-col justify-between overflow-hidden p-4 transition-shadow hover:shadow-md`}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className={eyebrow}>{label}</span>
          <p className="mt-1 flex items-baseline gap-2 text-display-hero-mobile font-bold text-primary-container md:text-display-hero">
            {typeof value === 'number' ? number(value) : value}
            {unit ? <span className="text-body-md font-semibold text-neutral-muted">{unit}</span> : null}
          </p>
        </div>
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-badge-sage-bg text-primary-container">
          <Icon name={icon} className="text-[26px]" />
        </span>
      </div>
      <p className="mt-2 rounded-lg bg-surface-cream-alt/60 p-2.5 text-label-sm font-medium text-on-surface-variant">
        {t('profile.source')}
      </p>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-headline-sm font-semibold text-primary-container">
      <Icon name={icon} className="text-[22px] text-secondary" /> {children}
    </h2>
  );
}
