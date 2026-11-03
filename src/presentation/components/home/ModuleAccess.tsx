import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { HOME_AREAS_ID } from '@/presentation/components/home/HomeHero';
import { Icon } from '@/presentation/components/ui/Icon';
import type { ResearchIndicatorMap } from '@/presentation/hooks/use-research-indicators';
import { NAV_ITEMS, type NavItem } from '@/shared/navigation';

const AREA_ICON: Record<NavItem['key'], string> = {
  centers: 'apartment',
  groups: 'groups',
  authors: 'school',
  projects: 'science',
  products: 'menu_book',
  relations: 'public',
};

/** Las seis áreas del portal, con la cifra de cada módulo. Su estado se ve en los indicadores. */
export function ModuleAccess({ indicators }: { indicators: ResearchIndicatorMap }) {
  const { t } = useTranslation(['home', 'common']);
  return (
    <aside
      id={HOME_AREAS_ID}
      aria-labelledby="areas-title"
      className="scroll-mt-24 rounded-2xl border border-border-subtle bg-surface-container-lowest p-6 shadow-sm sm:p-7 lg:col-span-4"
    >
      <h2
        id="areas-title"
        className="mb-4 border-b border-surface-container pb-3 text-headline-sm font-bold text-primary-container"
      >
        {t('areas.title')}
      </h2>
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const indicator = indicators[item.key];
          return (
            <li key={item.key}>
              <Link
                to={item.to}
                className="group flex min-h-14 items-center gap-3.5 rounded-xl p-2.5 transition-colors hover:bg-badge-sage-bg"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-secondary ring-2 ring-secondary/30 transition-colors group-hover:bg-primary-container group-hover:text-on-primary group-hover:ring-primary-container">
                  <Icon name={AREA_ICON[item.key]} className="text-[20px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-body-sm font-semibold text-on-surface group-hover:text-primary-container">
                    {t(`common:nav.items.${item.key}.label`)}
                  </span>
                  <span className="block min-h-4 text-label-md text-neutral-muted">
                    {indicator.status === 'ready' ? indicator.detail : null}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
