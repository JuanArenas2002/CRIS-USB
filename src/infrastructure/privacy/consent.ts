import { useSyncExternalStore } from 'react';
import { z } from 'zod';
import i18n, { LANGUAGE_STORAGE_KEY } from '@/i18n';
import { call } from '@/infrastructure/news/news-http';

/**
 * Servicio central de consentimiento. ÚNICA fuente de verdad sobre qué categorías opcionales están autorizadas:
 * ningún componente decide por su cuenta; preguntan `hasConsent(categoría)` o usan `useConsent()`.
 *
 * - Hasta conocer la decisión (y si la consulta falla) todo lo opcional está APAGADO: el silencio no autoriza.
 * - La decisión vive en el servidor (prueba de la autorización); el navegador solo guarda la cookie necesaria
 *   `cris_consent` (HttpOnly, id aleatorio). El servidor además descarta eventos analíticos sin autorización.
 * - Los mecanismos de cada categoría se encienden/apagan aquí mismo (MECHANISMS), al cargar y en cada cambio.
 */
export type Category = 'functional' | 'analytics';
export type Method = 'accept_all' | 'reject_optional' | 'custom';

const prefsSchema = z.object({
  needs_decision: z.boolean(),
  cookie_policy_version: z.number(),
  categories: z.object({ functional: z.boolean(), analytics: z.boolean(), advertising: z.boolean() }),
  consent: z
    .object({
      policy_version: z.number(),
      method: z.string(),
      decided_at: z.string(),
      expires_at: z.string(),
      categories: z.record(z.string(), z.boolean()),
    })
    .nullable(),
});
export type Preferences = z.infer<typeof prefsSchema>;

export interface ConsentState {
  status: 'loading' | 'ready' | 'error';
  prefs: Preferences | null;
  /** Centro de preferencias abierto (lo abre el aviso o el enlace permanente del pie de página). */
  panelOpen: boolean;
}

const OFF: ConsentState = { status: 'loading', prefs: null, panelOpen: false };
let state: ConsentState = OFF;
const listeners = new Set<() => void>();

function set(next: Partial<ConsentState>) {
  const before = state.prefs?.categories;
  state = { ...state, ...next };
  if (next.prefs !== undefined || next.status) applyMechanisms(before);
  listeners.forEach((l) => l());
}

export const getConsent = () => state;
export const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));
/** ¿Autorizada AHORA? Falso mientras carga, si falló la consulta o si hay que volver a preguntar. */
export const hasConsent = (c: Category) => state.status === 'ready' && !!state.prefs?.categories[c];
export const useConsent = () => useSyncExternalStore(subscribe, getConsent, () => OFF);
export const openPreferences = () => set({ panelOpen: true });
export const closePreferences = () => set({ panelOpen: false });

// ---------- mecanismos por categoría (un solo lugar) ----------
export const ANALYTICS_SESSION_KEY = 'cris-news-session';

function applyMechanisms(before?: Record<string, boolean>) {
  if (typeof window === 'undefined') return;
  const decided = state.status === 'ready' && state.prefs && !state.prefs.needs_decision;
  const detector = i18n.services.languageDetector as
    { options: { caches?: string[] }; cacheUserLanguage?: (l: string) => void } | undefined;
  // Funcionales: recordar el idioma solo con permiso; si se niega o revoca, se borra lo guardado.
  if (detector) detector.options.caches = hasConsent('functional') ? ['localStorage'] : [];
  if (hasConsent('functional') && !before?.functional) detector?.cacheUserLanguage?.(i18n.language);
  if (decided && !hasConsent('functional')) safely(() => localStorage.removeItem(LANGUAGE_STORAGE_KEY));
  // Analíticas: sin permiso no hay identificador de lectura; al revocar se invalida el que existía.
  if (!hasConsent('analytics')) safely(() => sessionStorage.removeItem(ANALYTICS_SESSION_KEY));
}

function safely(fn: () => void) {
  try {
    fn();
  } catch {
    /* almacenamiento bloqueado por el navegador: no hay nada que borrar */
  }
}

// ---------- servidor ----------
let loading: Promise<void> | null = null;

/** Sin la marca `cris_consent_set` (la pone el servidor al decidir) este navegador nunca decidió. */
const NO_DECISION: Preferences = {
  needs_decision: true,
  cookie_policy_version: 0,
  categories: { functional: false, analytics: false, advertising: false },
  consent: null,
};
const markedDecided = () =>
  typeof document !== 'undefined' && /(?:^|;\s*)cris_consent_set=/.test(document.cookie);

/**
 * Consulta la decisión de este navegador una vez por carga de la aplicación. Si no hay marca de decisión,
 * el aviso se muestra YA (sin esperar la consulta): era el elemento LCP y llegaba tarde en celulares.
 * Lo opcional sigue apagado; la consulta confirma (y corrige a quien decidió antes de existir la marca).
 */
export function loadConsent(): Promise<void> {
  if (!loading && !markedDecided()) set({ status: 'ready', prefs: NO_DECISION });
  return (loading ??= call('/privacy/preferences', prefsSchema).then(
    (prefs) => set({ status: 'ready', prefs }),
    () => set(markedDecided() ? { status: 'error', prefs: null } : { status: 'ready', prefs: NO_DECISION }),
  ));
}

export async function saveConsent(choice: Record<Category, boolean>, method: Method) {
  const prefs = await call('/privacy/consents', prefsSchema, { method: 'POST', body: { ...choice, method } });
  set({ status: 'ready', prefs });
}

export async function revokeConsent() {
  const prefs = await call('/privacy/consents/revoke', prefsSchema, { method: 'POST' });
  set({ status: 'ready', prefs });
}

/** Solo pruebas: fija un estado conocido. */
export const __setConsentForTests = (next: Partial<ConsentState>) => {
  loading = next.status ? Promise.resolve() : null;
  set(next.status ? next : { ...OFF, ...next });
};
