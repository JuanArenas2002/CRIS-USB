// Pestaña «Perfil» del grupo: datos institucionales, líneas y ODS, indicadores, trayectoria y producción por tipología.
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { TYPOLOGIES, displayName, type Product, type TypologyId } from '@/domain/authors/author';
import type { GroupDetail, GroupMember } from '@/domain/groups/group';
import { CategoryTimeline } from '@/presentation/components/groups/CategoryTimeline';
import { GroupCenters } from '@/presentation/components/groups/GroupCenters';
import { OdsLinked } from '@/presentation/components/groups/OdsIcons';
import { categoryTone } from '@/presentation/components/groups/category-tone';
import { Icon } from '@/presentation/components/ui/Icon';
import { Field, InfoColumn, SectionHead } from '@/presentation/components/ui/InfoBlocks';
import { TypologyCard } from '@/presentation/components/ui/TypologyCard';
import { useLabels } from '@/presentation/hooks/use-labels';
import { yearsSince } from '@/shared/years';
import { campusLabel, countArticles, foundedYearLabel } from './group-model';
import { ResearchLines } from './ResearchLines';
import { card } from './styles';

interface Props {
  group: GroupDetail;
  members: GroupMember[] | undefined;
  products: Product[];
  productionReady: boolean;
  /** «N de M integrantes con perfil publicado», o «Cargando…». */
  productionHint: string;
  onExploreTypology: (typology: TypologyId) => void;
}

export function GroupOverview({
  group,
  members,
  products,
  productionReady,
  productionHint,
  onExploreTypology,
}: Props) {
  const years = yearsSince(group.foundedYear);
  return (
    <div className="flex flex-col gap-5">
      <Institutional group={group} years={years} />
      <LinesAndOds group={group} />
      <Indicators
        group={group}
        members={members}
        years={years}
        articles={countArticles(products)}
        total={products.length}
        productionReady={productionReady}
        productionHint={productionHint}
      />
      <HistorySection group={group} />
      <TypologySection
        products={products}
        productionReady={productionReady}
        onExploreTypology={onExploreTypology}
      />
    </div>
  );
}

function Institutional({ group, years }: { group: GroupDetail; years: number | null }) {
  const { t } = useTranslation(['groups', 'common', 'authors']);
  const labels = useLabels();
  const lastConv = group.categoryHistory[group.categoryHistory.length - 1];
  const leader = group.leader;
  return (
    <section className={`${card} p-5 md:p-6`}>
      <SectionHead icon="corporate_fare">{t('detail.institutional')}</SectionHead>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        <InfoColumn icon="badge" title={t('detail.identification')}>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('detail.code')}>
              <span className="font-mono text-primary">{group.code}</span>
            </Field>
            <Field label={t('detail.foundedYear')}>{foundedYearLabel(t, group.foundedYear, years)}</Field>
          </div>
          <Field label={t('detail.status')}>
            <span className="inline-flex items-center gap-1.5 text-secondary">
              <span className="h-2 w-2 rounded-full bg-secondary" /> {t('detail.active')}
            </span>
          </Field>
        </InfoColumn>
        <InfoColumn icon="school" title={t('detail.classification')}>
          <Field label={t('detail.currentClass')}>
            <span
              className={`inline-flex min-w-10 justify-center rounded-lg px-2.5 py-0.5 text-headline-sm font-bold ${categoryTone(group.category)}`}
            >
              {group.category ? labels.domain(group.category) : '—'}
            </span>
          </Field>
          <Field label={t('detail.convocation')}>
            {lastConv ? labels.convocation(lastConv.convocation) : '—'}
          </Field>
          <Field label={t('detail.type')}>{group.type ? labels.domain(group.type) : '—'}</Field>
        </InfoColumn>
        <InfoColumn icon="account_balance" title={t('detail.structure')}>
          <Field label={t('detail.endorser')}>Universidad Simón Bolívar</Field>
          <Field label={t('detail.campus')}>{campusLabel(group.city, group.department)}</Field>
          <Field label={t('detail.groupLeader')}>{leader ? displayName(leader.name) : '—'}</Field>
          {group.centerIds?.length ? (
            <Field label={t('centers')}>
              <GroupCenters ids={group.centerIds} />
            </Field>
          ) : null}
        </InfoColumn>
      </div>
    </section>
  );
}

