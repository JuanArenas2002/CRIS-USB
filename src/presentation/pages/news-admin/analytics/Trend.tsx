import { useEffect, useRef, useState } from 'react';
import type { Overview, Point } from '@/infrastructure/news/analytics-api';
import { C, fmtDay, fmtDuration, fmtInt } from './format';
import { Empty } from './panels';
import { CHART_HEIGHT as H, MARGIN as M, granularityUnit, hoverIndex, trendGeometry } from './trend-model';

type Geometry = ReturnType<typeof trendGeometry>;

/** Ancho del contenedor (para que la gráfica se ajuste); 720 mientras no se mide o sin ResizeObserver. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(720);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Visualizaciones del periodo (área) frente a las del periodo anterior (línea gris), un solo eje. */
export function Trend({ data }: { data: Overview }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const points = data.timeline;
  const prev = data.previous_timeline;
  const g = data.period.granularity;
  const geo = trendGeometry(points, prev, width);
  const unit = granularityUnit(g);
  const hovered = hover === null ? null : { point: points[hover], previous: prev[hover], index: hover };

  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 print:break-inside-avoid">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-title-md font-bold text-on-surface">Evolución de las visualizaciones</h2>
          <p className="text-body-sm text-neutral-muted">
            Por {unit}, frente al periodo anterior de igual duración.
          </p>
        </div>
        <Legend total={geo.total} totalPrev={geo.totalPrev} />
      </div>
      {!geo.total && !geo.totalPrev ? (
        <Empty>No hay visualizaciones en este periodo.</Empty>
      ) : (
        <div ref={ref} className="relative">
          <Chart
            geo={geo}
            points={points}
            prev={prev}
            granularity={g}
            unit={unit}
            width={width}
            hovered={hovered}
            onHover={setHover}
          />
          {hovered?.point && (
            <Tooltip
              point={hovered.point}
              previous={hovered.previous}
              granularity={g}
              left={Math.min(Math.max(0, geo.x(hovered.index) + 14), width - 248)}
            />
          )}
        </div>
      )}
      <DataTable points={points} prev={prev} granularity={g} />
    </section>
  );
}

function Legend({ total, totalPrev }: { total: number; totalPrev: number }) {
  return (
    <ul className="flex flex-wrap gap-5 text-label-md text-on-surface-variant">
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="h-2.5 w-5 rounded-sm" style={{ background: C.main }} />
        Este periodo · <b className="text-on-surface tabular-nums">{fmtInt(total)}</b>
      </li>
      <li className="flex items-center gap-2">
        <svg width="20" height="8" aria-hidden="true">
          <line x1="0" x2="20" y1="4" y2="4" stroke={C.previous} strokeWidth="2" strokeDasharray="4 3" />
        </svg>
        Periodo anterior · <b className="text-on-surface tabular-nums">{fmtInt(totalPrev)}</b>
      </li>
    </ul>
  );
}

interface ChartProps {
  geo: Geometry;
  points: Point[];
  prev: Point[];
  granularity: string;
  unit: string;
  width: number;
  hovered: { point: Point | undefined; previous: Point | undefined; index: number } | null;
  onHover: (index: number | null) => void;
}

function Chart({ geo, points, prev, granularity, unit, width, hovered, onHover }: ChartProps) {
  const { x, y, max, iw, ih, every } = geo;
  return (
    <svg
      width={width}
      height={H}
      role="img"
      aria-label={`Visualizaciones por ${unit} frente al periodo anterior. El detalle está en la tabla.`}
      className="block max-w-full"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onHover(hoverIndex(e.clientX, r.left, iw, points.length));
      }}
      onPointerLeave={() => onHover(null)}
    >
      <defs>
        <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={C.main} stopOpacity={0.22} />
          <stop offset="100%" stopColor={C.main} stopOpacity={0.01} />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line
            x1={M.l}
            x2={width - M.r}
            y1={y(max * f)}
            y2={y(max * f)}
            stroke="var(--color-border-subtle)"
            strokeDasharray={f ? '2 4' : undefined}
          />
          <text x={M.l - 10} y={y(max * f) + 4} textAnchor="end" className="fill-neutral-muted text-[11px]">
            {fmtInt(max * f)}
          </text>
        </g>
      ))}
      {points.map((p, i) =>
        i % every === 0 ? (
          <text
            key={p.period}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            className="fill-neutral-muted text-[11px]"
          >
            {fmtDay(p.period, granularity)}
          </text>
        ) : null,
      )}
      <path d={geo.area} fill="url(#trend-fill)" />
      <path d={geo.line(prev)} fill="none" stroke={C.previous} strokeWidth={2} strokeDasharray="5 4" />
      <path d={geo.line(points)} fill="none" stroke={C.main} strokeWidth={2.5} strokeLinejoin="round" />
      {hovered?.point && <HoverMarker geo={geo} hovered={hovered} ih={ih} />}
    </svg>
  );
}

