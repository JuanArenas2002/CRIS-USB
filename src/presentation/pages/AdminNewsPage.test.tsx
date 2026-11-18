import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderApp } from '@/test-utils';

const USER = {
  id: 1,
  first_name: 'Juan',
  last_name: 'Arenas',
  email: 'juan@unisimon.edu.co',
  status: 'active',
  account_type: 'institutional',
  email_verified: true,
  last_login_at: null,
  auth_methods: ['password'],
  identities: [],
  must_change_password: false,
  session: {
    id: 9,
    method: 'password',
    created_at: '2026-11-11T10:00:00Z',
    expires_at: '2026-11-11T22:00:00Z',
  },
};

const CATALOGS = {
  statuses: [
    { id: 1, code: 'draft', name: 'Borrador' },
    { id: 2, code: 'in_review', name: 'En revisión' },
  ],
  relevance_levels: [{ id: 2, code: 'medium', name: 'Media' }],
  scope_types: [
    { id: 3, code: 'faculty', name: 'Facultad' },
    { id: 2, code: 'research_center', name: 'Centro de investigación' },
  ],
  person_types: [{ id: 1, code: 'researcher', name: 'Investigador' }],
  relationship_types: [
    { id: 1, code: 'protagonist', name: 'Protagonista' },
    { id: 2, code: 'speaker', name: 'Vocero' },
  ],
  categories: [{ id: 1, name: 'Investigación' }],
};

/** Perfil ORCID como lo entrega el BFF (/api/orcid/{orcid}). */
const CARBERRY = {
  orcid: '0000-0002-1825-0097',
  uri: 'https://orcid.org/0000-0002-1825-0097',
  givenName: 'Josiah',
  middleName: null,
  familyName: 'Carberry',
  publishedName: null,
  displayName: 'Josiah Carberry',
  biography: null,
  country: 'US',
  createdAt: null,
  lastModifiedAt: null,
  educations: [],
  employments: [
    {
      kind: 'employment',
      organization: 'Wesleyan University',
      department: 'Psychoceramics',
      role: 'Professor',
      startDate: '1930',
      endDate: null,
      current: true,
      city: null,
      region: null,
      country: 'US',
      orgId: null,
      ror: null,
      url: null,
      source: null,
      visibility: 'public',
      putCode: 1,
    },
  ],
};

const SYNC = '2026-11-11T15:00:00Z';
const program = (id: number, name: string, level: string, over: object = {}) => ({
  id,
  name,
  faculty_id: 5,
  code_snies: `10${id}`,
  level_academic: level,
  level_education: 'Universitario',
  modality: 'Presencial',
  is_active: true,
  synced_at: SYNC,
  ...over,
});
const ORG = {
  faculties: [
    { id: 5, name: 'Facultad de Ingenierías', is_active: true, synced_at: SYNC },
    { id: 3, name: 'Facultad de Ciencias de la Salud', is_active: true, synced_at: SYNC },
  ],
  programs: [
    program(8, 'DISEÑO INDUSTRIAL', 'Pregrado'),
    program(15, 'DOCTORADO EN GESTION DE LA TECNOLOGIA', 'Posgrado'),
    program(20, 'ENFERMERÍA', 'Pregrado', { faculty_id: 3 }),
  ],
  centers: [
    {
      id: 4,
      name: 'Centro de Inteligencia Artificial',
      code: 'CI-4',
      acronym: 'AudacIA',
      is_active: true,
      date_created: '2021-01-01',
      date_closed: null,
      synced_at: SYNC,
    },
    {
      id: 8,
      name: 'Centro Marino',
      code: 'CI-7',
      acronym: 'CICMAR',
      is_active: false,
      date_created: '2015-10-01',
      date_closed: '2022-05-01',
      synced_at: SYNC,
    },
  ],
};

const newsItem = (over: object = {}) => ({
  id: 7,
  title: 'Nueva convocatoria',
  slug: 'nueva-convocatoria',
  summary: 'r',
  content: '<p>c</p>',
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
  published_at: null,
  created_at: '2026-11-11T10:00:00Z',
  updated_at: '2026-11-11T10:00:00Z',
  status: 'draft',
  tags: [],
  scopes: [{ scope_type: 'faculty', scope_id: 5 }],
  people: [],
  ...over,
});

