import { vi } from 'vitest';
import { startReading, trackShare } from '@/infrastructure/news/news-reading';
import { ANALYTICS_SESSION_KEY, __setConsentForTests } from '@/infrastructure/privacy/consent';
import { consentDecided as decided } from '@/test-utils';

/** Cuerpos enviados por sendBeacon, ya decodificados. */
const sent: { session_id: string; events: { type: string; news_id: number }[] }[] = [];
let visibility: DocumentVisibilityState = 'visible';

beforeEach(() => {
  vi.useFakeTimers();
  sent.length = 0;
  visibility = 'visible';
  sessionStorage.clear();
  __setConsentForTests(decided(true));
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  navigator.sendBeacon = (_url: string | URL, data?: BodyInit | null) => {
    void (data as Blob).text().then((t) => sent.push(JSON.parse(t)));
    return true;
  };
});
afterEach(() => vi.useRealTimers());

const types = async () => {
  await vi.waitFor(() => Promise.resolve());
  await Promise.resolve();
  return sent.flatMap((b) => b.events.map((e) => e.type));
};

test('con analítica autorizada: vista + latidos solo con actividad reciente y la pestaña visible', async () => {
  const stop = startReading(7);
  vi.advanceTimersByTime(15_000); // activo (abrir cuenta como actividad)
  vi.advanceTimersByTime(30_000); // sin actividad > 30 s: deja de latir
  window.dispatchEvent(new Event('scroll'));
  vi.advanceTimersByTime(15_000); // vuelve la actividad
  visibility = 'hidden';
  window.dispatchEvent(new Event('scroll'));
  vi.advanceTimersByTime(15_000); // en segundo plano: no cuenta
  stop();
  expect(await types()).toEqual(['view', 'heartbeat', 'heartbeat']);
  expect(new Set(sent.map((b) => b.session_id)).size).toBe(1); // misma sesión anónima
  expect(sent[0]!.session_id).toMatch(/^[0-9a-f-]{36}$/);
});

test('sin decisión, consultando o rechazada: no sale ningún evento ni se crea identificador', async () => {
  for (const state of [
    { status: 'loading' as const, prefs: null },
    { status: 'error' as const, prefs: null },
    decided(false),
  ]) {
    __setConsentForTests(state);
    startReading(7)();
    trackShare(7, 'whatsapp');
    vi.advanceTimersByTime(60_000);
  }
  expect(await types()).toEqual([]);
  expect(sessionStorage.getItem(ANALYTICS_SESSION_KEY)).toBeNull();
});

test('revocar durante la lectura: se detiene al instante y se invalida el identificador', async () => {
  const stop = startReading(7);
  expect(sessionStorage.getItem(ANALYTICS_SESSION_KEY)).not.toBeNull();
  __setConsentForTests(decided(false)); // el usuario revoca en el centro de preferencias
  expect(sessionStorage.getItem(ANALYTICS_SESSION_KEY)).toBeNull();
  window.dispatchEvent(new Event('scroll'));
  vi.advanceTimersByTime(45_000);
  stop();
  expect(await types()).toEqual(['view']); // solo la vista anterior a revocar
});

test('compartir registra el canal; Global Privacy Control no cambia la decisión explícita', async () => {
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true });
  trackShare(7, 'whatsapp');
  expect(await types()).toEqual(['share']);
});
