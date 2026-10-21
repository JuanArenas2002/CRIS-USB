import { useTranslation } from 'react-i18next';
import { AUTHOR_CATEGORIES, ENGLISH_LEVELS, type AuthorCategoryId } from '@/domain/authors/author';
import { useLabels } from '@/presentation/hooks/use-labels';
import type { Center } from '@/domain/centers/center';
import type { Group } from '@/domain/groups/group';
import { Icon } from '@/presentation/components/ui/Icon';
import { ClearFilters, FilterSelect } from '@/presentation/components/ui/FilterSelect';

interface Props {
  term: string;
  onTermChange: (v: string) => void;
  category?: AuthorCategoryId;
  onCategoryChange: (v: AuthorCategoryId | undefined) => void;
  englishLevel?: string;
  onEnglishLevelChange: (v: string | undefined) => void;
  groupId?: number;
  onGroupChange: (v: number | undefined) => void;
  groups: Group[];
  centerId?: number;
  onCenterChange: (v: number | undefined) => void;
  centers: Center[];
  hasActiveFilters: boolean;
  onReset: () => void;
}

const fieldClass =
  'h-11 rounded-xl bg-canvas-cream text-on-surface transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary focus:outline-none';
export function DirectoryFilters(p: Props) {
  const { t, i18n } = useTranslation(['authors', 'common']);
  const labels = useLabels();
  return (
    <div className="relative z-30 container-page -mt-7">
      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="flex flex-col items-stretch justify-between gap-4 rounded-2xl bg-surface-container-lowest p-4 shadow-xl lg:flex-row lg:items-center"
      >
        <div className="relative flex flex-1 items-center">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3.5 text-[20px] text-on-surface-variant"
          />
          <label htmlFor="author-search" className="sr-only">
            {t('filters.search')}
          </label>
          <input
            id="author-search"
            type="search"
            value={p.term}
            onChange={(e) => p.onTermChange(e.target.value)}
            placeholder={t('filters.searchPlaceholder')}
            autoComplete="off"
            className={`${fieldClass} w-full pr-4 pl-10 text-body-sm`}
          />
        </div>
        {/* Móvil: uno por fila; tableta: los cuatro selectores en fila; escritorio: junto al buscador. */}
        <div className="grid w-full grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto_auto] lg:flex lg:w-auto">
          <FilterSelect
            label={t('filters.center')}
            value={p.centerId ? String(p.centerId) : ''}
            onChange={(v) => p.onCenterChange(Number(v) || undefined)}
            className="lg:w-52"
            options={[
              ['', t('filters.allCenters')],
              ...p.centers.map(
                (c) => [String(c.id), c.acronym ? `${c.acronym} · ${c.name}` : c.name] as [string, string],
              ),
            ]}
          />
          <FilterSelect
            label={t('filters.group')}
            value={p.groupId ? String(p.groupId) : ''}
            onChange={(v) => p.onGroupChange(Number(v) || undefined)}
            className="lg:w-60"
            options={[
              ['', t('filters.allGroups')],
              ...[...p.groups]
                .sort((a, b) => a.name.localeCompare(b.name, i18n.resolvedLanguage))
                .map((g) => [String(g.id), g.name] as [string, string]),
            ]}
          />
          <FilterSelect
            label={t('mincienciasCategory')}
            value={p.category ?? ''}
            onChange={(v) => p.onCategoryChange((v || undefined) as AuthorCategoryId | undefined)}
            className="lg:w-52"
            options={[
              ['', t('mincienciasCategory')],
              ...AUTHOR_CATEGORIES.map(
                (c) =>
                  [c.id, t('filters.categoryOption', { category: labels.category(c.id), code: c.code })] as [
                    string,
                    string,
                  ],
              ),
            ]}
          />
          <FilterSelect
            label={t('filters.englishLevel')}
            value={p.englishLevel ?? ''}
            onChange={(v) => p.onEnglishLevelChange(v || undefined)}
            className="lg:w-40"
            options={[
              ['', t('filters.englishLevel')],
              ...ENGLISH_LEVELS.map((l) => [l, l] as [string, string]),
            ]}
          />
          {/* Orden fijo del directorio: se informa, no se finge un control. */}
          <p
            title={t('filters.sortTitle')}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-canvas-cream px-4 text-label-md font-semibold text-on-surface"
          >
            <Icon name="sort" className="text-[18px]" />
            <span className="sr-only md:not-sr-only">{t('filters.sort')}</span>
          </p>
          <ClearFilters
            show={p.hasActiveFilters}
            label={t('common:feedback.resetFilters')}
            onClick={p.onReset}
          />
        </div>
      </form>
    </div>
  );
}
