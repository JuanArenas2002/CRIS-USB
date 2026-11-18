import { NEWS_API } from '@/infrastructure/news/news-http';
import { ANALYTICS_SESSION_KEY, hasConsent } from '@/infrastructure/privacy/consent';

/**
 * Medición de lectura de noticias (anónima). Sin cookies, sin fingerprinting, sin datos personales:
 * - sesión = id aleatorio en sessionStorage (muere al cerrar la pestaña);
 * - el cliente NO envía duraciones: late cada 15 s solo si la pestaña está visible y hubo actividad en
 *   los últimos 30 s; el servidor acredita el tiempo con su propio reloj;
 * - SOLO con la categoría «analíticas» autorizada (servicio central de consentimiento): sin ella no se crea el
 *   id de sesión ni se envía nada, y el servidor además descarta los eventos de navegadores sin autorización.
 * Los envíos usan sendBeacon (no bloquea la lectura ni el cierre de la página) y los errores se ignoran.
 */
export type ShareChannel =
  'whatsapp' | 'facebook' | 'x' | 'linkedin' | 'email' | 'copy_link' | 'native' | 'other';

type AnalyticsEvent =
  | { type: 'view'; news_id: number; referrer?: string; is_entry: boolean; from_news_id?: number }
  | { type: 'heartbeat'; news_id: number }
  | { type: 'share'; news_id: number; channel: ShareChannel };

// Sin "analytics" en la URL: los bloqueadores de rastreadores la cortarían (ver backend).
const ENDPOINT = `${NEWS_API}/news/lecturas`;
const HEARTBEAT_MS = 15_000;
const IDLE_MS = 30_000;
const ACTIVITY = ['pointermove', 'pointerdown', 'keydown', 'scroll', 'wheel', 'touchstart'] as const;

let memorySession = '';
let lastNewsId: number | undefined; // noticia anterior en esta visita (navegación interna)
let firstView = true;

/** UUID v4; crypto.randomUUID solo existe en contextos seguros (https/localhost), no en http por IP. */
function uuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function sessionId(): string {
  try {
    let id = sessionStorage.getItem(ANALYTICS_SESSION_KEY);
    if (!id) sessionStorage.setItem(ANALYTICS_SESSION_KEY, (id = uuid()));
    return id;
  } catch {
    return (memorySession ||= uuid()); // almacenamiento bloqueado: sesión de esta carga
  }
}

function send(events: AnalyticsEvent[]) {
  if (!hasConsent('analytics')) return; // control central: sin permiso no sale nada
  const body = JSON.stringify({ session_id: sessionId(), events });
  try {
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: 'application/json' }))) return;
  } catch {
    /* sendBeacon puede lanzar con cuerpos grandes o políticas: se intenta con fetch */
  }
  void fetch(ENDPOINT, {
    method: 'POST',
    body,
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => {});
}

/** ¿Esta noticia es la página con la que se abrió el portal? (en una SPA document.referrer no cambia). */
function isLanding(): boolean {
  const nav = performance.getEntriesByType?.('navigation')[0];
  try {
    return firstView && !!nav && new URL(nav.name).pathname === location.pathname;
  } catch {
    return false;
  }
}

export const trackShare = (newsId: number, channel: ShareChannel) =>
  send([{ type: 'share', news_id: newsId, channel }]);

/** Registra la vista y mide la lectura activa hasta que se llame la función devuelta (al salir). */
export function startReading(newsId: number): () => void {
  const landing = isLanding();
  firstView = false;
  send([
    {
      type: 'view',
      news_id: newsId,
      // Llegada desde fuera: el referrer real. Navegación dentro del portal: la propia URL (= "interno").
      referrer: landing ? document.referrer || undefined : location.href,
      is_entry: landing,
      ...(lastNewsId && lastNewsId !== newsId ? { from_news_id: lastNewsId } : {}),
    },
  ]);
  lastNewsId = newsId;

  let lastActive = Date.now();
  const active = () => void (lastActive = Date.now());
  const recentlyActive = () => Date.now() - lastActive < IDLE_MS;
  const beat = () => send([{ type: 'heartbeat', news_id: newsId }]);
  const timer = setInterval(() => {
    if (document.visibilityState === 'visible' && recentlyActive()) beat();
  }, HEARTBEAT_MS);
  // Al ocultar la pestaña se acredita el tramo en curso; al volver, volver cuenta como actividad.
  const onVisibility = () => (document.visibilityState === 'hidden' ? recentlyActive() && beat() : active());

  for (const e of ACTIVITY) window.addEventListener(e, active, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    clearInterval(timer);
    for (const e of ACTIVITY) window.removeEventListener(e, active);
    document.removeEventListener('visibilitychange', onVisibility);
    if (document.visibilityState === 'visible' && recentlyActive()) beat();
  };
}