const totals = (views: number) => ({
  page_views: views,
  unique_visitors: Math.round(views * 0.7),
  sessions: Math.round(views * 0.8),
  active_seconds: views * 50,
  engaged: Math.round(views / 2),
  news_viewed: 3,
  shares: 12,
  news_published: 2,
  avg_active_per_view: 50,
  avg_active_per_session: 62.5,
  engaged_rate: 0.5,
  share_rate: 12 / views,
  avg_views_per_news: views / 3,
});
const rankRow = {
  id: 7,
  slug: 'nueva-convocatoria',
  title: 'Nueva convocatoria',
  category_id: 1,
  published_at: '2026-10-01T15:00:00Z',
  views: 1234,
  prev_views: 1000,
  visitors: 864,
  shares: 12,
  active_seconds: 61700,
  avg_active: 50,
  engaged_rate: 0.5,
  growth: 234,
};
const OVERVIEW = {
  period: {
    start: '2026-10-14',
    end: '2026-11-12',
    previous_start: '2026-09-14',
    previous_end: '2026-10-13',
    granularity: 'day',
  },
  totals: totals(1234),
  previous: totals(1000),
  timeline: [
    {
      period: '2026-11-11',
      page_views: 600,
      unique_visitors: 420,
      sessions: 500,
      active_seconds: 3000,
      shares: 5,
    },
    {
      period: '2026-11-12',
      page_views: 634,
      unique_visitors: 444,
      sessions: 487,
      active_seconds: 3170,
      shares: 7,
    },
  ],
  previous_timeline: [
    {
      period: '2026-10-12',
      page_views: 500,
      unique_visitors: 350,
      sessions: 400,
      active_seconds: 2500,
      shares: 4,
    },
    {
      period: '2026-10-13',
      page_views: 500,
      unique_visitors: 350,
      sessions: 400,
      active_seconds: 2500,
      shares: 4,
    },
  ],
  sources: [
    { key: 'search', page_views: 900 },
    { key: 'direct', page_views: 334 },
  ],
  devices: [{ key: 'mobile', page_views: 1234 }],
  browsers: [{ key: 'Chrome', page_views: 1234 }],
  os: [{ key: 'Android', page_views: 1234 }],
  referrers: [{ key: 'google.com', page_views: 900 }],
  channels: [],
  read_distribution: [{ key: '0–10 s', page_views: 1234 }],
  navigation: { entries: 1000, from_other_news: 50 },
  min_views_for_averages: 5,
};

