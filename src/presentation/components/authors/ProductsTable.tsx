import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { TYPOLOGIES, type Product, type TypologyId } from '@/domain/authors/author';
import { Icon } from '@/presentation/components/ui/Icon';
import { TYPOLOGY_STYLE } from '@/presentation/components/ui/TypologyCard';
import { useLabels } from '@/presentation/hooks/use-labels';

const PAGE = 25;
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const field =
  'h-11 w-full rounded-lg bg-canvas-cream text-body-sm text-on-surface focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary focus:outline-none';

export interface ProductFilters {
  search: string;
  typology: TypologyId | '';
  type: string;
  year: string;
}
export const EMPTY_FILTERS: ProductFilters = { search: '', typology: '', type: '', year: '' };

/** Tabla de productos de la plantilla de perfil: filtros combinables + carga incremental. */
export function ProductsTable({
  products,
  filters,
  onFiltersChange,
}: {
  products: Product[];
  filters: ProductFilters;
  onFiltersChange: (f: ProductFilters) => void;
}) {
  const { t, i18n } = useTranslation('authors');
  const labels = useLabels();
  const [limit, setLimit] = useState(PAGE);
  const types = [...new Set(products.map((p) => p.type))]
    .map((v) => [v, labels.domain(v)] as [string, string])
    .sort((a, b) => a[1].localeCompare(b[1], i18n.resolvedLanguage));
  const years = useMemo(
    () =>
      [...new Set(products.map((p) => p.year).filter((y): y is number => y !== null))].sort((a, b) => b - a),
    [products],
  );

  const q = fold(filters.search.trim());
  const visible = products.filter(
    (p) =>
      (!filters.typology || p.typology === filters.typology) &&
      (!filters.type || p.type === filters.type) &&
      (!filters.year || String(p.year) === filters.year) &&
      (!q || fold(`${p.title} ${p.doi ?? ''} ${p.venue ?? ''}`).includes(q)),
  );
  const set = (patch: Partial<ProductFilters>) => {
    setLimit(PAGE);
    onFiltersChange({ ...filters, ...patch });
  };

  return (
    <div className="flex flex-col gap-gutter">
      <div className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1.3fr_1.3fr_0.8fr]">
          <div className="relative">
            <Icon
              name="search"
              className="pointer-events-none absolute top-3 left-3 text-[20px] text-on-surface-variant"
            />
            <label htmlFor="product-search" className="sr-only">
              {t('products.search')}
            </label>
            <input
              id="product-search"
              type="search"
              value={filters.search}
              onChange={(e) => set({ search: e.target.value })}
              placeholder={t('products.searchPlaceholder')}
              className={`${field} pr-3 pl-10`}
            />
          </div>
          <Select
            label={t('products.typology')}
            value={filters.typology}
            onChange={(v) => set({ typology: v as TypologyId | '' })}
            options={[
              ['', t('products.allTypologies')],
              ...TYPOLOGIES.map((x) => [x.id, labels.typology(x.id)] as [string, string]),
            ]}
          />
          <Select
            label={t('products.type')}
            value={filters.type}
            onChange={(v) => set({ type: v })}
            options={[['', t('products.allTypes')], ...types]}
          />
          <Select
            label={t('products.year')}
            value={filters.year}
            onChange={(v) => set({ year: v })}
            options={[
              ['', t('products.allYears')],
              ...years.map((y) => [String(y), String(y)] as [string, string]),
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p aria-live="polite" className="text-label-md font-semibold text-on-surface-variant">
            {t(visible.length !== products.length ? 'products.showingFiltered' : 'products.showing', {
              shown: Math.min(limit, visible.length),
              count: visible.length,
              total: products.length,
            })}
          </p>
          <button
            type="button"
            onClick={() => set(EMPTY_FILTERS)}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-label-md font-semibold text-secondary hover:bg-surface-cream-alt"
          >
            <Icon name="restart_alt" className="text-[18px]" /> {t('products.clear')}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
        <ProductRows products={visible.slice(0, limit)} />
        {!visible.length ? (
          <p className="px-4 py-10 text-center text-body-md text-neutral-muted">{t('products.none')}</p>
        ) : null}
        {visible.length > limit ? (
          <div className="border-t border-surface-cream-alt p-3 text-center">
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE)}
              className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-label-md font-semibold text-secondary hover:bg-surface-cream-alt"
            >
              {t('products.more', { count: Math.min(PAGE, visible.length - limit) })}
              <Icon name="expand_more" className="text-[18px]" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${field} cursor-pointer appearance-none px-3 pr-8 font-semibold`}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <Icon
        name="expand_more"
        className="pointer-events-none absolute top-3 right-2.5 text-[18px] text-on-surface-variant"
      />
    </div>
  );
}

/**
 * Filas de la tabla de productos (perfil del investigador, ficha de proyecto y /productos).
 * Sin contenedor: cada vista pone el suyo, sus filtros y su paginación.
 */
export function ProductRows({
  products,
  rank,
}: {
  products: Product[];
  /** Columna opcional de puesto (ranking de /productos): título y contenido por fila. */
  rank?: { label: string; of: (p: Product) => ReactNode };
}) {
  const { t } = useTranslation('authors');
  const labels = useLabels();
  // En móvil cada fila es una tarjeta (sin scroll lateral); desde md, tabla normal.
  return (
    <table className="block w-full border-collapse text-left text-body-sm md:table">
      <thead className="hidden md:table-header-group">
        <tr className="bg-surface-cream-alt text-label-md tracking-wider text-on-surface-variant uppercase">
          {rank ? (
            <th scope="col" className="w-24 px-4 py-3 text-center">
              {rank.label}
            </th>
          ) : null}
          <th scope="col" className="w-20 px-4 py-3 text-center">
            {t('products.colYear')}
          </th>
          <th scope="col" className="px-4 py-3">
            {t('products.colTitle')}
          </th>
          <th scope="col" className="px-4 py-3">
            {t('products.colType')}
          </th>
          <th scope="col" className="px-4 py-3">
            {t('products.colSubtype')}
          </th>
          <th scope="col" className="px-4 py-3 text-right">
            {t('products.colLink')}
          </th>
        </tr>
      </thead>
      <tbody className="block divide-y divide-surface-cream-alt md:table-row-group">
        {products.map((p) => (
          <tr
            key={p.key}
            className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3.5 transition-colors hover:bg-surface-cream-alt/40 md:table-row md:p-0"
          >
            {rank ? (
              <td className="hidden md:table-cell md:px-4 md:py-3.5 md:text-center md:align-top">
                {rank.of(p)}
              </td>
            ) : null}
            <td className="order-1 font-bold text-primary-container md:table-cell md:px-4 md:py-3.5 md:text-center md:align-top">
              {/* En móvil el puesto va junto al año (la fila es una tarjeta de dos columnas). */}
              {rank ? <span className="mr-2 md:hidden">{rank.of(p)}</span> : null}
              {p.year ?? '—'}
            </td>
            <td className="order-3 col-span-2 min-w-0 md:table-cell md:max-w-xl md:px-4 md:py-3.5 md:align-top">
              <p className="leading-snug font-semibold text-primary-container">{p.title}</p>
              {p.venue || p.doi ? (
                <p className="mt-1 text-label-sm break-all text-neutral-muted">
                  {[p.venue, p.doi && `DOI: ${p.doi}`].filter(Boolean).join(' · ')}
                </p>
              ) : null}
            </td>
            <td className="order-2 justify-self-end md:table-cell md:px-4 md:py-3.5 md:align-top">
              <span
                className={`rounded-full px-2 py-0.5 text-label-sm font-semibold whitespace-nowrap ${TYPOLOGY_STYLE[p.typology].chip}`}
              >
                {labels.typologyShort(p.typology)}
              </span>
            </td>
            <td className="order-4 min-w-0 text-label-md text-on-surface-variant md:table-cell md:px-4 md:py-3.5 md:align-top">
              {labels.domain(p.type)}
              {p.index ? (
                <span className="block text-label-sm text-neutral-muted">{labels.domain(p.index)}</span>
              ) : null}
            </td>
            <td className="order-5 justify-self-end md:table-cell md:px-4 md:py-3.5 md:text-right md:align-top">
              {p.url ? (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1 rounded bg-surface-cream-alt px-2.5 py-1 text-label-sm font-semibold text-primary-container transition-colors hover:bg-primary-container hover:text-on-primary"
                >
                  {p.doi ? 'DOI' : t('products.view')}
                  <Icon name="open_in_new" className="text-[14px]" />
                  <span className="sr-only">{t('products.openTitle', { title: p.title })}</span>
                </a>
              ) : (
                <span className="text-label-sm text-neutral-muted">—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
