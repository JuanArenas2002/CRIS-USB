// Formato y vocabulario de las estadísticas de noticias (funciones puras).

const nf = new Intl.NumberFormat('es-CO');
export const fmtInt = (v: number) => nf.format(Math.round(v));
export const fmtPct = (v: number | null, digits = 1) =>
  v === null ? '—' : `${(v * 100).toFixed(digits).replace('.', ',')} %`;

export function fmtDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min ${String(s % 60).padStart(2, '0')} s`;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function fmtDay(iso: string, granularity = 'day'): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  if (granularity === 'year') return String(y);
  if (granularity === 'month') return `${MONTHS[m - 1]} ${y}`;
  return `${granularity === 'week' ? 'Sem. ' : ''}${d} ${MONTHS[m - 1]}`;
}
export const fmtRange = (a: string, b: string) =>
  `${fmtDay(a)} ${a.slice(0, 4)} – ${fmtDay(b)} ${b.slice(0, 4)}`;

/** Variación relativa; null si el periodo anterior no tiene base (nunca un porcentaje sobre cero). */
export const change = (cur: number, prev: number) => (prev ? (cur - prev) / prev : null);

export const SOURCE: Record<string, string> = {
  direct: 'Directo (sin referencia)',
  internal: 'Desde el portal',
  search: 'Buscadores',
  social: 'Redes sociales',
  external: 'Otros sitios',
};
export const DEVICE: Record<string, string> = { desktop: 'Computador', mobile: 'Celular', tablet: 'Tableta' };
export const CHANNEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  x: 'X',
  linkedin: 'LinkedIn',
  email: 'Correo',
  copy_link: 'Copiar enlace',
  native: 'Menú del dispositivo',
  other: 'Otro',
};

// Serie principal = token secondary (contraste ≥ 3:1 sobre blanco). Periodo anterior = gris neutro: es una
// referencia, no una segunda categoría.
export const C = { main: '#527616', previous: '#9ca3af' };