/** Backend de noticias simulado: sin sesión hasta que el login acierta. */
function fakeBackend({
  microsoft = false,
  permissions = ['news.create', 'news.view', 'news.submit'],
  grants = [] as { permission: string; scope_type: string | null; scope_id: number | null }[],
  mustChange = false,
} = {}) {
  let logged = false;
  let temporary = mustChange;
  const me = () => ({ ...USER, must_change_password: temporary });
  let stored = newsItem();
  const json = (status: number, body: unknown) =>
    Promise.resolve(
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
    );
  return vi.fn((url: string, init?: RequestInit) => {
    if (url.includes('/api/orcid/search'))
      return json(200, [
        { orcid: '0000-0002-1825-0097', name: 'Ana M. Pérez', institutions: ['Unisimón'] }, // ya en el directorio
        { orcid: '0000-0001-5109-3700', name: 'Ana Pereira', institutions: ['Universidade do Porto'] },
      ]);
    if (url.includes('/api/orcid/')) {
      const orcid = decodeURIComponent(url.split('/api/orcid/')[1]!);
      return orcid === CARBERRY.orcid ? json(200, CARBERRY) : json(404, { detail: 'No existe' });
    }
    const path = url.replace(/^.*\/news-api/, '');
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (path === '/auth/providers') return json(200, { password: true, microsoft });
    if (path === '/auth/me')
      return logged ? json(200, me()) : json(401, { detail: 'Sesión inválida o expirada' });
    if (path === '/auth/me/permissions')
      return temporary
        ? json(403, { detail: 'Debes cambiar tu contraseña temporal' })
        : json(200, {
            permissions,
            grants: grants.map((g) => ({ ...g, permission_name: g.permission })),
            names: Object.fromEntries(permissions.map((p) => [p, p])),
          });
    if (path === '/auth/login') {
      if (body.password !== 'Clave-Correcta-2026')
        return json(401, { detail: 'Correo o contraseña incorrectos' });
      logged = true;
      return json(200, { user: me(), csrf_token: 'csrf-123' });
    }
    if (path === '/auth/logout') {
      logged = false;
      return json(200, { federated_logout_url: null });
    }
    if (path === '/auth/reset-password') return json(200, { detail: 'ok' });
    if (path === '/auth/change-password') {
      temporary = false;
      return json(200, { detail: 'ok' });
    }
    if (path.startsWith('/users?')) return json(200, { items: [], total: 0, limit: 20, offset: 0 });
    if (path === '/users' && method === 'POST')
      return json(201, {
        ...USER,
        ...body,
        id: 2,
        must_change_password: true,
        created_at: SYNC,
        updated_at: SYNC,
        locked_until: null,
        linked_identities: [],
      });
    if (path === '/news/catalogs') return json(200, CATALOGS);
    if (path.startsWith('/organization/faculties')) return json(200, ORG.faculties);
    if (path.startsWith('/organization/centers')) return json(200, ORG.centers);
    if (path.startsWith('/organization/programs')) return json(200, ORG.programs);
    if (path.startsWith('/news?') || path === '/news') {
      if (method === 'POST') {
        stored = newsItem({ ...body, id: 7, slug: 'nueva-convocatoria' }); // el backend genera el slug
        return json(201, stored);
      }
      return json(200, [stored]);
    }
    if (path.startsWith('/news/analytics/overview'))
      return json(200, {
        ...OVERVIEW,
        top: { views: [rankRow], shares: [rankRow], avg_active: [], growth: [rankRow], low: [rankRow] },
      });
    if (path.startsWith('/news/analytics/live'))
      return json(200, {
        at: '2026-11-12T20:00:00Z',
        window_seconds: 45,
        active_readers: 3,
        views_last_30_min: 17,
        reading_now: [{ id: 7, title: 'Nueva convocatoria', readers: 3 }],
      });
    if (path.startsWith('/news/analytics/news'))
      return json(200, { total: 1, page: 1, page_size: 20, items: [rankRow] });
    if (path.startsWith('/news/7/analytics'))
      return json(200, {
        ...OVERVIEW,
        title: 'Nueva convocatoria',
        slug: 'nueva-convocatoria',
        status: 'published',
        published_at: '2026-10-01T15:00:00Z',
        news: rankRow,
        comparison: null,
      });
    if (path === '/news/7') return json(200, stored);
    if (path === '/news/7/history') return json(200, []);
    if (path === '/news/7/submit') {
      stored = newsItem({ status: 'in_review' });
      return json(200, stored);
    }
    return json(404, { detail: 'No encontrado' });
  });
}

async function login() {
  await userEvent.type(await screen.findByLabelText('Correo institucional'), 'juan@unisimon.edu.co');
  await userEvent.type(screen.getByLabelText('Contraseña'), 'Clave-Correcta-2026');
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
}

afterEach(() => vi.unstubAllGlobals());

