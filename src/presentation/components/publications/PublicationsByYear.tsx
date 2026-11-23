import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PublicationYear } from '@/domain/publications/publication';
import { yTicks } from '@/presentation/components/authors/ProductionByYear';
import { useWidth } from '@/presentation/components/charts/TrendChart';
import { useLabels } from '@/presentation/hooks/use-labels';

// Se carga aparte (React.lazy) solo cuando el visitante abre el gráfico en /productos.
const YEAR_SERIES = ['nc', 'dc', 'intlNc', 'intlDc'] as const;
type YearSeries = (typeof YEAR_SERIES)[number];
// Colores validados del portal (mismos del gráfico de producción por año).
const YEAR_COLORS: Record<YearSeries, string> = {
  nc: '#16834B',
  dc: '#0284C7',
  intlNc: '#4F46E5',
  intlDc: '#D97706',
};
// Las de coautoría son subconjuntos: línea discontinua para leerlas como "parte de".
const DASHED: Record<YearSeries, boolean> = { nc: false, dc: false, intlNc: true, intlDc: true };
const H = 320;
const TOP = 32;
const BOTTOM = H - 16;
/** Ancho de la columna de nombres: el área del gráfico empieza donde empiezan los años de la tabla. */
const LABEL_COL = 196;

/**
 * Publicaciones por año en líneas, con el valor en cada punto y la tabla de datos alineada debajo
 * (como el gráfico de Excel de la Vicerrectoría). Las tarjetas de totales ocultan/muestran series.
 * ponytail: NC y DC rotulan encima del punto y la coautoría (siempre ≤) debajo; si dos series casi
 * coinciden las etiquetas pueden rozarse, la tabla tiene los números exactos.
 */
