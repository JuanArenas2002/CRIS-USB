import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { geoEqualEarth, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';
import { heatBin, type CountryCollaboration } from '@/domain/relations/relations';
import { Icon } from '@/presentation/components/ui/Icon';
import { useLabels } from '@/presentation/hooks/use-labels';
import { Flag } from './Flag';
import { HEAT_COLORS, NO_DATA } from './heat-colors';

// Geometría y proyección se calculan una sola vez (el módulo se carga bajo demanda con React.lazy).
const W = 960;
const H = 470;
const topology = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const shapes = feature(topology, topology.objects.countries).features.filter(
  (f) => f.id !== '010', // Antártida: ocupa espacio y no tiene coautorías
);
const projection = geoEqualEarth().fitSize([W, H], { type: 'FeatureCollection', features: shapes });
const path = geoPath(projection);
const SPHERE = path({ type: 'Sphere' }) ?? '';
const COUNTRIES = shapes.map((f) => ({
  id: String(f.id ?? ''),
  name: f.properties.name,
  d: path(f) ?? '',
  bounds: path.bounds(f),
}));
const BY_ID = new Map(COUNTRIES.map((c) => [c.id, c]));

/** Vista del mapa en unidades del viewBox: escala `k` y desplazamiento (`x`, `y`). */
interface View {
  k: number;
  x: number;
  y: number;
}
const MIN_K = 1;
const MAX_K = 12;
const WORLD: View = { k: 1, x: 0, y: 0 };
const EASE = 'cubic-bezier(0.22, 0.7, 0.2, 1)';

/** El mapa nunca se sale del recuadro: a escala k, el desplazamiento queda entre W·(1−k) y 0. */
export function clamp(v: View): View {
  const k = Math.min(MAX_K, Math.max(MIN_K, v.k));
  return {
    k,
    x: Math.min(0, Math.max(W * (1 - k), v.x)),
    y: Math.min(0, Math.max(H * (1 - k), v.y)),
  };
}

/** Acercar o alejar por un factor manteniendo fijo el punto (px, py) del viewBox (bajo el cursor). */
export function zoomAt(v: View, factor: number, px = W / 2, py = H / 2): View {
  const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
  return clamp({ k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k });
}

/** Vista centrada en un país (acotada: ni microestados gigantes ni Rusia diminuta). */
function viewOf(id: string | undefined): View {
  const b = id ? BY_ID.get(id)?.bounds : undefined;
  if (!b) return WORLD;
  const [[x0, y0], [x1, y1]] = b;
  const k = Math.min(6, Math.max(1, 0.55 / Math.max((x1 - x0) / W, (y1 - y0) / H)));
  return clamp({ k, x: W / 2 - (k * (x0 + x1)) / 2, y: H / 2 - (k * (y0 + y1)) / 2 });
}

export default function WorldHeatmap({
  countries,
  selected,
  onSelect,
  onClear,
  nameOf,
}: {
  countries: CountryCollaboration[];
  /** ISO3 del país seleccionado: el mapa se acerca a él y lo resalta. */
  selected: string | null;
  onSelect: (iso3: string) => void;
  onClear: () => void;
  /** Nombre del país en el idioma activo. */
  nameOf: (c: CountryCollaboration) => string;
}) {
  const { t } = useTranslation('relations');
  const { number } = useLabels();
  const svgRef = useRef<SVGSVGElement>(null);
  const byId = new Map(countries.map((c) => [c.isoNumeric, c]));
  const selectedId = countries.find((c) => c.iso3 === selected)?.isoNumeric;

  // `animate`: transición suave (botones, selección); sin ella al arrastrar o con la rueda (respuesta inmediata).
  const [state, setState] = useState({ view: viewOf(selectedId), sel: selectedId, animate: true });
  // Al cambiar la selección desde fuera (lista o URL), el mapa viaja a ese país.
  if (state.sel !== selectedId) setState({ view: viewOf(selectedId), sel: selectedId, animate: true });
  const { view, animate } = state;
  const setView = (next: View, smooth: boolean) =>
    setState((s) => ({ ...s, view: clamp(next), animate: smooth }));

  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const hovered = hover ? BY_ID.get(hover.id) : undefined;
  const hoveredData = hover ? byId.get(hover.id) : undefined;

  /** Punto de pantalla → coordenadas del viewBox. */
  const toViewBox = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return {
      px: ((clientX - r.left) / r.width) * W,
      py: ((clientY - r.top) / r.height) * H,
      scale: W / r.width,
    };
  };

  // Rueda = zoom bajo el cursor. Escucha nativa no pasiva: así se evita que la página haga scroll.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      const py = ((e.clientY - r.top) / r.height) * H;
      setState((s) => ({ ...s, view: zoomAt(s.view, Math.exp(-e.deltaY * 0.0015), px, py), animate: false }));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  // Arrastre con uno o dos punteros (dos = pellizco para zoom en pantallas táctiles).
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  /** `start`: dónde se presionó (pantalla); `moved`: ya es un arrastre (desde ahí no hay clic). */
  const drag = useRef<{ moved: boolean; dist: number; start: { x: number; y: number } } | null>(null);
  const [dragging, setDragging] = useState(false);
  // Un clic con temblor de pocos píxeles sigue siendo clic: el arrastre empieza pasados 4 px.
  const DRAG_PX = 4;
  const startDrag = (el: SVGSVGElement, pointerId: number) => {
    drag.current!.moved = true;
    setDragging(true);
    // La captura se toma recién aquí: tomada al presionar, el clic iría al <svg> y no al país.
    el.setPointerCapture?.(pointerId);
  };
  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const [a, b] = [...pointers.current.values()];
    drag.current = {
      moved: drag.current?.moved ?? false,
      dist: a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0,
      start: { x: e.clientX, y: e.clientY },
    };
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const prev = pointers.current.get(e.pointerId);
    const d = drag.current;
    if (!prev || !d) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const [a, b] = [...pointers.current.values()];
    if (a && b) {
      // Pellizco (dos dedos): zoom centrado entre ambos.
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = toViewBox((a.x + b.x) / 2, (a.y + b.y) / 2);
      const factor = d.dist ? dist / d.dist : 1; // calculado ya: el ref cambia antes de que corra setState
      if (!d.moved) startDrag(e.currentTarget, e.pointerId);
      d.dist = dist;
      setState((s) => ({ ...s, view: zoomAt(s.view, factor, mid.px, mid.py), animate: false }));
      return;
    }
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.start.x, e.clientY - d.start.y) < DRAG_PX) return;
      startDrag(e.currentTarget, e.pointerId);
    }
    const { scale } = toViewBox(e.clientX, e.clientY);
    const dx = (e.clientX - prev.x) * scale;
    const dy = (e.clientY - prev.y) * scale;
    setState((s) => ({
      ...s,
      view: clamp({ ...s.view, x: s.view.x + dx, y: s.view.y + dy }),
      animate: false,
    }));
  };
  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size) return;
    setDragging(false);
    // El clic llega justo después del pointerup: lee `moved` antes de que se limpie.
    setTimeout(() => (drag.current = null), 0);
  };

  const zoomBy = (factor: number) => setView(zoomAt(view, factor), true);
  const resetView = () => {
    setView(WORLD, true);
    if (selectedId) onClear();
  };

  // Resaltados al final, para que su borde no quede tapado por los vecinos.
  const top = new Set([selectedId, hover?.id].filter(Boolean));
  const ordered = [...COUNTRIES.filter((c) => !top.has(c.id)), ...COUNTRIES.filter((c) => top.has(c.id))];
  const control =
    'flex h-9 w-9 items-center justify-center text-primary transition-colors hover:bg-surface-cream-alt disabled:cursor-default disabled:opacity-35';

  return (
    <div
      className="relative overflow-hidden rounded-xl bg-[#f3f7f4] ring-1 ring-border-subtle select-none"
      onMouseLeave={() => setHover(null)}
    >
      {/* El mapa es apoyo visual: la lista de países al lado da los mismos datos y es navegable con teclado. */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t('mapLabel')}
        className={`block h-auto w-full ${view.k > 1 ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
        // Con el mapa acercado, el dedo desplaza el mapa; en vista completa, la página sigue haciendo scroll.
        style={{ touchAction: view.k > 1 ? 'none' : 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(e) => {
          const { px, py } = toViewBox(e.clientX, e.clientY);
          setView(zoomAt(view, 2, px, py), true);
        }}
      >
        <g
          className="motion-reduce:!transition-none"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
            transformOrigin: '0 0',
            transition: animate ? `transform 650ms ${EASE}` : 'none',
          }}
        >
          <path d={SPHERE} fill="#e8f0eb" />
          {ordered.map((s) => {
            const data = byId.get(s.id);
            const bin = data ? heatBin(data.publications) : -1;
            const isSelected = s.id === selectedId;
            const isHover = s.id === hover?.id && !dragging;
            const dimmed = !!hover && !dragging && !isHover && !isSelected;
            return (
              <path
                key={s.id || s.name}
                d={s.d}
                data-iso={data?.iso3}
                fill={bin >= 0 ? HEAT_COLORS[bin] : NO_DATA}
                stroke={isSelected || isHover ? '#0f241a' : '#ffffff'}
                strokeWidth={isSelected ? 1.75 : isHover ? 1.25 : 0.5}
                // El borde no engorda al acercar el mapa.
                vectorEffect="non-scaling-stroke"
                opacity={dimmed ? 0.55 : 1}
                className={`motion-reduce:!transition-none ${data && view.k === 1 ? 'cursor-pointer' : ''}`}
                style={{ transition: `fill 450ms ${EASE}, opacity 200ms ease, stroke 150ms ease` }}
                onClick={
                  data
                    ? () => {
                        if (!drag.current?.moved) onSelect(data.iso3); // un arrastre no selecciona
                      }
                    : undefined
                }
                onMouseMove={(e) => {
                  const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
                  setHover({ id: s.id, x: e.clientX - r.left, y: e.clientY - r.top });
                }}
              />
            );
          })}
        </g>
      </svg>

      {/* Controles de zoom: arriba a la izquierda, como en los mapas habituales. */}
      <div className="absolute top-3 left-3 flex flex-col overflow-hidden rounded-lg bg-surface-container-lowest/95 shadow-md ring-1 ring-border-subtle backdrop-blur">
        <button
          type="button"
          onClick={() => zoomBy(1.6)}
          disabled={view.k >= MAX_K}
          aria-label={t('zoomIn')}
          title={t('zoomIn')}
          className={control}
        >
          <Icon name="add" className="text-[20px]" />
        </button>
        <span aria-hidden="true" className="h-px bg-border-subtle" />
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.6)}
          disabled={view.k <= MIN_K}
          aria-label={t('zoomOut')}
          title={t('zoomOut')}
          className={control}
        >
          <Icon name="remove" className="text-[20px]" />
        </button>
        <span aria-hidden="true" className="h-px bg-border-subtle" />
        <button
          type="button"
          onClick={resetView}
          disabled={view.k === 1 && !selectedId}
          aria-label={t('resetZoom')}
          title={t('resetZoom')}
          className={control}
        >
          <Icon name="fit_screen" className="text-[18px]" />
        </button>
      </div>

      <p className="pointer-events-none absolute bottom-2.5 left-3 hidden rounded-full bg-surface-container-lowest/85 px-2.5 py-1 text-[11px] text-neutral-muted backdrop-blur sm:block">
        {t('mapHint')}
      </p>

      {/* Tooltip: aparece suave y sigue al cursor; queda por encima del puntero sin taparlo. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 z-10 rounded-lg bg-surface-dark-forest/95 px-3 py-2 text-label-sm whitespace-nowrap text-on-primary shadow-xl backdrop-blur motion-reduce:!transition-none"
        style={{
          opacity: hover && !dragging ? 1 : 0,
          transform: hover
            ? `translate(${hover.x}px, ${hover.y}px) translate(-50%, calc(-100% - 12px))`
            : 'translate(-9999px, 0)',
          transition: hover ? 'opacity 150ms ease, transform 90ms linear' : 'opacity 150ms ease',
        }}
      >
        {hovered ? (
          <>
            <span className="flex items-center gap-2 font-semibold">
              {hoveredData ? <Flag iso2={hoveredData.iso2} /> : null}
              {hoveredData ? nameOf(hoveredData) : hovered.name}
            </span>
            <span className="text-primary-fixed-dim">
              {t('publications', {
                count: hoveredData?.publications ?? 0,
                value: number(hoveredData?.publications ?? 0),
              })}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