test('admin/noticias: login con contraseña, sesión por cookie, CSRF al cerrar sesión', async () => {
  const fetchMock = fakeBackend();
  vi.stubGlobal('fetch', fetchMock);
  renderApp('/admin/noticias');

  await userEvent.type(await screen.findByLabelText('Correo institucional'), 'juan@unisimon.edu.co');
  await userEvent.type(screen.getByLabelText('Contraseña'), 'mala');
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos');
  // Sin configurar en el backend: el botón se ve pero deshabilitado, con el motivo (y sin enlace).
  expect(screen.queryByRole('link', { name: /Microsoft/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Iniciar sesión con Microsoft' })).toBeDisabled();
  expect(screen.getByText(/Aún no está habilitado/)).toBeInTheDocument();

  await userEvent.clear(screen.getByLabelText('Contraseña'));
  await userEvent.type(screen.getByLabelText('Contraseña'), 'Clave-Correcta-2026');
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
  expect(await screen.findByText('Juan Arenas')).toBeInTheDocument();
  expect(await screen.findByText('Nueva convocatoria')).toBeInTheDocument(); // tarjeta del listado

  const loginCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/auth/login'))!;
  expect(loginCall[1]).toMatchObject({ method: 'POST', credentials: 'include' }); // la cookie viaja

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  await screen.findByLabelText('Correo institucional');
  const logout = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/auth/logout'))!;
  expect((logout[1]!.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-123');
  // Flujo largo (error, reintento, listado, cierre): margen para equipos cargados (build, navegadores).
}, 15_000);

test('admin/noticias: las pestañas dependen de los permisos (el backend vuelve a verificar)', async () => {
  vi.stubGlobal('fetch', fakeBackend());
  renderApp('/admin/noticias');
  await login();
  const nav = await screen.findByRole('navigation', { name: 'Secciones del panel' });
  expect(within(nav).getByRole('link', { name: 'Noticias' })).toBeInTheDocument();
  expect(within(nav).getByRole('link', { name: 'Mi cuenta' })).toBeInTheDocument();
  for (const hidden of ['Usuarios', 'Roles', 'Permisos', 'Auditoría'])
    expect(within(nav).queryByRole('link', { name: hidden })).not.toBeInTheDocument();
});

test('admin/noticias: crear borrador y enviarlo a revisión', async () => {
  const fetchMock = fakeBackend();
  vi.stubGlobal('fetch', fetchMock);
  renderApp('/admin/noticias/nueva');
  await login();
  await userEvent.type(await screen.findByLabelText(/^Título/), 'Nueva convocatoria');
  await userEvent.selectOptions(screen.getByLabelText(/^Categoría/), '1');
  await userEvent.type(screen.getByLabelText(/^Resumen/), 'r');
  await userEvent.type(screen.getByLabelText(/Contenido/), 'c');
  await userEvent.click(screen.getByRole('button', { name: 'Crear borrador' }));

  const create = await waitFor(() =>
    fetchMock.mock.calls.find(([u, i]) => String(u).endsWith('/news') && i?.method === 'POST')!,
  );
  expect(JSON.parse(String(create[1]!.body))).toMatchObject({ title: 'Nueva convocatoria', category_id: 1 });
  await userEvent.click(await screen.findByRole('button', { name: 'Enviar a revisión' }));
  expect(await screen.findByText(/Enviada a revisión/)).toBeInTheDocument();
});

test('admin/noticias: sin permisos de noticias no muestra el panel; Microsoft visible si está configurado', async () => {
  vi.stubGlobal('fetch', fakeBackend({ microsoft: true, permissions: ['users.view'] }));
  renderApp('/admin/noticias?error=microsoft&code=403');
  expect(await screen.findByRole('alert')).toHaveTextContent('no está habilitada');
  expect(screen.getByRole('link', { name: /Microsoft/ })).toHaveAttribute(
    'href',
    '/news-api/auth/microsoft/login?next=%2Fadmin%2Fnoticias',
  );
  await login();
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('no tiene permisos en el módulo de noticias'),
  );
  expect(screen.getByRole('link', { name: 'Usuarios' })).toBeInTheDocument();
});

test('admin/noticias/restablecer: el enlace del correo funciona sin sesión', async () => {
  const fetchMock = fakeBackend();
  vi.stubGlobal('fetch', fetchMock);
  renderApp('/admin/noticias/restablecer?token=tok-12345678901234567890');
  await userEvent.type(await screen.findByLabelText(/^Nueva contraseña/), 'Nueva-Clave-2026');
  await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'Nueva-Clave-2026');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
  expect(await screen.findByText(/Contraseña actualizada/)).toBeInTheDocument();
  const reset = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/auth/reset-password'))!;
  expect(JSON.parse(String(reset[1]!.body))).toEqual({
    token: 'tok-12345678901234567890',
    new_password: 'Nueva-Clave-2026',
  });
});

test('admin/noticias/dependencias: resumen, facultades con sus programas, búsqueda y centros', async () => {
  vi.stubGlobal('fetch', fakeBackend());
  renderApp('/admin/noticias/dependencias');
  await login();
  expect(await screen.findByText(/Última sincronización/)).toBeInTheDocument();
  expect(screen.getByText('2 de pregrado · 1 de posgrado')).toBeInTheDocument();
  expect(screen.queryByText(/#\d/)).not.toBeInTheDocument(); // sin ids internos

  // Facultad desplegable: programas por nivel, en formato título (Metri-K los guarda en MAYÚSCULAS).
  await userEvent.click(screen.getByRole('button', { name: /Facultad de Ingenierías/ }));
  expect(screen.getByText('Diseño Industrial')).toBeInTheDocument();
  expect(screen.getByText('Doctorado en Gestion de la Tecnologia')).toBeInTheDocument();
  expect(screen.getByText('Pregrado (1)')).toBeInTheDocument();

  // Búsqueda sin tildes: encuentra el programa y muestra solo su facultad.
  await userEvent.type(screen.getByLabelText('Buscar dependencia'), 'enfermeria');
  expect(await screen.findByText('Enfermería')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Facultad de Ingenierías/ })).not.toBeInTheDocument();

  await userEvent.clear(screen.getByLabelText('Buscar dependencia'));
  await userEvent.click(screen.getByRole('button', { name: 'Centros de investigación' }));
  expect(screen.getByText('AudacIA')).toBeInTheDocument();
  expect(screen.getByText('Cerrado')).toBeInTheDocument();
  expect(screen.getByText(/cerrado en 2022/)).toBeInTheDocument();
});

test('admin/noticias: agregar persona buscando por nombre (universidad + ORCID) y confirmando su papel', async () => {
  const fetchMock = fakeBackend();
  vi.stubGlobal('fetch', fetchMock);
  renderApp('/admin/noticias/nueva');
  await login();
  const search = await screen.findByRole('combobox', { name: 'Agregar persona' });

  await userEvent.type(search, '0000-0002-1825-0098'); // dígito de control incorrecto
  expect(await screen.findByText(/Parece un ORCID pero no es válido/)).toBeInTheDocument();
  await userEvent.clear(search);

  // Por nombre, sin tildes: primero el directorio de la universidad, luego ORCID (sin duplicar).
  await userEvent.type(search, 'ana pere');
  const list = await screen.findByRole('listbox', { name: 'Personas encontradas' });
  expect(within(list).getByRole('group', { name: 'Investigadores de la universidad' })).toHaveTextContent(
    'Ana María Pérez',
  );
  expect(await within(list).findByRole('group', { name: 'Otras personas en ORCID' })).toHaveTextContent(
    'Ana Pereira',
  );
  expect(within(list).queryByText('Ana M. Pérez')).not.toBeInTheDocument();

  // Teclado: ↓ va a ORCID, ↑ vuelve, Enter elige.
  await userEvent.keyboard('{ArrowDown}');
  expect(within(list).getByRole('option', { selected: true })).toHaveTextContent('Ana Pereira');
  await userEvent.keyboard('{ArrowUp}{Enter}');

  // Confirmación con valores por defecto (investigador, protagonista).
  expect(await screen.findByText('✓ Perfil ORCID verificado')).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Investigador' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Protagonista' })).toBeChecked();
  await userEvent.click(screen.getByRole('button', { name: /Agregar a la noticia/ }));
  expect(await screen.findByText(/se agregó como protagonista/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /0000-0002-1825-0097/ })).toHaveAttribute(
    'href',
    'https://orcid.org/0000-0002-1825-0097',
  );

  // Ya agregada: aparece marcada y no se puede elegir otra vez.
  const search2 = screen.getByRole('combobox', { name: 'Agregar persona' });
  expect(search2).toHaveFocus(); // listo para la siguiente persona
  await userEvent.type(search2, 'ana pere');
  const again = await screen.findByRole('option', { name: /Ana María Pérez/ });
  expect(again).toHaveAttribute('aria-disabled', 'true');
  expect(again).toHaveTextContent('Ya agregada');
  await userEvent.clear(search2);

  // El papel se cambia en la misma fila.
  await userEvent.selectOptions(screen.getByRole('combobox', { name: /^Papel de / }), 'speaker');

  await userEvent.type(screen.getByLabelText(/^Título/), 'Con investigador');
  await userEvent.selectOptions(screen.getByLabelText(/^Categoría/), '1');
  await userEvent.type(screen.getByLabelText(/^Resumen/), 'r');
  await userEvent.click(screen.getByRole('button', { name: 'HTML' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'Código HTML del contenido' }), '<p>c</p>');
  await userEvent.click(screen.getByRole('button', { name: 'Crear borrador' }));
  const create = await waitFor(() =>
    fetchMock.mock.calls.find(([u, i]) => String(u).endsWith('/news') && i?.method === 'POST')!,
  );
  expect(JSON.parse(String(create[1]!.body)).people).toEqual([
    { person_type: 'researcher', orcid: '0000-0002-1825-0097', relationship_type: 'speaker' },
  ]);
});

