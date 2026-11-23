import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { __setConsentForTests } from '@/infrastructure/privacy/consent';
import { renderApp } from '@/test-utils';

/** Backend de privacidad simulado: guarda la decisión como lo haría la cookie cris_consent. */
const CATEGORIES = [
  {
    code: 'necessary',
    name: 'Necesarias',
    description: 'Imprescindibles.',
    purpose: 'Funcionamiento.',
    retention: '12 meses',
    is_required: true,
    is_available: true,
    technologies: [
      { name: 'cris_consent', type: 'cookie', duration: '12 meses', provider: 'Propia', purpose: 'Decisión' },
    ],
  },
  {
    code: 'functional',
    name: 'Funcionales',
    description: 'Idioma.',
    purpose: 'Idioma.',
    retention: 'Hasta revocar',
    is_required: false,
    is_available: true,
    technologies: [],
  },
  {
    code: 'analytics',
    name: 'Analíticas y estadísticas',
    description: 'Lectura de noticias.',
    purpose: 'Estadísticas.',
    retention: '25 meses',
    is_required: false,
    is_available: true,
    technologies: [
      {
        name: 'cris-news-session',
        type: 'sessionStorage',
        duration: 'Hasta cerrar la pestaña',
        provider: 'Propia',
        purpose: 'Contar lecturas',
      },
    ],
  },
  {
    code: 'advertising',
    name: 'Publicidad y seguimiento',
    description: 'No se usa.',
    purpose: 'No aplica.',
    retention: 'No aplica.',
    is_required: false,
    is_available: false,
    technologies: [],
  },
];
const NEWS = {
  id: 7,
  title: 'Nueva convocatoria',
  slug: 'nueva-convocatoria',
  summary: 'Resumen',
  content: '<p>Contenido</p>',
  image_url: null,
  image_caption: null,
  category_id: 1,
  author_id: 1,
  relevance_level: 'medium',
  priority: 0,
  is_featured: false,
  is_pinned: false,
  start_at: null,
  end_at: null,
  published_at: '2026-11-01T10:00:00Z',
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
  status: 'published',
  tags: [],
  scopes: [],
  people: [],
};

function fakeBackend(
  initial: { decided?: Record<string, boolean>; version?: number; policyVersion?: number } = {},
) {
  let decided = initial.decided ?? null;
  const policyVersion = initial.policyVersion ?? 1;
  const decidedOn = initial.version ?? policyVersion;
  const prefs = () => {
    const needs = !decided || decidedOn < policyVersion;
    const cats = { functional: false, analytics: false, ...(needs ? {} : decided) };
    return {
      needs_decision: needs,
      cookie_policy_version: policyVersion,
      categories: { ...cats, advertising: false },
      consent: decided
        ? {
            policy_version: decidedOn,
            method: 'custom',
            decided_at: '2026-11-13T10:00:00Z',
            expires_at: '2027-11-13T10:00:00Z',
            categories: decided,
          }
        : null,
    };
  };
  const json = (body: unknown, status = 200) =>
    Promise.resolve(
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
    );
  return vi.fn((url: string, init?: RequestInit) => {
    const path = String(url).replace(/^.*\/news-api/, '');
    const body = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    if (path === '/privacy/preferences') return json(prefs());
    if (path === '/privacy/consents') {
      decided = { functional: body.functional, analytics: body.analytics };
      return json(prefs());
    }
    if (path === '/privacy/consents/revoke') {
      decided = { functional: false, analytics: false };
      return json(prefs());
    }
    if (path === '/privacy/cookie-categories') return json(CATEGORIES);
    if (path === '/news/nueva-convocatoria') return json(NEWS);
    if (path === '/news/lecturas') return json({ accepted: 1 }, 202);
    return json({ detail: 'No encontrado' }, 404);
  });
}

const posts = (f: ReturnType<typeof fakeBackend>, path: string) =>
  f.mock.calls.filter(([u, i]) => String(u).endsWith(path) && i?.method === 'POST');
const beacons: string[] = [];

beforeEach(() => {
  __setConsentForTests({}); // como una carga nueva: se consulta la decisión al servidor
  beacons.length = 0;
  navigator.sendBeacon = (url: string | URL) => (beacons.push(String(url)), true);
});
afterEach(() => vi.unstubAllGlobals());

const banner = () => screen.findByRole('region', { name: 'Aviso de cookies y privacidad' });

test('primer ingreso: aviso con aceptar/rechazar del mismo peso, enlaces a políticas y CERO eventos analíticos', async () => {
  const f = fakeBackend();
  vi.stubGlobal('fetch', f);
  renderApp('/noticias/nueva-convocatoria');
  const b = await banner();
  const accept = within(b).getByRole('button', { name: 'Aceptar todas' });
  const reject = within(b).getByRole('button', { name: 'Rechazar opcionales' });
  expect(accept.className).toBe(reject.className); // ningún botón empuja a aceptar
  expect(within(b).getByRole('button', { name: 'Configurar preferencias' })).toBeInTheDocument();
  for (const name of ['Política de privacidad', 'Política de cookies', 'Aviso de privacidad'])
    expect(within(b).getByRole('link', { name })).toHaveAttribute(
      'href',
      expect.stringContaining('/privacidad'),
    );
  expect(await screen.findByRole('heading', { name: 'Nueva convocatoria' })).toBeInTheDocument();
  expect(beacons).toEqual([]); // la noticia se lee sin medir: el silencio no autoriza
  expect(sessionStorage.getItem('cris-news-session')).toBeNull();
  expect(document.querySelectorAll('script[src^="http"]')).toHaveLength(0); // sin scripts de terceros
});

