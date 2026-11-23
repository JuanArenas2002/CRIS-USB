/**
 * Sistema de trayectorias del brandbook de Unisimón Research (8.0): el trazo ondulante es el recorrido no
 * lineal de la indagación y el punto marca un hallazgo. Cada variante usa el significado que el brandbook
 * le da, para que el fondo de cada módulo diga algo de su contenido:
 * - exploration: investigación y exploración (investigadores).
 * - discovery: el punto en el pico de la curva es un hallazgo (publicaciones y noticias).
 * - connection: la bifurcación es trabajo conjunto (grupos, centros y relacionamiento).
 * - impact: la flecha ascendente es progreso y proyección (proyectos).
 * - horizon: composición ancha para la portada.
 * Es decorativa: va como primer hijo de una sección `relative` sobre forest, detrás del contenido.
 */
type Variant = 'exploration' | 'discovery' | 'connection' | 'impact' | 'horizon';

interface Shape {
  viewBox: string;
  lines: string[];
  /** Línea secundaria punteada: procesos en desarrollo o conexiones aún no consolidadas. */
  dashed?: string;
  /** [x, y, protagonista]: el punto protagonista lleva halo (glow, permitido solo en piezas digitales). */
  nodes: [number, number, boolean][];
  arrow?: string;
}

const SHAPES: Record<Variant, Shape> = {
  exploration: {
    viewBox: '0 0 640 320',
    lines: ['M0 250 C 90 250 120 150 210 160 S 330 260 420 200 S 560 80 640 90'],
    dashed: 'M0 300 C 160 290 300 230 460 250 S 600 230 640 220',
    nodes: [
      [210, 160, true],
      [420, 200, false],
    ],
  },
  discovery: {
    viewBox: '0 0 640 320',
    lines: ['M0 280 C 150 270 250 120 380 110 S 560 170 640 200'],
    dashed: 'M0 310 C 180 300 330 240 480 250 S 600 280 640 280',
    nodes: [[380, 110, true]],
  },
  connection: {
    viewBox: '0 0 640 320',
    lines: [
      'M0 250 C 120 170 230 160 300 200',
      'M300 200 C 360 170 420 120 440 60',
      'M300 200 L 560 200',
      'M300 200 C 360 225 400 260 420 300',
    ],
    nodes: [
      [440, 60, true],
      [560, 200, false],
      [420, 300, false],
    ],
  },
  impact: {
    viewBox: '0 0 640 320',
    lines: ['M40 290 C 120 200 180 170 260 170 S 420 200 600 60'],
    dashed: 'M0 310 C 200 300 380 260 640 240',
    nodes: [[260, 170, true]],
    arrow: 'M600 60 L 588.7 81.3 L 576.5 65.5 Z',
  },
  horizon: {
    viewBox: '0 0 1440 400',
    lines: ['M0 330 C 220 330 300 200 470 220 S 720 330 900 250 S 1150 90 1440 120'],
    dashed: 'M0 370 C 260 360 420 290 640 300 S 1000 330 1440 230',
    nodes: [[470, 220, true]],
  },
};

export function Trajectory({
  variant,
  // Esquina superior derecha, libre en las cabeceras de módulo (el texto ocupa max-w-3xl a la izquierda y las
  // cifras van abajo): el brandbook pide que el patrón no compita con el contenido.
  className = 'pointer-events-none absolute top-4 right-0 hidden h-[55%] w-[38%] xl:block',
  preserveAspectRatio = 'xMaxYMid meet',
}: {
  variant: Variant;
  className?: string;
  preserveAspectRatio?: string;
}) {
  const s = SHAPES[variant];
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={s.viewBox}
      preserveAspectRatio={preserveAspectRatio}
      className={className}
    >
      {s.lines.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="stroke-primary-fixed/60"
        />
      ))}
      {s.dashed ? (
        <path
          d={s.dashed}
          fill="none"
          strokeWidth="1"
          strokeDasharray="4 6"
          vectorEffect="non-scaling-stroke"
          className="stroke-primary-fixed/30"
        />
      ) : null}
      {s.arrow ? <path d={s.arrow} className="fill-primary-fixed/60" /> : null}
      {s.nodes.map(([x, y, main]) =>
        main ? (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r="30" className="fill-secondary-fixed/10" />
            <circle cx={x} cy={y} r="16" className="fill-secondary-fixed/20" />
            <circle cx={x} cy={y} r="6" className="fill-secondary-fixed" />
          </g>
        ) : (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="4.5" className="fill-primary-fixed" />
        ),
      )}
    </svg>
  );
}

/**
 * Marcador del brandbook (8.0, "Marcadores y set de íconos"): el punto de hallazgo con halo sobre forest.
 * Sustituye a la foto cuando una pieza no la tiene, en lugar de un ícono genérico.
 */
export function Marker({ className = '' }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`flex h-full w-full items-center justify-center bg-primary ${className}`}>
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary-fixed/10">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-fixed/25">
          <span className="h-3 w-3 rounded-full bg-secondary-fixed" />
        </span>
      </span>
    </span>
  );
}
