import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';

function hrefFor(search: string, page: number) {
  const params = new URLSearchParams(search);
  if (page <= 1) params.delete('page');
  else params.set('page', String(page));
  return { search: params.size ? `?${params}` : '' };
}

const linkClass =
  'inline-flex h-10 items-center gap-1 rounded-xl px-3 text-label-md font-semibold text-primary hover:bg-surface-cream-alt';

/** Paginación con enlaces reales (rastreables y abribles en otra pestaña). */
export function Pagination({ page, pages }: { page: number; pages: number }) {
  const { t } = useTranslation();
  const { search } = useLocation();
  if (pages <= 1) return null;
  return (
    <nav aria-label={t('pagination.label')} className="mt-10 flex items-center justify-center gap-2">
      {page > 1 ? (
        <Link to={hrefFor(search, page - 1)} className={linkClass} rel="prev">
          <Icon name="chevron_left" className="text-[18px]" /> {t('pagination.prev')}
        </Link>
      ) : null}
      <span className="px-3 text-body-sm text-neutral-muted" aria-current="page">
        {t('pagination.status', { page, pages })}
      </span>
      {page < pages ? (
        <Link to={hrefFor(search, page + 1)} className={linkClass} rel="next">
          {t('pagination.next')} <Icon name="chevron_right" className="text-[18px]" />
        </Link>
      ) : null}
    </nav>
  );
}