/** Líneas de investigación + ODS vinculados (bloque 3 de la plantilla). */
function LinesAndOds({ group }: { group: GroupDetail }) {
  const { t } = useTranslation(['groups', 'common', 'authors']);
  return (
    <section
      className={`${card} flex flex-col items-stretch gap-6 p-5 md:p-6 lg:flex-row`}
      aria-label={t('detail.linesAndOds')}
    >
      <ResearchLines lines={group.lines} />
      <div className="flex shrink-0 flex-col lg:w-[22rem] xl:w-[26rem]">
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2.5 text-headline-sm font-bold tracking-tight text-primary">
            <Icon name="public" className="text-[24px] text-secondary" /> {t('detail.odsLinked')}
          </h3>
          <span className="rounded-full bg-surface-cream-alt px-3 py-1 text-[12px] font-medium text-on-surface-variant">
            {t('detail.agenda')}
          </span>
        </div>
        <OdsLinked ods={group.ods} />
      </div>
    </section>
  );
}

interface IndicatorsProps {
  group: GroupDetail;
  members: GroupMember[] | undefined;
  years: number | null;
  articles: number;
  total: number;
  productionReady: boolean;
  productionHint: string;
}

function Indicators({
  group,
  members,
  years,
  articles,
  total,
  productionReady,
  productionHint,
}: IndicatorsProps) {
  const { t } = useTranslation(['groups', 'common', 'authors']);
  const history = group.categoryHistory;
  return (
    <section className="grid grid-cols-2 gap-gutter lg:grid-cols-4" aria-label={t('detail.indicators')}>
      <Kpi
        label={t('detail.kpiMembers')}
        icon="groups"
        value={members?.length ?? '—'}
        caption={t('detail.kpiMembersCaption')}
        hint={
          members
            ? t('detail.kpiMembersHint', { count: members.filter((m) => m.category).length })
            : t('common:loading')
        }
      />
      <Kpi
        label={t('detail.kpiTrajectory')}
        icon="military_tech"
        value={years ?? '—'}
        caption={t('detail.kpiYearsCaption')}
        hint={
          group.foundedYear
            ? t('detail.kpiFounded', { year: group.foundedYear, count: history.length })
            : t('detail.kpiConvocations', { count: history.length })
        }
      />
      <Kpi
        label={t('detail.kpiPublications')}
        icon="article"
        value={productionReady ? articles : '—'}
        caption={t('detail.kpiArticlesCaption')}
        hint={t('detail.kpiScopus')}
      />
      <Kpi
        label={t('detail.kpiTotal')}
        icon="workspace_premium"
        value={productionReady ? total : '—'}
        caption={t('detail.kpiTotalCaption')}
        hint={productionHint}
        accent
      />
    </section>
  );
}

function HistorySection({ group }: { group: GroupDetail }) {
  const { t } = useTranslation(['groups', 'common', 'authors']);
  return (
    <section className={`${card} flex flex-col gap-4 p-5 md:p-6`}>
      <div>
        <h2 className="text-headline-md font-semibold text-primary">{t('detail.historyTitle')}</h2>
        <p className="text-body-sm text-on-surface-variant">{t('detail.historyLead')}</p>
      </div>
      <CategoryTimeline history={group.categoryHistory} />
    </section>
  );
}

function TypologySection({
  products,
  productionReady,
  onExploreTypology,
}: {
  products: Product[];
  productionReady: boolean;
  onExploreTypology: (typology: TypologyId) => void;
}) {
  const { t } = useTranslation(['groups', 'common', 'authors']);
  return (
    <section className={`${card} flex flex-col gap-4 p-5 md:p-6`}>
      <div>
        <h2 className="text-headline-md font-semibold text-primary">{t('detail.typologyTitle')}</h2>
        <p className="text-body-sm text-on-surface-variant">{t('detail.typologyLead')}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {TYPOLOGIES.map((typology) => (
          <TypologyCard
            key={typology.id}
            typology={typology.id}
            count={products.filter((p) => p.typology === typology.id).length}
            total={products.length}
            loading={!productionReady}
            onExplore={() => onExploreTypology(typology.id)}
          />
        ))}
      </div>
    </section>
  );
}

function Kpi({
  label,
  icon,
  value,
  caption,
  hint,
  accent = false,
}: {
  label: string;
  icon: string;
  value: ReactNode;
  caption: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className={`${card} flex flex-col justify-between p-4 transition-all hover:-translate-y-1`}>
      <div className="flex items-center justify-between">
        <span className="text-label-sm tracking-wider text-neutral-muted uppercase">{label}</span>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            accent ? 'bg-badge-sage-bg text-secondary' : 'bg-surface-cream-alt text-primary'
          }`}
        >
          <Icon name={icon} className="text-[18px]" />
        </span>
      </div>
      <div className="mt-3">
        <span className={`text-stat-metric font-bold ${accent ? 'text-secondary' : 'text-primary'}`}>
          {value}
        </span>
        <span className="block text-body-sm font-medium text-on-surface">{caption}</span>
        <span className="mt-0.5 block text-[12px] text-neutral-muted">{hint}</span>
      </div>
    </div>
  );
}