test('admin/noticias: rol "Centro de investigación" => la noticia nueva ya viene asociada a su centro', async () => {
  const perms = ['news.view', 'news.create', 'news.update', 'news.submit'];
  const fetchMock = fakeBackend({
    permissions: perms,
    grants: perms.map((permission) => ({ permission, scope_type: 'research_center', scope_id: 4 })),
  });
  vi.stubGlobal('fetch', fetchMock);
  renderApp('/admin/noticias/nueva');
  await login();
  expect(await screen.findByText(/Centro de Inteligencia Artificial|AudacIA/)).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText(/^Título/), 'Del centro');
  await userEvent.selectOptions(screen.getByLabelText(/^Categoría/), '1');
  await userEvent.type(screen.getByLabelText(/^Resumen/), 'r');
  await userEvent.click(screen.getByRole('button', { name: 'HTML' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'Código HTML del contenido' }), '<p>c</p>');
  await userEvent.click(screen.getByRole('button', { name: 'Crear borrador' }));
  const create = await waitFor(() =>
    fetchMock.mock.calls.find(([u, i]) => String(u).endsWith('/news') && i?.method === 'POST')!,
  );
  expect(JSON.parse(String(create[1]!.body)).scopes).toEqual([
    { scope_type: 'research_center', scope_id: 4 },
  ]);
});

