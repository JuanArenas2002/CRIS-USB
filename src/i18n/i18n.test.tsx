import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n, { LANGUAGES, LANGUAGE_STORAGE_KEY } from '@/i18n';
import es from '@/i18n/locales/es';
import en from '@/i18n/locales/en';
import pt from '@/i18n/locales/pt';
import { ApiError } from '@/infrastructure/http/api-client';
import { TRANSLATE_TIMEOUT_MS } from '@/presentation/hooks/use-auto-translate';
import { fakeGroupRepo, fakeRepo, makeAuthor, makeGroupDetail, renderApp } from '@/test-utils';

/** Rutas `ns.a.b` de todas las hojas; las hojas deben ser texto no vacío. */
function leaves(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) return leaves(v, path);
    expect(typeof v === 'string' && v.trim(), `vacía: ${path}`).toBeTruthy();
    return [path];
  });
}

test('catálogos: mismas claves en todos los idiomas, sin textos vacíos', () => {
  const ref = leaves(es).sort();
  expect(new Set(ref).size).toBe(ref.length);
  for (const catalog of [en, pt]) expect(leaves(catalog).sort()).toEqual(ref);
  expect(LANGUAGES.map((l) => l.code)).toEqual(['es', 'en', 'pt']);
});

test('pluralización, interpolación segura y respaldo al español', async () => {
  expect(i18n.t('groups:count', { count: 1 })).toBe('1 Grupo');
  expect(i18n.t('groups:count', { count: 3 })).toBe('3 Grupos');
  // Interpolación sin escape (React escapa al pintar), pero sin ejecutar nada.
  expect(i18n.t('authors:byYear.point', { year: 2020, count: 2 })).toBe('2020: 2 productos');
  await i18n.changeLanguage('pt');
  expect(i18n.t('groups:count', { count: 1 })).toBe('1 Grupo');
  expect(i18n.t('authors:profile.productsBadge', { count: 2 })).toBe('2 produtos');
  // Clave ausente en portugués → texto en español, nunca la clave cruda ni un error.
  i18n.addResource('es', 'common', 'onlyInSpanish', 'solo en español');
  expect(i18n.t('common:onlyInSpanish' as 'common:loading')).toBe('solo en español');
});

test('selector: español por defecto; cambia todo al momento, conserva el formulario y recuerda la elección', async () => {
  renderApp('/');
  expect(document.documentElement.lang).toBe('es-CO');
  const search = await screen.findByLabelText('Buscar investigadores');
  await userEvent.type(search, 'ana');

  await userEvent.click(screen.getByLabelText('Idioma: Español')); // chip del encabezado
  await userEvent.click(
    within(screen.getByLabelText('Idioma: Español').closest('details')!).getByRole('button', {
      name: /English/,
    }),
  );

  expect(await screen.findByRole('heading', { name: 'Who does research at Unisimón' })).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: 'Groups' }).length).toBeGreaterThan(0); // menú y pie
  expect(screen.getByLabelText('Language: English').closest('details')).not.toHaveAttribute('open'); // se cierra al elegir
  expect(screen.getByRole('button', { name: /English/, current: true })).toBeInTheDocument();
  expect(screen.getByLabelText('Search researchers')).toBe(search); // mismo nodo: sin remontar ni recargar
  expect(search).toHaveValue('ana');
  expect(document.documentElement.lang).toBe('en-US');
  expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  await waitFor(() => expect(document.title).toBe('Researcher directory | Unisimón Research'));

  // "Recargar": el detector lee la preferencia guardada antes que el idioma del navegador.
  expect(i18n.services.languageDetector.detect()).toEqual(expect.arrayContaining(['en']));
});

test('errores del backend: el código se muestra en el idioma activo', async () => {
  await i18n.changeLanguage('pt');
  renderApp(
    '/',
    fakeRepo({
      list: async () => {
        throw new ApiError(503, 'El servicio de datos tuvo un problema.');
      },
    }),
  );
  expect(
    await screen.findByText('O serviço de dados teve um problema. Tente novamente.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
});

test('datos del backend: vocabulario controlado traducido, nombres intactos', async () => {
  await i18n.changeLanguage('en');
  renderApp('/investigadores/7', fakeRepo({}, [makeAuthor({ degree: 'Doctorado' })]));
  expect(await screen.findByRole('heading', { level: 1, name: 'Ana María Pérez' })).toBeInTheDocument();
  expect(screen.getByText('Doctorate')).toBeInTheDocument();
  expect(screen.getAllByText('Bioinformática y Salud').length).toBeGreaterThan(0); // nombre del grupo: tal cual

  renderApp('/grupos/1');
  expect(await screen.findByText('Institutional')).toBeInTheDocument();
  expect(screen.getByText('Call 833 of 2018')).toBeInTheDocument();
});

test('líneas de investigación: traducción automática del navegador, marcada como tal', async () => {
  const translate = vi.fn(async (s: string) => `[en] ${s}`);
  vi.stubGlobal('Translator', {
    availability: async () => 'available',
    create: async () => ({ translate }),
  });
  await i18n.changeLanguage('en');
  renderApp('/grupos/1');
  expect(await screen.findByText('[en] Genómica del Caribe')).toBeInTheDocument();
  expect(screen.getByText('[en] Estudiar la diversidad genética regional.')).toBeInTheDocument();
  expect(screen.getByText('Automatically translated from Spanish in your browser')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1, name: 'Bioinformática y Salud' })).toBeInTheDocument(); // nombre: no
  vi.unstubAllGlobals();
});

test('líneas de investigación: sin traductor en el navegador quedan en español y se avisa', async () => {
  await i18n.changeLanguage('pt');
  renderApp('/grupos/1', fakeRepo(), fakeGroupRepo([makeGroupDetail()]));
  const line = await screen.findByText('Genómica del Caribe');
  expect(line.closest('[lang]')).toHaveAttribute('lang', 'es');
  expect(screen.getByText(/Texto original em espanhol/)).toBeInTheDocument();
});

test('líneas de investigación: skeleton mientras traduce; con tope, vuelve al original', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubGlobal('Translator', {
    availability: async () => 'available',
    create: async () => ({ translate: () => new Promise<string>(() => {}) }), // nunca termina
  });
  await i18n.changeLanguage('pt');
  renderApp('/grupos/1');
  expect(await screen.findByLabelText('Traduzindo automaticamente…')).toHaveAttribute('aria-busy', 'true');
  expect(screen.queryByText('Genómica del Caribe')).not.toBeInTheDocument(); // el español no asoma

  await vi.advanceTimersByTimeAsync(TRANSLATE_TIMEOUT_MS);
  expect(await screen.findByText('Genómica del Caribe')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Traduzir' })).toBeInTheDocument();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