test('aceptar todas: guarda la decisión, oculta el aviso y empieza a medir la lectura', async () => {
  const f = fakeBackend();
  vi.stubGlobal('fetch', f);
  renderApp('/noticias/nueva-convocatoria');
  await userEvent.click(within(await banner()).getByRole('button', { name: 'Aceptar todas' }));
  await waitFor(() => expect(beacons.some((u) => u.endsWith('/news/lecturas'))).toBe(true));
  expect(JSON.parse(String(posts(f, '/privacy/consents')[0]![1]!.body))).toEqual({
    functional: true,
    analytics: true,
    method: 'accept_all',
  });
  expect(screen.queryByRole('region', { name: 'Aviso de cookies y privacidad' })).not.toBeInTheDocument();
});

test('rechazar opcionales: no mide y no vuelve a preguntar al navegar ni al volver', async () => {
  const f = fakeBackend();
  vi.stubGlobal('fetch', f);
  const { unmount } = renderApp('/noticias/nueva-convocatoria');
  await userEvent.click(within(await banner()).getByRole('button', { name: 'Rechazar opcionales' }));
  await waitFor(() =>
    expect(screen.queryByRole('region', { name: 'Aviso de cookies y privacidad' })).not.toBeInTheDocument(),
  );
  await userEvent.click(screen.getAllByRole('link', { name: 'Noticias' })[0]!); // otra página
  expect(screen.queryByRole('region', { name: 'Aviso de cookies y privacidad' })).not.toBeInTheDocument();
  unmount();
  __setConsentForTests({}); // vuelve otro día: la decisión viene del servidor
  renderApp('/noticias/nueva-convocatoria');
  expect(await screen.findByRole('heading', { name: 'Nueva convocatoria' })).toBeInTheDocument();
  await waitFor(() =>
    expect(f.mock.calls.filter(([u]) => String(u).endsWith('/privacy/preferences'))).toHaveLength(2),
  );
  expect(screen.queryByRole('region', { name: 'Aviso de cookies y privacidad' })).not.toBeInTheDocument();
  expect(beacons).toEqual([]);
});

test('configurar: categorías con finalidad, tecnologías y duración; necesarias fijas; elección individual', async () => {
  const f = fakeBackend();
  vi.stubGlobal('fetch', f);
  renderApp('/');
  await userEvent.click(within(await banner()).getByRole('button', { name: 'Configurar preferencias' }));
  const dialog = await screen.findByRole('dialog', { name: 'Configuración de cookies y privacidad' });
  const necessary = await within(dialog).findByRole('switch', { name: 'Necesarias' });
  expect(necessary).toBeChecked();
  expect(necessary).toBeDisabled();
  expect(within(dialog).getByRole('switch', { name: 'Publicidad y seguimiento' })).toBeDisabled();
  expect(within(dialog).getByText('No se usa')).toBeInTheDocument();
  expect(within(dialog).getByText('cris-news-session')).toBeInTheDocument();
  const analytics = within(dialog).getByRole('switch', { name: 'Analíticas y estadísticas' });
  expect(analytics).not.toBeChecked(); // nada opcional viene marcado
  await userEvent.click(analytics);
  await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar mis preferencias' }));
  expect(await within(dialog).findByText('Preferencias guardadas.')).toBeInTheDocument();
  expect(JSON.parse(String(posts(f, '/privacy/consents')[0]![1]!.body))).toEqual({
    functional: false,
    analytics: true,
    method: 'custom',
  });
});

test('acceso permanente en el pie: revocar es un clic y apaga la medición', async () => {
  const f = fakeBackend({ decided: { functional: true, analytics: true } });
  vi.stubGlobal('fetch', f);
  renderApp('/noticias/nueva-convocatoria');
  await waitFor(() => expect(beacons.length).toBeGreaterThan(0)); // ya autorizada: mide
  expect(screen.queryByRole('region', { name: 'Aviso de cookies y privacidad' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Configuración de cookies y privacidad' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText(/Tu decisión vigente/)).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Revocar mi autorización' }));
  expect(await within(dialog).findByText(/Autorización revocada/)).toBeInTheDocument();
  expect(posts(f, '/privacy/consents/revoke')).toHaveLength(1);
  expect(sessionStorage.getItem('cris-news-session')).toBeNull(); // identificador invalidado
  const before = beacons.length;
  window.dispatchEvent(new Event('scroll'));
  await new Promise((r) => setTimeout(r, 50));
  expect(beacons.length).toBe(before);
});

test('nueva versión sustancial de la política: se vuelve a preguntar y no se mide mientras tanto', async () => {
  vi.stubGlobal(
    'fetch',
    fakeBackend({ decided: { functional: true, analytics: true }, version: 1, policyVersion: 2 }),
  );
  renderApp('/noticias/nueva-convocatoria');
  const b = await banner();
  expect(within(b).getByText(/Actualizamos la política de cookies \(versión 2\)/)).toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: 'Nueva convocatoria' })).toBeInTheDocument();
  expect(beacons).toEqual([]);
});

test('sin decisión previa el aviso aparece sin esperar al servidor (LCP en celulares) y nada se mide', async () => {
  const f = fakeBackend();
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) =>
      String(url).endsWith('/privacy/preferences') ? new Promise<Response>(() => {}) : f(url, init),
    ),
  );
  renderApp('/noticias/nueva-convocatoria');
  expect(await banner()).toBeInTheDocument(); // la consulta sigue pendiente
  expect(beacons).toEqual([]);
});