test('admin/noticias: con contraseña temporal pide cambiarla antes de mostrar el panel', async () => {
  const fetchMock = fakeBackend({ mustChange: true });
  vi.stubGlobal('fetch', fetchMock);
  renderApp('/admin/noticias');
  await login();
  expect(await screen.findByRole('heading', { name: 'Crea tu contraseña' })).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Secciones del panel' })).not.toBeInTheDocument();
  expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/auth/me/permissions'))).toBe(false);

  await userEvent.type(screen.getByLabelText('Contraseña temporal'), 'Clave-Correcta-2026');
  await userEvent.type(screen.getByLabelText(/^Nueva contraseña/), 'Mi-Clave-Nueva-2026');
  await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), 'Mi-Clave-Nueva-2026');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }));
  expect(await screen.findByRole('navigation', { name: 'Secciones del panel' })).toBeInTheDocument();
  const call = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/auth/change-password'))!;
  expect(JSON.parse(String(call[1]!.body))).toEqual({
    current_password: 'Clave-Correcta-2026',
    new_password: 'Mi-Clave-Nueva-2026',
  });
});

test('admin/noticias: crear usuario con contraseña temporal (sin invitación por correo)', async () => {
  const fetchMock = fakeBackend({ permissions: ['users.view', 'users.create'] });
  vi.stubGlobal('fetch', fetchMock);
  renderApp('/admin/noticias/usuarios');
  await login();
  await userEvent.click(await screen.findByRole('button', { name: 'Crear usuario' }));
  const scope = within(screen.getByRole('dialog', { name: 'Crear usuario' }));
  await userEvent.type(scope.getByLabelText('Correo'), 'nueva@unisimon.edu.co');
  await userEvent.type(scope.getByLabelText('Nombre'), 'Nueva');
  await userEvent.type(scope.getByLabelText('Apellido'), 'Persona');
  await userEvent.click(scope.getByRole('button', { name: 'Generar' }));
  const password = (scope.getByLabelText(/^Contraseña temporal/) as HTMLInputElement).value;
  expect(password).toMatch(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);
  await userEvent.click(scope.getByRole('button', { name: 'Crear usuario' }));
  expect(await screen.findByText(`Usuario creado. Contraseña temporal: ${password}`)).toBeInTheDocument();
  const call = fetchMock.mock.calls.find(([u, i]) => String(u).endsWith('/users') && i?.method === 'POST')!;
  expect(JSON.parse(String(call[1]!.body))).toMatchObject({ email: 'nueva@unisimon.edu.co', password });
});

