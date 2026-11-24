// Filtros de las estadísticas: viven en la URL. La lectura de los parámetros es una función pura.
import { useSearchParams } from 'react-router';
import type { StatsFilter } from '@/infrastructure/news/analytics-api';

export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const minusDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};

export const PRESETS = [
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: '365', label: '12 meses' },
  { value: 'custom', label: 'Personalizado' },
];
const FILTER_KEYS = ['categoria', 'dependencia', 'dispositivo', 'canal', 'agrupar'];

/** Un periodo en curso (termina hoy) se refresca solo; uno cerrado no cambia. */
export const liveRefresh = (f: StatsFilter, ms: number) =>
  f.end_date === today() ? { staleTime: 0, refetchInterval: ms } : { staleTime: Infinity };

/** Periodo de la URL: 7, 30, 90 o 365 días hasta hoy, o «custom» con desde/hasta (por defecto, los últimos 30 días). */
function periodRange(params: URLSearchParams, now: string) {
  const preset = params.get('periodo') ?? '30';
  const custom = preset === 'custom';
  const end = custom ? (params.get('hasta') ?? now) : now;
  const start = custom ? (params.get('desde') ?? minusDays(end, 29)) : minusDays(end, Number(preset) - 1);
  return { preset, start, end };
}

/** Parámetros de la URL → filtro del backend. `now` es «hoy» (ISO) en Bogotá. */
export function statsFilterFromParams(params: URLSearchParams, now: string) {
  const { preset, start, end } = periodRange(params, now);
  const [scopeType, scopeId] = (params.get('dependencia') ?? '').split(':');
  const filter: StatsFilter = {
    start_date: start,
    end_date: end,
    granularity: params.get('agrupar') ?? undefined,
    category_id: Number(params.get('categoria')) || undefined,
    scope_type: scopeType || undefined,
    scope_id: Number(scopeId) || undefined,
    device: params.get('dispositivo') ?? undefined,
    channel: params.get('canal') ?? undefined,
  };
  return { filter, preset, start, end, active: FILTER_KEYS.filter((k) => params.get(k)).length };
}

export function useStatsFilter() {
  const [params, setParams] = useSearchParams();
  const { filter, preset, start, end, active } = statsFilterFromParams(params, today());
  const set = (key: string, value: string) =>
    setParams(
      (p) => {
        if (value) p.set(key, value);
        else p.delete(key);
        if (key === 'periodo' && value === 'custom') {
          p.set('desde', start);
          p.set('hasta', end);
        }
        return p;
      },
      { replace: true },
    );
  const clear = () =>
    setParams(
      (p) => {
        FILTER_KEYS.forEach((k) => p.delete(k));
        return p;
      },
      { replace: true },
    );
  return { filter, preset, params, set, active, clear };
}
