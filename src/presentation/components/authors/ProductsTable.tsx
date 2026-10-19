import { useMemo, useState } from 'react';
import { TYPOLOGIES, type Product, type TypologyId } from '@/domain/authors/author';
import { Icon } from '@/presentation/components/ui/Icon';
import { TYPOLOGY_STYLE } from '@/presentation/components/ui/TypologyCard';

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
  const [limit, setLimit] = useState(PAGE);
  const types = useMemo(() => [...new Set(products.map((p) => p.type))].sort(), [products]);
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
              Buscar productos
            </label>
            <input
              id="product-search"
              type="search"
              value={filters.search}
              onChange={(e) => set({ search: e.target.value })}
              placeholder="Buscar por título, revista o DOI…"
              className={`${field} pr-3 pl-10`}
            />
          </div>
          <Select
            label="Tipología"
            value={filters.typology}
            onChange={(v) => set({ typology: v as TypologyId | '' })}
            options={[
              ['', 'Todas las tipologías'],
              ...TYPOLOGIES.map((t) => [t.id, t.label] as [string, string]),
            ]}
          />
          <Select
            label="Tipo de producto"
            value={filters.type}
            onChange={(v) => set({ type: v })}
            options={[['', 'Todos los tipos'], ...types.map((t) => [t, t] as [string, string])]}
          />
          <Select
            label="Año"
            value={filters.year}
            onChange={(v) => set({ year: v })}
            options={[
              ['', 'Todos los años'],
              ...years.map((y) => [String(y), String(y)] as [string, string]),
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p aria-live="polite" className="text-label-md font-semibold text-on-surface-variant">
            Mostrando {Math.min(limit, visible.length)} de {visible.length}
            {visible.length !== products.length ? ` (de ${products.length})` : ''} productos registrados
          </p>
          <button
            type="button"
            onClick={() => set(EMPTY_FILTERS)}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-label-md font-semibold text-secondary hover:bg-surface-cream-alt"
          >
            <Icon name="restart_alt" className="text-[18px]" /> Limpiar filtros
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-body-sm">
            <thead>
              <tr className="bg-surface-cream-alt text-label-md tracking-wider text-on-surface-variant uppercase">
                <th scope="col" className="w-20 px-4 py-3 text-center">
                  Año
                </th>
                <th scope="col" className="px-4 py-3">
                  Título
                </th>
                <th scope="col" className="px-4 py-3">
                  Tipo
                </th>
                <th scope="col" className="px-4 py-3">
                  Subtipo
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Link
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-cream-alt">
              {visible.slice(0, limit).map((p) => (
                <tr key={p.key} className="transition-colors hover:bg-surface-cream-alt/40">
                  <td className="px-4 py-3.5 text-center align-top font-bold text-primary-container">
                    {p.year ?? '—'}
                  </td>
                  <td className="max-w-xl px-4 py-3.5 align-top">
                    <p className="leading-snug font-semibold text-primary-container">{p.title}</p>
                    {p.venue || p.doi ? (
                      <p className="mt-1 text-label-sm break-all text-neutral-muted">
                        {[p.venue, p.doi && `DOI: ${p.doi}`].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    <span
                      className={`rounded-full px-2 py-0.5 text-label-sm font-semibold whitespace-nowrap ${TYPOLOGY_STYLE[p.typology].chip}`}
                    >
                      {TYPOLOGIES.find((t) => t.id === p.typology)!.short}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 align-top text-label-md text-on-surface-variant">
                    {p.type}
                    {p.index ? (
                      <span className="block text-label-sm text-neutral-muted">{p.index}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5 text-right align-top">
                    {p.url ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1 rounded bg-surface-cream-alt px-2.5 py-1 text-label-sm font-semibold text-primary-container transition-colors hover:bg-primary-container hover:text-on-primary"
                      >
                        {p.doi ? 'DOI' : 'Ver'}
                        <Icon name="open_in_new" className="text-[14px]" />
                        <span className="sr-only">(abre en una pestaña nueva: {p.title})</span>
                      </a>
                    ) : (
                      <span className="text-label-sm text-neutral-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length ? (
          <p className="px-4 py-10 text-center text-body-md text-neutral-muted">
            Ningún producto coincide con los filtros.
          </p>
        ) : null}
        {visible.length > limit ? (
          <div className="border-t border-surface-cream-alt p-3 text-center">
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE)}
              className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-label-md font-semibold text-secondary hover:bg-surface-cream-alt"
            >
              Mostrar {Math.min(PAGE, visible.length - limit)} más
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
