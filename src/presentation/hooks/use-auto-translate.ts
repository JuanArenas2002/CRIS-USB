import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_LANGUAGE } from '@/i18n';

/**
 * Traducción automática de textos libres del backend (líneas de investigación) con la Translator API
 * del navegador (Chrome/Edge 138+): en el dispositivo, gratis y sin enviar datos a terceros. Sin la
 * API, el texto queda en español y la UI lo indica. Nombres propios y títulos científicos: no pasan por aquí.
 * ponytail: solo navegadores con la API; traducción en el BFF (DeepL/Google + caché) si hace falta cobertura total.
 */
interface BrowserTranslator {
  translate(text: string): Promise<string>;
}
interface TranslatorApi {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(o: { sourceLanguage: string; targetLanguage: string }): Promise<BrowserTranslator>;
}
const api = () => (globalThis as { Translator?: TranslatorApi }).Translator;
const pair = (lang: string) => ({ sourceLanguage: DEFAULT_LANGUAGE, targetLanguage: lang });

/** Tope del skeleton: pasado este tiempo se muestra el original. */
export const TRANSLATE_TIMEOUT_MS = 8000;

const translators = new Map<string, Promise<BrowserTranslator | null>>();
const cache = new Map<string, string>();

/** Dentro de un gesto del usuario (elegir idioma): Chrome exige el gesto para descargar el modelo. */
export function prepareTranslator(lang: string): void {
  const Translator = api();
  if (lang === DEFAULT_LANGUAGE || !Translator) return;
  translators.set(
    lang,
    Translator.create(pair(lang)).catch(() => null),
  );
}

/** Sin gesto solo sirve si el modelo ya está descargado; si no, null (y queda el botón "Traducir"). */
function translatorFor(lang: string): Promise<BrowserTranslator | null> {
  const known = translators.get(lang);
  if (known) return known;
  const Translator = api()!;
  const p = Translator.availability(pair(lang))
    .then((a) => (a === 'available' ? Translator.create(pair(lang)) : null))
    .catch(() => null);
  translators.set(lang, p);
  // Un intento fallido no se queda en caché: el siguiente render (o el botón) lo reintenta.
  void p.then((t) => {
    if (!t && translators.get(lang) === p) translators.delete(lang);
  });
  return p;
}

export type AutoTranslateStatus = 'original' | 'pending' | 'translated' | 'needs-gesture' | 'unavailable';

/** Devuelve los textos en el idioma activo (o los originales mientras tanto / si no se puede). */
export function useAutoTranslate(texts: string[]) {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? DEFAULT_LANGUAGE;
  const key = `${lang}\u0000${texts.join('\u0001')}`;
  const [state, setState] = useState<{ key: string; texts: string[]; status: AutoTranslateStatus } | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (lang === DEFAULT_LANGUAGE || !texts.length) return;
    const Translator = api();
    if (!Translator) return;
    let live = true;
    void (async () => {
      const availability = await Translator.availability(pair(lang)).catch(() => 'unavailable');
      if (availability === 'unavailable') return live && setState({ key, texts, status: 'unavailable' });
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        // Mientras dura `pending` la UI muestra un skeleton: con tope, para no esconder el texto si el
        // modelo tarda en descargarse.
        const out = await Promise.race([
          (async () => {
            const translator = await translatorFor(lang);
            if (!translator) throw new Error('sin traductor');
            return Promise.all(
              texts.map(async (s) => {
                if (!s.trim()) return s;
                const k = `${lang}\u0000${s}`;
                if (!cache.has(k)) cache.set(k, await translator.translate(s));
                return cache.get(k)!;
              }),
            );
          })(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('timeout')), TRANSLATE_TIMEOUT_MS);
          }),
        ]);
        if (live) setState({ key, texts: out, status: 'translated' });
      } catch {
        // Sin modelo, aún descargándose o fallo pasajero: texto original y botón para reintentar.
        if (live) setState({ key, texts, status: 'needs-gesture' });
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => {
      live = false;
    };
    // `key` resume `lang` y `texts`; `attempt` reintenta tras el botón "Traducir".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  if (lang === DEFAULT_LANGUAGE) return { texts, status: 'original' as const, lang, retry: () => {} };
  if (!api()) return { texts, status: 'unavailable' as const, lang, retry: () => {} };
  const current = state?.key === key ? state : null;
  return {
    texts: current?.texts ?? texts,
    status: current?.status ?? ('pending' as const),
    lang,
    /** Para el botón "Traducir": el clic es el gesto que permite descargar el modelo. */
    retry: () => {
      prepareTranslator(lang);
      setAttempt((n) => n + 1);
    },
  };
}
