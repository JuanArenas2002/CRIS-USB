import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import es from './locales/es';
import en from './locales/en';
import pt from './locales/pt';

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
    resources: { es, en, pt },
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
      caches: ['localStorage'],
    },
  });

const syncHtmlLang = () => {
  if (isBrowser) document.documentElement.lang = activeLocale();
};
syncHtmlLang();
i18n.on('languageChanged', syncHtmlLang);

export default i18n;