test('admin/noticias/estadisticas: indicadores con periodo de comparación, estimados marcados y rankings', async () => {
  const fetchMock = fakeBackend({ permissions: ['news.view', 'news.analytics'] });
  vi.stubGlobal('fetch', fetchMock);
  renderApp('/admin/noticias/estadisticas');
  await login();
  const nav = await screen.findByRole('navigation', { name: 'Secciones del panel' });
  expect(within(nav).getByRole('link', { name: 'Estadísticas' })).toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: 'Estadísticas de noticias' })).toBeInTheDocument();
  expect((await screen.findAllByText('1.234')).length).toBeGreaterThan(0); // visualizaciones (es-CO)
  expect(screen.getByText('Estimado')).toBeInTheDocument(); // visitantes únicos
  // Periodo que llega a hoy: bloque en vivo (se consulta cada 10 s).
  const live = await screen.findByRole('region', { name: 'En vivo' });
  expect(await within(live).findByText(/personas leyendo/)).toHaveTextContent('3 personas leyendo ahora');
  expect(within(live).getByRole('link', { name: 'Nueva convocatoria' })).toBeInTheDocument();
  expect(screen.getAllByText(/\+23,4 %/).length).toBeGreaterThan(0); // (1234 − 1000) / 1000
  expect(screen.getAllByText(/vs\. 14 sep 2026 – 13 oct 2026/).length).toBeGreaterThan(0); // base explícita
  expect(screen.getByText('Nadie usó las opciones de compartir en este periodo.')).toBeInTheDocument();
  const sortable = screen.getAllByRole('columnheader').filter((th) => th.hasAttribute('aria-sort'));
  expect(sortable.find((th) => th.textContent?.startsWith('Visualizaciones'))).toHaveAttribute(
    'aria-sort',
    'descending',
  );
  // Últimos 30 días por defecto: el rango viaja al backend, que es quien agrega.
  const call = fetchMock.mock.calls.find(([u]) => String(u).includes('/news/analytics/overview'))!;
  expect(String(call[0])).toMatch(/start_date=\d{4}-\d{2}-\d{2}&end_date=\d{4}-\d{2}-\d{2}/);

  // Resumen ejecutivo en lenguaje natural, con base explícita.
  expect(screen.getByRole('region', { name: 'Resumen ejecutivo' })).toHaveTextContent(
    'Las visualizaciones crecieron 23,4 % frente al periodo anterior (1.000 → 1.234).',
  );
  // Ranking por pestañas: «Mayor lectura» exige base mínima.
  await userEvent.click(screen.getByRole('tab', { name: 'Mayor lectura' }));
  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([u]) => /sort=avg_active.*min_views=5/.test(String(u)))).toBe(true),
  );
  // Filtros secundarios plegados.
  await userEvent.click(screen.getByRole('button', { name: /Filtros/ }));
  await userEvent.selectOptions(screen.getByLabelText('Dispositivo'), 'mobile');
  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('device=mobile'))).toBe(true),
  );
});

test('admin/noticias/estadisticas: sin news.analytics no hay menú ni datos', async () => {
  const fetchMock = fakeBackend({ permissions: ['news.view'] });
  vi.stubGlobal('fetch', fetchMock);
  renderApp('/admin/noticias/estadisticas');
  await login();
  expect(await screen.findByText(/no tiene el permiso para ver estadísticas/)).toBeInTheDocument();
  const nav = screen.getByRole('navigation', { name: 'Secciones del panel' });
  expect(within(nav).queryByRole('link', { name: 'Estadísticas' })).not.toBeInTheDocument();
  expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/analytics'))).toBe(false);
});

test('admin/noticias/7/estadisticas: vista de una noticia sin comparación inválida', async () => {
  vi.stubGlobal('fetch', fakeBackend({ permissions: ['news.view', 'news.analytics'] }));
  renderApp('/admin/noticias/7/estadisticas');
  await login();
  expect(await screen.findByRole('heading', { level: 1, name: 'Nueva convocatoria' })).toBeInTheDocument();
  expect(screen.getByText(/No hay suficientes noticias con visualizaciones/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Ver en el portal/ })).toHaveAttribute(
    'href',
    '/noticias/nueva-convocatoria',
  );
  expect(screen.getAllByText('Lectura acumulada').length).toBeGreaterThan(0);
});
