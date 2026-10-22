import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TYPOLOGIES, type Product, type TypologyId } from '@/domain/authors/author';
import { useWidth } from '@/presentation/components/charts/TrendChart';
import { useLabels } from '@/presentation/hooks/use-labels';

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
 * Color de cada tipología en el gráfico (mismo que la barra de TypologyCard). Validado con el
 * validador de dataviz en este orden: pasa las 6 pruebas (contraste, CVD, banda, croma).
 */
const SERIES_COLOR: Record<TypologyId, string> = {
  GNC: '#16834B',
  DTI: '#4F46E5',
  ASC: '#0284C7',
  FRH: '#D97706',
};
const GRID = '#e7e2d6';
const H = 240;
const TOP = 12;
const BOTTOM = H - 28;
const BAR_GAP = 2; // px de superficie entre barras vecinas del mismo año

/** Barras agrupadas: por año, una barra por tipología presente. Tooltip por año (desglose). */
function GroupedBars({
  rows,
  series,
  ticks,
  ariaLabel,
  title,
}: {
  rows: YearRow[];
  series: TypologyId[];
  ticks: number[];
  ariaLabel: string;
  title: (r: YearRow) => string;
}) {
  const [ref, width] = useWidth();
  const left = Math.max(32, String(ticks[ticks.length - 1]).length * 6.2 + 16);
  const right = width - 8;
  const yMax = ticks[ticks.length - 1]!;
  const y = (v: number) => BOTTOM - (v / yMax) * (BOTTOM - TOP);
  const slot = (right - left) / rows.length;
  const k = series.length;
  // Barra ≤ 18 px; el resto del espacio del año queda como aire entre grupos.
  const barW = Math.max(2, Math.min(18, (slot * 0.72 - BAR_GAP * (k - 1)) / k));
  const groupW = barW * k + BAR_GAP * (k - 1);
  const xStep = Math.max(1, Math.ceil(40 / slot));
  const r = Math.min(4, barW / 2);
  // Extremo de datos redondeado (4 px), base recta sobre la línea base.
  const bar = (x: number, v: number) => {
    const top = y(v);
    const rr = Math.min(r, BOTTOM - top);
    return `M${x},${BOTTOM}V${top + rr}Q${x},${top} ${x + rr},${top}H${x + barW - rr}Q${x + barW},${top} ${x + barW},${top + rr}V${BOTTOM}Z`;
  };

  return (
    <div ref={ref} className="w-full rounded-lg border border-border-subtle bg-surface-container-lowest">
      <svg width={width} height={H} className="block" role="img" aria-label={ariaLabel}>
        {ticks.map((v) => (
          <g key={v} aria-hidden="true">
            <line x1={left - 6} x2={right} y1={y(v)} y2={y(v)} stroke={GRID} />
            <text x={left - 10} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#6B7280">
              {v}
            </text>
          </g>
        ))}
        {rows.map((row, i) => {
          const x0 = left + i * slot + (slot - groupW) / 2;
          return (
            <g key={row.year} tabIndex={0} role="img" aria-label={title(row)} className="group outline-none">
              <title>{title(row)}</title>
              {/* Zona sensible: toda la columna del año, más grande que las barras. */}
              <rect
                x={left + i * slot}
                y={TOP}
                width={slot}
                height={BOTTOM - TOP}
                className="fill-transparent group-hover:fill-[#0E382B]/[0.04] group-focus-visible:fill-[#0E382B]/[0.06]"
              />
              {series.map((s, j) =>
                row.by[s] ? (
                  <path key={s} d={bar(x0 + j * (barW + BAR_GAP), row.by[s])} fill={SERIES_COLOR[s]} />
                ) : null,
              )}
              {i % xStep === 0 || i === rows.length - 1 ? (
                <text
                  x={left + i * slot + slot / 2}
                  y={BOTTOM + 18}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#414944"
                  aria-hidden="true"
                >
                  {rows.length > 12 ? `'${String(row.year).slice(2)}` : row.year}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Producción por año en barras agrupadas por tipología Minciencias (una barra por tipología con
 * productos), con leyenda, tooltip por año y vista en tabla.
 */
export function ProductionByYear({ products }: { products: Product[] }) {
  const { t } = useTranslation('authors');
  const labels = useLabels();
  const rows = useMemo(() => productionByYear(products), [products]);
  if (!rows.length) return null;

  const series = TYPOLOGIES.map((x) => x.id).filter((id) => rows.some((r) => r.by[id]));
  const ticks = yTicks(Math.max(...rows.flatMap((r) => series.map((s) => r.by[s]))));
  const peak = rows.reduce((a, b) => (b.total > a.total ? b : a));
  const last = rows[rows.length - 1]!;
  const undated = products.filter((p) => p.year === null).length;
  const summary = t('byYear.summary', {
    from: rows[0]!.year,
    to: last.year,
    peak: peak.total,
    peakYear: peak.year,
  });

  return (
    <section aria-labelledby="by-year-title" className="rounded-xl bg-surface-container-lowest p-6 shadow-sm">
      <h2 id="by-year-title" className="text-headline-sm font-semibold text-primary-container">
        {t('byYear.title')}
      </h2>
      <p className="text-body-sm text-neutral-muted">
        {undated ? t('byYear.subtitleUndated', { count: undated }) : t('byYear.subtitle')}
      </p>

      {series.length > 1 ? (
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-label-md text-on-surface-variant">
          {series.map((s) => (
            <li key={s} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-3 w-3 rounded-sm"
                style={{ background: SERIES_COLOR[s] }}
              />
              {labels.typologyShort(s)}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3">
        <GroupedBars
          rows={rows}
          series={series}
          ticks={ticks}
          ariaLabel={summary}
          title={(r) =>
            t('byYear.point', { year: r.year, count: r.total }) +
            series
              .filter((s) => r.by[s])
              .map((s) => ` · ${labels.typologyShort(s)} ${r.by[s]}`)
              .join('')
          }
        />
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-label-md font-semibold text-secondary">
          {t('byYear.viewTable')}
        </summary>
        <table className="mt-2 w-full text-left text-body-sm">
          <thead>
            <tr className="text-label-sm tracking-wider text-neutral-muted uppercase">
              <th scope="col" className="py-1.5">
                {t('byYear.year')}
              </th>
              <th scope="col" className="py-1.5 text-right">
                {t('byYear.total')}
              </th>
              {TYPOLOGIES.map((x) => (
                <th key={x.id} scope="col" className="hidden py-1.5 text-right sm:table-cell">
                  {labels.typologyShort(x.id)}
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
