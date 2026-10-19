import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export interface TrendPoint {
  key: string | number;
  value: number;
  /** Etiqueta del eje X (p. ej. el año) y una segunda línea opcional (p. ej. la convocatoria). */
  xLabel: string;
  xSubLabel?: string;
  /** Texto de la píldora sobre el nodo. */
  pill: string;
  /** Descripción completa del punto: tooltip nativo y lector de pantalla. */
  title: string;
}

interface Props {
  points: TrendPoint[];
  yTicks: { value: number; label: string }[];
  /** Resumen del gráfico completo para lectores de pantalla. */
  ariaLabel: string;
  /** 'all' rotula cada punto si cabe; 'peak-last' solo el máximo y el último. */
  labels?: 'all' | 'peak-last';
  /** Pie del gráfico (escala, fuente…). */
  caption?: ReactNode;
}

// Línea validada con el validador de dataviz (#16834B pasa las 6 pruebas).
const LINE = '#16834B';
const GRID = '#e7e2d6';
const H = 220;
const TOP = 30;
const BOTTOM = H - 46;
const MIN_PILL_GAP = 58; // px entre puntos para rotular todos sin que las píldoras choquen

/** Ancho real del contenedor: el SVG se dibuja en píxeles (texto siempre de 11 px, sin escalar). */
function useWidth(fallback = 720) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    // Sin ResizeObserver (tests, navegadores antiguos) se queda el ancho por defecto.
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Gráfico de tendencia único del portal (motivo de la plantilla de grupo): línea con área suave,
 * nodos con anillo, píldoras selectivas y el último punto destacado. Specs de dataviz: línea de
 * 2 px, marcadores ≥ 8 px con anillo de superficie, guías finas y recesivas.
 */
export function TrendChart({ points, yTicks, ariaLabel, labels = 'all', caption }: Props) {
  const gradId = useId();
  const [ref, width] = useWidth();
  if (!points.length) return null;

  const labelWidth = Math.max(...yTicks.map((t) => t.label.length)) * 6.2 + 14;
  const left = Math.max(40, labelWidth);
  const right = width - 18;
  const vals = yTicks.map((t) => t.value);
  const yMin = Math.min(...vals);
  const yMax = Math.max(...vals);
  const n = points.length;
  // Margen interno: el primer y el último punto no tocan el eje ni el borde (las píldoras caben).
  const PAD = 30;
  const gap = n > 1 ? (right - left - 2 * PAD) / (n - 1) : right - left;
  const x = (i: number) => (n === 1 ? (left + right) / 2 : left + PAD + i * gap);
  const clampPill = (cx: number, w: number) => Math.min(Math.max(cx - w / 2, left + 2), right - w);
  const y = (v: number) => BOTTOM - ((v - yMin) / (yMax - yMin || 1)) * (BOTTOM - TOP);
  const pillsForAll = labels === 'all' && gap >= MIN_PILL_GAP;
  const xStep = Math.max(1, Math.ceil(44 / gap));
  const peak = points.reduce((a, b, i) => (b.value > points[a]!.value ? i : a), 0);

  const line = points.map((p, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(p.value)}`).join(' ');
  const area = `${line} L ${x(n - 1)} ${BOTTOM} L ${x(0)} ${BOTTOM} Z`;

  return (
    <figure className="flex flex-col gap-2">
      <div ref={ref} className="w-full rounded-lg border border-border-subtle bg-surface-container-lowest">
        <svg width={width} height={H} className="block overflow-visible" role="img" aria-label={ariaLabel}>
          <defs>
            <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={LINE} stopOpacity="0.14" />
              <stop offset="100%" stopColor={LINE} stopOpacity="0" />
            </linearGradient>
          </defs>

          {yTicks.map((t) => (
            <g key={t.value} aria-hidden="true">
              <line x1={left - 6} x2={right + 6} y1={y(t.value)} y2={y(t.value)} stroke={GRID} />
              <text x={left - 12} y={y(t.value) + 4} textAnchor="end" fontSize="11" fill="#6B7280">
                {t.label}
              </text>
            </g>
          ))}

          <path d={area} fill={`url(#${gradId})`} aria-hidden="true" />
          <path
            d={line}
            stroke={LINE}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            aria-hidden="true"
          />

          {points.map((p, i) => {
            const cx = x(i);
            const cy = y(p.value);
            const last = i === n - 1;
            const showPill = pillsForAll || i === peak || last;
            const pw = p.pill.length * 6.4 + 14;
            return (
              <g
                key={p.key}
                tabIndex={0}
                role="img"
                aria-label={p.title}
                className="outline-none focus-visible:opacity-70"
              >
                <title>{p.title}</title>
                <circle cx={cx} cy={cy} r="12" fill="transparent" />
                {showPill ? (
                  <g aria-hidden="true">
                    <rect
                      x={clampPill(cx, pw)}
                      y={cy - 28}
                      width={pw}
                      height={18}
                      rx="4"
                      fill={last ? '#0E382B' : '#E8F5EC'}
                    />
                    <text
                      x={clampPill(cx, pw) + pw / 2}
                      y={cy - 15.5}
                      textAnchor="middle"
                      fontSize="10.5"
                      fontWeight="600"
                      fill={last ? '#FFFFFF' : '#176653'}
                    >
                      {p.pill}
                    </text>
                  </g>
                ) : null}
                <circle
                  cx={cx}
                  cy={cy}
                  r={last ? 5 : 4}
                  fill={last ? LINE : '#FFFFFF'}
                  stroke={last ? '#FFFFFF' : LINE}
                  strokeWidth="2"
                />
              </g>
            );
          })}

          {points.map((p, i) =>
            i % xStep === 0 || i === n - 1 ? (
              <g key={`x-${p.key}`} aria-hidden="true">
                <text
                  x={x(i)}
                  y={BOTTOM + 20}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={i === n - 1 ? 600 : 400}
                  fill={i === n - 1 ? '#0E382B' : '#414944'}
                >
                  {p.xLabel}
                </text>
                {p.xSubLabel ? (
                  <text x={x(i)} y={BOTTOM + 34} textAnchor="middle" fontSize="10" fill="#6B7280">
                    {p.xSubLabel}
                  </text>
                ) : null}
              </g>
            ) : null,
          )}
        </svg>
      </div>
      {caption ? (
        <figcaption className="flex flex-col justify-between gap-1 text-[12px] text-neutral-muted sm:flex-row sm:items-center">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
