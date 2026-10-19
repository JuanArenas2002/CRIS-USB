import { useMemo } from 'react';
import { TYPOLOGIES, type Product, type TypologyId } from '@/domain/authors/author';
import { TrendChart } from '@/presentation/components/charts/TrendChart';

interface YearRow {
  year: number;
  total: number;
  by: Record<TypologyId, number>;
}

const empty = () => Object.fromEntries(TYPOLOGIES.map((t) => [t.id, 0])) as Record<TypologyId, number>;

/** Productos por año, con los años intermedios sin producción incluidos (no se esconden huecos). */
export function productionByYear(products: Product[]): YearRow[] {
  const map = new Map<number, YearRow>();
  for (const p of products) {
    if (p.year === null) continue;
    const row = map.get(p.year) ?? { year: p.year, total: 0, by: empty() };
    row.total++;
    row.by[p.typology]++;
    map.set(p.year, row);
  }
  if (!map.size) return [];
  const years = [...map.keys()];
  const rows: YearRow[] = [];
  for (let y = Math.min(...years); y <= Math.max(...years); y++)
    rows.push(map.get(y) ?? { year: y, total: 0, by: empty() });
  return rows;
}

/** Eje Y con paso "redondo" (1, 2, 5 × 10ⁿ) y ~4 divisiones: 0/10/20/30, nunca 0/6/13/19. */
export function yTicks(max: number): number[] {
  const raw = Math.max(max, 1) / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(
    1,
    [1, 2, 5, 10].map((s) => s * p).find((v) => v >= raw)!,
  ); // conteos: enteros
  const top = Math.ceil(Math.max(max, 1) / step) * step;
  return Array.from({ length: top / step + 1 }, (_, i) => i * step);
}

/**
 * Una sola serie (sin leyenda: el título dice qué se grafica), con el estilo único de gráficos
 * del portal (TrendChart). Tooltip por punto con el desglose por tipología y vista en tabla.
 */
export function ProductionByYear({ products }: { products: Product[] }) {
  const rows = useMemo(() => productionByYear(products), [products]);
  if (!rows.length) return null;

  const ticks = yTicks(Math.max(...rows.map((r) => r.total)));
  const peak = rows.reduce((a, b) => (b.total > a.total ? b : a));
  const last = rows[rows.length - 1]!;
  const undated = products.filter((p) => p.year === null).length;
  const summary = `Producción por año de ${rows[0]!.year} a ${last.year}: máximo de ${peak.total} productos en ${peak.year}.`;

  return (
    <section aria-labelledby="by-year-title" className="rounded-xl bg-surface-container-lowest p-6 shadow-sm">
      <h2 id="by-year-title" className="text-headline-sm font-semibold text-primary-container">
        Producción por año
      </h2>
      <p className="text-body-sm text-neutral-muted">
        Productos registrados por año de publicación o de grado
        {undated ? ` (${undated} sin año no se grafican)` : ''}.
      </p>

      <div className="mt-4">
        <TrendChart
          ariaLabel={summary}
          labels={rows.length > 8 ? 'peak-last' : 'all'}
          yTicks={ticks.map((t) => ({ value: t, label: String(t) }))}
          points={rows.map((r) => ({
            key: r.year,
            value: r.total,
            xLabel: rows.length > 12 ? `'${String(r.year).slice(2)}` : String(r.year),
            pill: String(r.total),
            title: `${r.year}: ${r.total} ${r.total === 1 ? 'producto' : 'productos'}${TYPOLOGIES.filter(
              (t) => r.by[t.id],
            )
              .map((t) => ` · ${t.short} ${r.by[t.id]}`)
              .join('')}`,
          }))}
        />
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-label-md font-semibold text-secondary">
          Ver como tabla
        </summary>
        <table className="mt-2 w-full text-left text-body-sm">
          <thead>
            <tr className="text-label-sm tracking-wider text-neutral-muted uppercase">
              <th scope="col" className="py-1.5">
                Año
              </th>
              <th scope="col" className="py-1.5 text-right">
                Total
              </th>
              {TYPOLOGIES.map((t) => (
                <th key={t.id} scope="col" className="hidden py-1.5 text-right sm:table-cell">
                  {t.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-cream-alt">
            {[...rows].reverse().map((r) => (
              <tr key={r.year}>
                <th scope="row" className="py-1.5 font-semibold text-on-surface">
                  {r.year}
                </th>
                <td className="py-1.5 text-right font-semibold text-on-surface">{r.total}</td>
                {TYPOLOGIES.map((t) => (
                  <td key={t.id} className="hidden py-1.5 text-right text-on-surface-variant sm:table-cell">
                    {r.by[t.id]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
