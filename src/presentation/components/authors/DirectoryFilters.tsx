import { useTranslation } from 'react-i18next';
import { AUTHOR_CATEGORIES, type AuthorCategoryId } from '@/domain/authors/author';
import { useLabels } from '@/presentation/hooks/use-labels';
import type { Group } from '@/domain/groups/group';
import { Icon } from '@/presentation/components/ui/Icon';

interface Props {
  term: string;
  onTermChange: (v: string) => void;
  category?: AuthorCategoryId;
  onCategoryChange: (v: AuthorCategoryId | undefined) => void;
  groupId?: number;
  onGroupChange: (v: number | undefined) => void;
  groups: Group[];
}

const fieldClass =
  'h-11 rounded-xl bg-canvas-cream text-on-surface transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary focus:outline-none';
const selectClass = `${fieldClass} w-full cursor-pointer appearance-none px-3 pr-8 text-label-md font-semibold`;

function SelectChevron() {
  return (
    <Icon
      name="expand_more"
      className="pointer-events-none absolute top-3 right-2.5 text-[18px] text-on-surface-variant"
    />
  );
}

export function DirectoryFilters(p: Props) {
  const { t, i18n } = useTranslation('authors');
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
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <div className="relative w-full sm:w-72">
            <label htmlFor="group-filter" className="sr-only">
              {t('filters.group')}
            </label>
            <select
              id="group-filter"
              value={p.groupId ?? ''}
              onChange={(e) => p.onGroupChange(Number(e.target.value) || undefined)}
              className={selectClass}
            >
              <option value="">{t('filters.allGroups')}</option>
              {[...p.groups]
                .sort((a, b) => a.name.localeCompare(b.name, i18n.resolvedLanguage))
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
            </select>
            <SelectChevron />
          </div>
          <div className="relative w-full sm:w-56">
            <label htmlFor="category-filter" className="sr-only">
              {t('mincienciasCategory')}
            </label>
            <select
              id="category-filter"
              value={p.category ?? ''}
              onChange={(e) =>
                p.onCategoryChange((e.target.value || undefined) as AuthorCategoryId | undefined)
              }
              className={selectClass}
            >
              <option value="">{t('mincienciasCategory')}</option>
              {AUTHOR_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {t('filters.categoryOption', { category: labels.category(c.id), code: c.code })}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
          {/* Orden fijo del directorio: se informa, no se finge un control. */}
          <p
            title={t('filters.sortTitle')}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-canvas-cream px-4 text-label-md font-semibold text-on-surface"
          >
            <Icon name="sort" className="text-[18px]" />
            <span className="sr-only md:not-sr-only">{t('filters.sort')}</span>
          </p>
        </div>
      </form>
    </div>
  );
}