export default function PublicationsByYear({ rows }: { rows: PublicationYear[] }) {
  const { t } = useTranslation('publications');
  const { number } = useLabels();
  const [ref, width] = useWidth();
  const [hidden, setHidden] = useState<YearSeries[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const shown = YEAR_SERIES.filter((k) => !hidden.includes(k));
  const ticks = yTicks(Math.max(1, ...rows.flatMap((r) => shown.map((k) => r[k]))));
  const yMax = ticks[ticks.length - 1]!;
  const right = width - 8;
  const slot = (right - LABEL_COL) / rows.length;
  const x = (i: number) => LABEL_COL + slot * i + slot / 2;
  const y = (v: number) => BOTTOM - (v / yMax) * (BOTTOM - TOP);
  const total = (k: YearSeries) => rows.reduce((n, r) => n + r[k], 0);
  const point = (r: PublicationYear) =>
    `${r.year}: ${YEAR_SERIES.map((k) => `${t(`byYear.${k}`)} ${r[k]}`).join(' · ')}`;
  const toggle = (k: YearSeries) => setHidden((h) => (h.includes(k) ? h.filter((v) => v !== k) : [...h, k]));
  const lastCol = rows.length - 1;

  return (
    <section aria-labelledby="pubs-by-year">
      <div className="overflow-hidden rounded-[24px] bg-surface-container-lowest shadow-[0_4px_20px_-2px_rgba(21,71,52,0.06),0_2px_6px_-1px_rgba(0,0,0,0.03)]">
        {/* Encabezado + totales del periodo (cada tarjeta muestra/oculta su serie). */}
        <div className="flex flex-col gap-5 border-b border-surface-cream-alt p-5 md:p-7">
          <div>
            <p className="inline-flex items-center gap-2 text-label-md font-bold tracking-widest text-secondary uppercase">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-secondary" />
              {t('byYear.eyebrow', { from: rows[0]!.year, to: rows[lastCol]!.year })}
            </p>
            <h2 id="pubs-by-year" className="mt-1 text-headline-md font-bold tracking-tight text-primary">
              {t('byYear.title')}
            </h2>
          </div>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {YEAR_SERIES.map((k) => {
              const on = !hidden.includes(k);
              return (
                <li key={k}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(k)}
                    className={`flex h-full w-full flex-col gap-1 rounded-2xl border p-3.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
                      on
                        ? 'border-border-subtle bg-surface-container-lowest'
                        : 'border-dashed border-border-subtle bg-canvas-cream opacity-55'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-label-md font-semibold text-on-surface-variant">
                      <svg width="22" height="8" aria-hidden="true" className="shrink-0">
                        <line
                          x1="2"
                          x2="20"
                          y1="4"
                          y2="4"
                          stroke={YEAR_COLORS[k]}
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={DASHED[k] ? '4 4' : undefined}
                        />
                      </svg>
                      {t(`byYear.${k}`)}
                    </span>
                    <span className="text-headline-md font-bold text-primary tabular-nums">
                      {number(total(k))}
                    </span>
                    <span className="text-label-sm text-neutral-muted">{t('byYear.totalPeriod')}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Gráfico + tabla alineada (en celular se desliza de lado). */}
        <div className="overflow-x-auto p-5 md:p-7">
          <div ref={ref} className="min-w-[720px]" onMouseLeave={() => setActive(null)}>
            <svg width={width} height={H} className="block" role="img" aria-label={t('byYear.title')}>
              <text x={4} y={TOP + (BOTTOM - TOP) / 2} fontSize="11" fill="#6A6A62" aria-hidden="true">
                {t('byYear.axis')}
              </text>
              {ticks.map((v) => (
                <g key={v} aria-hidden="true">
                  <line
                    x1={LABEL_COL}
                    x2={right}
                    y1={y(v)}
                    y2={y(v)}
                    stroke="#E1DBC8"
                    strokeDasharray={v ? '3 4' : undefined}
                  />
                  <text x={LABEL_COL - 10} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#6A6A62">
                    {v}
                  </text>
                </g>
              ))}
              {active !== null ? (
                <rect
                  x={LABEL_COL + slot * active + 4}
                  y={TOP - 22}
                  width={slot - 8}
                  height={BOTTOM - TOP + 22}
                  rx="10"
                  fill="#164130"
                  fillOpacity="0.05"
                  aria-hidden="true"
                />
              ) : null}
              {shown.map((k) => (
                <g key={k} aria-hidden="true">
                  <path
                    d={rows.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(r[k])}`).join('')}
                    fill="none"
                    stroke={YEAR_COLORS[k]}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={DASHED[k] ? '6 5' : undefined}
                  />
                  {rows.map((r, i) => {
                    const on = active === i;
                    return (
                      <g key={r.year}>
                        <circle
                          cx={x(i)}
                          cy={y(r[k])}
                          r={on ? 6 : 4.5}
                          fill={DASHED[k] ? '#fff' : YEAR_COLORS[k]}
                          stroke={DASHED[k] ? YEAR_COLORS[k] : '#fff'}
                          strokeWidth="2"
                        />
                        <text
                          x={x(i)}
                          y={k === 'nc' || k === 'dc' ? y(r[k]) - 11 : y(r[k]) + 19}
                          textAnchor="middle"
                          fontSize={on ? 12.5 : 11}
                          fontWeight="700"
                          fill={YEAR_COLORS[k]}
                          stroke="#fff"
                          strokeWidth="3.5"
                          strokeLinejoin="round"
                          paintOrder="stroke"
                        >
                          {r[k]}
                        </text>
                      </g>
                    );
                  })}
                </g>
              ))}
              {/* Zona sensible por año: resalta la columna y da el desglose (tooltip y lector de pantalla). */}
              {rows.map((r, i) => (
                <rect
                  key={r.year}
                  x={LABEL_COL + slot * i}
                  y={0}
                  width={slot}
                  height={H}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={point(r)}
                  className="outline-none"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                >
                  <title>{point(r)}</title>
                </rect>
              ))}
            </svg>

            <table className="w-full table-fixed border-separate border-spacing-0 text-body-sm">
              <colgroup>
                <col style={{ width: LABEL_COL }} />
              </colgroup>
              <thead>
                <tr>
                  <td />
                  {rows.map((r, i) => (
                    <th
                      key={r.year}
                      scope="col"
                      className={`border-y border-border-subtle py-2 text-center text-label-md font-bold transition-colors ${
                        i === 0 ? 'rounded-tl-lg border-l' : ''
                      } ${i === lastCol ? 'rounded-tr-lg border-r' : ''} ${
                        active === i ? 'bg-primary text-on-primary' : 'bg-surface-cream-alt text-primary'
                      }`}
                    >
                      {r.year}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {YEAR_SERIES.map((k) => (
                  <tr key={k} className={hidden.includes(k) ? 'opacity-40' : ''}>
                    <th
                      scope="row"
                      className="py-2 pr-3 text-left text-label-md font-semibold text-on-surface-variant"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: YEAR_COLORS[k] }}
                        />
                        <span className="truncate">{t(`byYear.${k}`)}</span>
                      </span>
                    </th>
                    {rows.map((r, i) => (
                      <td
                        key={r.year}
                        className={`border-b border-border-subtle py-2 text-center tabular-nums transition-colors ${
                          i === 0 ? 'border-l' : ''
                        } ${i === lastCol ? 'border-r' : ''} ${
                          active === i ? 'bg-badge-sage-bg font-bold text-primary' : 'text-on-surface'
                        }`}
                      >
                        {r[k]}
                      </td>
                    ))}
                  </tr>
                ))}
                {/* Total del año = NC + DC (la coautoría ya está dentro de cada uno). */}
                <tr>
                  <th scope="row" className="py-2 pr-3 text-left text-label-md font-bold text-primary">
                    {t('byYear.total')}
                  </th>
                  {rows.map((r, i) => (
                    <td
                      key={r.year}
                      className={`border-b border-border-subtle py-2 text-center font-bold tabular-nums transition-colors ${
                        i === 0 ? 'rounded-bl-lg border-l' : ''
                      } ${i === lastCol ? 'rounded-br-lg border-r' : ''} ${
                        active === i ? 'bg-primary text-on-primary' : 'bg-surface-cream-alt text-primary'
                      }`}
                    >
                      {r.nc + r.dc}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-3xl text-body-sm text-on-surface-variant">{t('byYear.note')}</p>
          <p className="mt-2 text-[12px] text-neutral-muted">{t('byYear.source')}</p>
        </div>
      </div>
    </section>
  );
}
