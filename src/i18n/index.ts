import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import es from './locales/es';

/** Para sumar un idioma: su catálogo (tipado como `typeof es`) y una entrada aquí. */
export const LANGUAGES = [
  { code: 'es', label: 'Español', locale: 'es-CO' },
  { code: 'en', label: 'English', locale: 'en-US' },
  { code: 'pt', label: 'Português', locale: 'pt-BR' },
] as const;
export type LanguageCode = (typeof LANGUAGES)[number]['code'];
export const DEFAULT_LANGUAGE: LanguageCode = 'es';
export const LANGUAGE_STORAGE_KEY = 'cris-lang';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: typeof es;
  }
}

/** Locale de Intl para el idioma activo (es → es-CO: separador de miles también en 4 cifras). */
export const activeLocale = () =>
  LANGUAGES.find((l) => l.code === i18n.resolvedLanguage)?.locale ?? LANGUAGES[0].locale;

const isBrowser = typeof window !== 'undefined';
// Googlebot renderiza con JS y anuncia en-US: sin esto indexaría las URLs canónicas en inglés.
// ponytail: lista por User-Agent; si se publican URLs por idioma (/en, /pt), sobra.
const isCrawler = isBrowser && /bot|crawler|spider|slurp|facebookexternalhit/i.test(navigator.userAgent);

// Catálogos en el bundle: son pequeños y así no hay parpadeo de claves ni carga asíncrona.
// ponytail: pasar a i18next-http-backend (carga por idioma) si los catálogos crecen mucho.
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Solo español en el bundle (prerender y casi todas las visitas); inglés y portugués se descargan al
    // elegirlos o si el navegador los pide (ver loadLanguage): ≈19 KB menos para cada visitante.
    resources: { es },
    // El prerender (Node) siempre es español: el HTML indexado y la URL canónica no cambian por idioma.
    // Los rastreadores, también: es el contenido que ya está indexado.
    lng: isBrowser && !isCrawler ? undefined : DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: LANGUAGES.map((l) => l.code),
    nonExplicitSupportedLngs: true, // pt-BR, en-GB… → pt, en
    load: 'languageOnly',
    ns: Object.keys(es),
    defaultNS: 'common',
    initAsync: false,
    interpolation: { escapeValue: false }, // React ya escapa
    react: { useSuspense: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      // Guardar el idioma es «funcional»: se activa solo con permiso (infrastructure/privacy/consent.ts).
      caches: [],
    },
  });

const LOADERS: Record<string, () => Promise<{ default: typeof es }>> = {
  en: () => import('./locales/en'),
  pt: () => import('./locales/pt'),
};

/** Descarga y registra el catálogo de un idioma (una sola vez). El español ya viene en el bundle. */
export async function loadLanguage(lng?: string) {
  const code = (lng ?? '').split('-')[0]!;
  const load = LOADERS[code];
  if (!load || i18n.hasResourceBundle(code, 'common')) return;
  const { default: bundle } = await load();
  for (const [ns, resources] of Object.entries(bundle))
    i18n.addResourceBundle(code, ns, resources, true, true);
}

// changeLanguage siempre espera su catálogo: el selector y quien lo llame ven el idioma completo, sin claves.
const changeLanguage = i18n.changeLanguage.bind(i18n);
i18n.changeLanguage = (async (lng?: string, callback?: Parameters<typeof changeLanguage>[1]) => {
  await loadLanguage(lng);
  return changeLanguage(lng, callback);
}) as typeof i18n.changeLanguage;

// Idioma detectado distinto del español (navegador o preferencia guardada): se pinta en español y cambia
// apenas llega su catálogo (el HTML prerenderizado ya es español, así que no hay salto extra).
if (isBrowser && LOADERS[(i18n.language ?? '').split('-')[0]!]) void i18n.changeLanguage(i18n.language);

const syncHtmlLang = () => {
  if (isBrowser) document.documentElement.lang = activeLocale();
};
syncHtmlLang();
i18n.on('languageChanged', syncHtmlLang);

export default i18n;