function HoverMarker({
  geo,
  hovered,
  ih,
}: {
  geo: Geometry;
  hovered: NonNullable<ChartProps['hovered']>;
  ih: number;
}) {
  const { x, y } = geo;
  const { point, previous, index } = hovered;
  return (
    <g>
      <line x1={x(index)} x2={x(index)} y1={M.t} y2={M.t + ih} stroke="var(--color-outline-variant)" />
      {previous && (
        <circle
          cx={x(index)}
          cy={y(previous.page_views)}
          r={4}
          fill={C.previous}
          stroke="#fff"
          strokeWidth={2}
        />
      )}
      <circle cx={x(index)} cy={y(point!.page_views)} r={5} fill={C.main} stroke="#fff" strokeWidth={2} />
    </g>
  );
}

function Tooltip({
  point,
  previous,
  granularity,
  left,
}: {
  point: Point;
  previous: Point | undefined;
  granularity: string;
  left: number;
}) {
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-2 z-10 w-60 rounded-xl border border-border-subtle bg-surface-container-lowest p-3 text-label-sm shadow-xl"
      style={{ left }}
    >
      <p className="mb-1.5 font-bold text-on-surface">{fmtDay(point.period, granularity)}</p>
      <TipRow color={C.main} label="Visualizaciones" value={fmtInt(point.page_views)} />
      {previous && (
        <TipRow
          color={C.previous}
          label={`Anterior (${fmtDay(previous.period, granularity)})`}
          value={fmtInt(previous.page_views)}
        />
      )}
      <div className="my-1.5 border-t border-border-subtle" />
      <TipRow label="Visitantes únicos (est.)" value={fmtInt(point.unique_visitors)} />
      <TipRow label="Sesiones" value={fmtInt(point.sessions)} />
      <TipRow label="Compartidos" value={fmtInt(point.shares)} />
      <TipRow label="Lectura acumulada" value={fmtDuration(point.active_seconds)} />
    </div>
  );
}

function TipRow({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-3 text-on-surface-variant">
      <span className="inline-flex items-center gap-1.5">
        {color && <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: color }} />}
        {label}
      </span>
      <span className="font-semibold text-on-surface tabular-nums">{value}</span>
    </p>
  );
}

const TABLE_HEAD = [
  'Periodo',
  'Visualizaciones',
  'Periodo anterior',
  'Visitantes únicos',
  'Sesiones',
  'Compartidos',
  'Lectura acumulada',
];

function DataTable({ points, prev, granularity }: { points: Point[]; prev: Point[]; granularity: string }) {
  return (
    <details className="mt-3 print:hidden">
      <summary className="cursor-pointer text-label-md font-semibold text-secondary">Ver como tabla</summary>
      <div className="mt-2 max-h-72 overflow-auto">
        <table className="w-full text-left text-body-sm">
          <thead className="sticky top-0 bg-surface-container-lowest text-label-sm text-neutral-muted">
            <tr>
              {TABLE_HEAD.map((c) => (
                <th key={c} className="py-1.5 pr-4 font-semibold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {points.map((p, i) => (
              <tr key={p.period} className="border-t border-border-subtle">
                <td className="py-1.5 pr-4">{fmtDay(p.period, granularity)}</td>
                <td className="pr-4">{fmtInt(p.page_views)}</td>
                <td className="pr-4">{prev[i] ? fmtInt(prev[i]!.page_views) : '—'}</td>
                <td className="pr-4">{fmtInt(p.unique_visitors)}</td>
                <td className="pr-4">{fmtInt(p.sessions)}</td>
                <td className="pr-4">{fmtInt(p.shares)}</td>
                <td>{fmtDuration(p.active_seconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
