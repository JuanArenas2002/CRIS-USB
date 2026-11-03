import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ApiError } from '@/infrastructure/http/api-client';
import { cleanToken } from '@/presentation/components/admin/AdminToken';
import {
  fakeGroupRepo,
  fakeRepo,
  makeAuthor,
  makeGroupDetail,
  renderApp,
  fakeCenterRepo,
  makeCenterDetail,
  fakePublicationRepo,
  makePublication,
  fakeProjectRepo,
  makeProject,
  fakeRelationsRepo,
} from '@/test-utils';

test('directorio: tabla general con enlace rastreable al perfil y métricas reales', async () => {
  renderApp('/investigadores');
  const link = await screen.findByRole('link', { name: 'Ana María Pérez' });
  expect(link).toHaveAttribute('href', '/investigadores/7-ana-maria-perez');
  // "Investigadores Unisimón" es una tabla: una fila por investigador.
  expect(screen.getByRole('rowheader', { name: /Ana María Pérez/ })).toBeInTheDocument();
  expect(screen.getByText('1 Perfil Activo')).toBeInTheDocument();
  expect(screen.getByText('Investigador Sénior')).toBeInTheDocument(); // categoría Minciencias
  await waitFor(() => expect(document.title).toBe('Directorio de investigadores | Unisimón Research'));
  expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
});

test('directorio: la búsqueda va al backend (debounce) y una búsqueda filtrada es noindex', async () => {
  const list = vi.fn(fakeRepo().list);
  renderApp('/investigadores', fakeRepo({ list }));
  await userEvent.type(await screen.findByLabelText('Buscar investigadores'), 'ana');
  await waitFor(() =>
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ search: 'ana', page: 1 }), expect.anything()),
  );
  await waitFor(() =>
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow'),
  );
});

test('directorio: vacío ofrece restablecer filtros', async () => {
  renderApp(
    '/investigadores?q=zzz',
    fakeRepo({ list: async () => ({ items: [], total: 0, page: 1, pages: 0 }) }),
  );
  expect(await screen.findByText('No se encontraron investigadores')).toBeInTheDocument();
  // Uno en la barra de filtros y otro en el estado vacío.
  expect(screen.getAllByRole('button', { name: 'Restablecer filtros' })).toHaveLength(2);
});

test('directorio: error recuperable con reintento', async () => {
  let fail = true;
  const repo = fakeRepo({
    list: async () => {
      if (fail) throw new ApiError(0, 'No se pudo conectar con el servicio de datos.');
      return { items: [makeAuthor()], total: 1, page: 1, pages: 1 };
    },
  });
  renderApp('/investigadores', repo);
  expect(await screen.findByText('No se pudo conectar con el servicio de datos.')).toBeInTheDocument();
  fail = false;
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByRole('link', { name: 'Ana María Pérez' })).toBeInTheDocument();
});

test('directorio: el selector de apartado muestra cada Top con los puestos de su Excel', async () => {
  const rk = (rank: number) => ({ index: 90 - rank, rank, centerRank: null, center: null });
  const authors = [
    makeAuthor({ id: 1, name: 'Ana Primera', ranking: rk(5), tiers: { top12: rk(1), top60: rk(2) } }),
    makeAuthor({ id: 2, name: 'Bruno Treinta', ranking: rk(30), tiers: { top60: rk(1) } }),
    makeAuthor({ id: 3, name: 'Carla Sin Ranking', ranking: null }),
  ];
  renderApp('/investigadores', fakeRepo({}, authors));
  expect(await screen.findByRole('link', { name: 'Carla Sin Ranking' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Investigadores Unisimón' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Top 12' }));
  expect(await screen.findByRole('heading', { name: /Top 12 · Ranking/ })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Ana Primera' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Bruno Treinta' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Carla Sin Ranking' })).not.toBeInTheDocument();
  cleanup();
  renderApp('/investigadores?vista=top60', fakeRepo({}, authors));
  expect(await screen.findByRole('link', { name: 'Bruno Treinta' })).toBeInTheDocument();
  expect(screen.getByText('2 Perfiles Activos')).toBeInTheDocument();
});

test('perfil: canonicaliza el slug y muestra identificadores', async () => {
  renderApp('/investigadores/7-nombre-viejo');
  expect(await screen.findByRole('heading', { level: 1, name: 'Ana María Pérez' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /0000-0002-1825-0097/ })).toHaveAttribute(
    'href',
    'https://orcid.org/0000-0002-1825-0097',
  );
  expect(screen.getByRole('link', { name: /Bioinformática y Salud/ })).toHaveAttribute(
    'href',
    '/grupos/1-bioinformatica-y-salud',
  );
  expect(screen.getByRole('link', { name: /MACONDOLAB/ })).toHaveAttribute(
    'href',
    '/centros/1-centro-de-crecimiento-empresarial-macondolab',
  );
  expect(screen.getByText('Índice de productividad USB')).toBeInTheDocument();
  expect(screen.getByText('#1 en MACONDOLAB')).toBeInTheDocument();
  await waitFor(() =>
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toMatch(
      /\/investigadores\/7-ana-maria-perez$/,
    ),
  );
});

test('perfil: ODS heredados de sus grupos, con el grupo que los aporta', async () => {
  renderApp('/investigadores/7-ana-maria-perez');
  expect(
    await screen.findByRole('img', { name: 'ODS 3: Salud y bienestar (Vía Bioinformática y Salud)' }),
  ).toHaveAttribute('src', '/assets/ods/ods-3.webp');
  expect(screen.getByRole('img', { name: /^ODS 4: Educación de calidad/ })).toBeInTheDocument();
});

test('perfil: investigador inexistente o retirado no es público (404 noindex)', async () => {
  renderApp('/investigadores/9-x');
  expect(await screen.findByText('No encontramos esta página')).toBeInTheDocument();
  await waitFor(() =>
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow'),
  );
});

test('menú: las 6 secciones en orden, todas con contenido, y el enlace a Iraka', async () => {
  renderApp('/relacionamiento');
  const nav = screen.getByRole('navigation', { name: 'Principal' });
  expect(
    within(nav)
      .getAllByRole('link')
      .map((a) => a.textContent),
  ).toEqual([
    'Centros',
    'Grupos',
    'Investigadores',
    'Proyectos',
    'Productos',
    'Relacionamiento',
    expect.stringMatching(/^Iraka/),
  ]);
  expect(within(nav).getAllByRole('link').at(-1)).toHaveAccessibleName(
    'Iraka · Periodismo científico (abre en una pestaña nueva)',
  );
  expect(within(nav).getByRole('link', { name: 'Relacionamiento' })).toHaveAttribute('aria-current', 'page');
});

test('relacionamiento: mapa por país y año; al elegir un país se ven sus publicaciones', async () => {
  const user = userEvent.setup();
  const base = fakeRelationsRepo();
  const countries = vi.fn(base.countries);
  renderApp('/relacionamiento', undefined, undefined, undefined, undefined, undefined, {
    ...base,
    countries,
  });
  expect(
    screen.getByRole('heading', { level: 1, name: 'Relacionamiento internacional' }),
  ).toBeInTheDocument();
  expect(await screen.findByRole('img', { name: /Mapa mundial/ })).toBeInTheDocument();
  expect(screen.getByText('*Datos Scopus')).toBeInTheDocument();
  // Lista con el nombre del país traducido desde su ISO ("Spain" de Scopus → "España").
  const spain = await screen.findByRole('button', { name: /España/ });
  expect(screen.getByRole('button', { name: /Colombia/ })).toBeInTheDocument();

  await user.click(spain);
  expect(spain).toHaveAttribute('aria-pressed', 'true');
  const panel = within(await screen.findByRole('region', { name: 'España' }));
  // Misma tabla de productos del portal: título, revista/DOI y enlace.
  expect(
    await panel.findByText('Sporting Mind: The Interplay of Physical Activity and Psychological Health'),
  ).toBeInTheDocument();
  // Las citas van en su propia columna; bajo el tipo, solo los aliados.
  expect(panel.getByText('con Universidad Europea de Madrid')).toBeInTheDocument();
  expect(panel.getByRole('columnheader', { name: 'Citas' })).toBeInTheDocument();
  expect(panel.getByText('307')).toBeInTheDocument();
  expect(panel.getByRole('link', { name: /DOI/ })).toHaveAttribute(
    'href',
    'https://doi.org/10.3390/sports12010037',
  );

  // El mapa se acerca al país; «Ver mundo» vuelve a la vista completa y cierra el panel.
  await user.click(screen.getByRole('button', { name: 'Ver mundo' }));
  expect(screen.queryByRole('region', { name: 'España' })).not.toBeInTheDocument();
  expect(spain).toHaveAttribute('aria-pressed', 'false');

  // Filtro por año: pide a la API solo ese año.
  await user.click(screen.getByRole('combobox', { name: 'Año' }));
  await user.click(screen.getByRole('option', { name: '2024' }));
  await waitFor(() => expect(countries).toHaveBeenLastCalledWith(2024, expect.anything()));
});

test('directorio: filtro por categoría Minciencias va a la consulta', async () => {
  const list = vi.fn(fakeRepo().list);
  renderApp('/investigadores', fakeRepo({ list }));
  await userEvent.click(await screen.findByLabelText('Categoría Minciencias'));
  await userEvent.click(screen.getByRole('option', { name: /Junior/ }));
  await waitFor(() =>
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'junior', page: 1 }),
      expect.anything(),
    ),
  );
  expect(await screen.findByText('No se encontraron investigadores')).toBeInTheDocument();
});

test('grupos: solo activos, mejor categoría primero, filtro por categoría y búsqueda sin tildes', async () => {
  const groups = [
    makeGroupDetail({ id: 1, name: 'Zoología', category: 'B' }),
    makeGroupDetail({ id: 2, name: 'Óptica', category: 'A1' }),
    makeGroupDetail({ id: 3, name: 'Inactivo', category: 'A1', active: false }),
  ];
  renderApp('/grupos', fakeRepo(), fakeGroupRepo(groups));
  const titles = async () => (await screen.findAllByRole('heading', { level: 3 })).map((h) => h.textContent);
  expect(await titles()).toEqual(['Óptica', 'Zoología']);
  expect(screen.getAllByText('Ana María Pérez')).toHaveLength(2);

  await userEvent.click(screen.getByRole('combobox', { name: 'Categoría Minciencias' }));
  await userEvent.click(screen.getByRole('option', { name: 'Categoría B' }));
  expect(await titles()).toEqual(['Zoología']);
  await userEvent.click(screen.getByRole('button', { name: 'Restablecer filtros' }));
  expect(await titles()).toEqual(['Óptica', 'Zoología']);
  await userEvent.type(screen.getByLabelText('Buscar grupos'), 'optica');
  expect(await titles()).toEqual(['Óptica']);
});

test('grupo: detalle con líneas e historial; slug canónico; inactivo es 404', async () => {
  renderApp('/grupos/1-nombre-viejo');
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Bioinformática y Salud' }),
  ).toBeInTheDocument();
  // Plantilla de grupo: "Perfil e indicadores" activa, "Integrantes" en el HTML pero oculta.
  expect(screen.getByRole('tab', { name: /Perfil e indicadores/ })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('Genómica del Caribe')).toBeInTheDocument(); // línea (desplegable)
  expect(screen.getByText('Estudiar la diversidad genética regional.')).toBeInTheDocument();
  // Cada punto del histórico es accesible con su descripción.
  expect(screen.getByRole('img', { name: 'Convocatoria 833 de 2018: categoría A1' })).toBeInTheDocument();
  // ODS asignados en el portal, con el icono oficial y su nombre accesible.
  expect(screen.getByRole('img', { name: 'ODS 3: Salud y bienestar' })).toHaveAttribute(
    'src',
    '/assets/ods/ods-3.webp',
  );
  expect(screen.getByRole('img', { name: 'ODS 4: Educación de calidad' })).toBeInTheDocument();

  await userEvent.click(screen.getByRole('tab', { name: /Integrantes/ }));
  const panel = screen.getByRole('tabpanel', { name: /Integrantes/ });
  expect(panel).toBeVisible();
  expect(within(panel).getByRole('link', { name: /Ver perfil del investigador/ })).toHaveAttribute(
    'href',
    '/investigadores/7-ana-maria-perez',
  );
  await waitFor(() =>
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toMatch(
      /\/grupos\/1-bioinformatica-y-salud$/,
    ),
  );
});

test('grupo sin ODS lo indica', async () => {
  renderApp('/grupos/1-x', fakeRepo(), fakeGroupRepo([makeGroupDetail({ ods: [] })]));
  expect(await screen.findByText(/aún no tiene Objetivos de Desarrollo Sostenible/)).toBeInTheDocument();
});

test('grupo inactivo no se publica', async () => {
  renderApp('/grupos/1-x', fakeRepo(), fakeGroupRepo([makeGroupDetail({ active: false })]));
  expect(await screen.findByText('No encontramos esta página')).toBeInTheDocument();
});

test('grupos: lista por defecto y cambio a tarjetas', async () => {
  renderApp('/grupos');
  expect(await screen.findByRole('button', { name: /Lista/ })).toHaveAttribute('aria-pressed', 'true');
  expect(document.querySelectorAll('article')).toHaveLength(0);
  await userEvent.click(screen.getByRole('button', { name: /Tarjetas/ }));
  expect(screen.getByRole('button', { name: /Tarjetas/ })).toHaveAttribute('aria-pressed', 'true');
  expect(document.querySelectorAll('article')).toHaveLength(1);
  // Tipo de grupo de Metri-K como icono, con el texto para lectores de pantalla (y tooltip).
  expect(within(document.querySelector('article')!).getAllByText('Institucional').length).toBeGreaterThan(0);
});

test('perfil destacado: indicadores y "Explorar productos" abre la producción filtrada', async () => {
  const author = makeAuthor({
    metrics: { hIndex: 12, scopusPublications: 1, products: 2 },
    production: {
      publications: [
        {
          id: 1,
          title: 'Artículo Uno',
          year: 2024,
          journal: 'Revista',
          type: 'Article',
          citedBy: 5,
          doi: null,
          url: null,
          authors: null,
        },
      ],
      theses: [
        { id: 2, title: 'Tesis Uno', year: 2023, level: 'Doctorado', program: 'P', url: null, authors: null },
      ],
      developments: [],
    },
  });
  renderApp('/investigadores/7-ana-maria-perez', fakeRepo({}, [author]));
  expect(await screen.findByText('Índice h — Scopus')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /Producción científica/ })).toHaveTextContent('2 productos');
  await userEvent.click(
    screen.getByRole('button', { name: 'Explorar productos de Generación de nuevo conocimiento (1)' }),
  );
  expect(screen.getByRole('tab', { name: /Producción científica/ })).toHaveAttribute('aria-selected', 'true');
  const table = screen.getByRole('table');
  expect(within(table).getAllByRole('row')).toHaveLength(2); // encabezado + 1 producto filtrado
});

test('admin fotos: el token pegado se limpia (línea del .env, comillas, espacios)', () => {
  expect(cleanToken('  abc123  ')).toBe('abc123');
  expect(cleanToken('CRIS_ADMIN_TOKEN=abc123')).toBe('abc123');
  expect(cleanToken('CRIS_ADMIN_TOKEN = "abc123"')).toBe('abc123');
  expect(cleanToken("'abc123'")).toBe('abc123');
});

test('centros: solo activos, lista por defecto (estándar de grupos), estado como icono y cambio a tarjetas', async () => {
  renderApp(
    '/centros',
    fakeRepo(),
    fakeGroupRepo(),
    fakeCenterRepo([
      makeCenterDetail(),
      makeCenterDetail({ id: 8, code: 'CI-7', acronym: 'CICMAR', name: 'Centro Marino', active: false }),
    ]),
  );
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Centros de investigación' }),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole('link', { name: 'Centro de Crecimiento Empresarial MACONDOLAB' }),
  ).toHaveAttribute('href', '/centros/1-centro-de-crecimiento-empresarial-macondolab');
  // El inactivo no se publica, ni hay filtro de estado.
  expect(screen.queryByRole('link', { name: 'Centro Marino' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Estado')).not.toBeInTheDocument();
  // Estado: icono con el texto solo para lectores de pantalla (y tooltip).
  expect(screen.getAllByText('Activo').length).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: /Lista/ })).toHaveAttribute('aria-pressed', 'true');
  expect(document.querySelectorAll('article')).toHaveLength(0);

  await userEvent.click(screen.getByRole('button', { name: /Tarjetas/ }));
  expect(document.querySelectorAll('article')).toHaveLength(1);
});

test('centro inactivo no se publica', async () => {
  renderApp(
    '/centros/8-x',
    fakeRepo(),
    fakeGroupRepo(),
    fakeCenterRepo([makeCenterDetail({ id: 8, active: false })]),
  );
  expect(await screen.findByText('No encontramos esta página')).toBeInTheDocument();
});

test('centro: ficha con dirección, líneas, ODS oficiales y resolución en PDF', async () => {
  renderApp('/centros/1-nombre-viejo', fakeRepo(), fakeGroupRepo(), fakeCenterRepo());
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Centro de Crecimiento Empresarial MACONDOLAB' }),
  ).toBeInTheDocument();
  expect(screen.getAllByText(/Gloria Maria Naranjo Africano/).length).toBeGreaterThan(0);
  expect(screen.getByText('Emprendimiento Tecnológico')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: /^ODS 17/ })).toHaveAttribute('src', '/assets/ods/ods-17.webp');
  expect(screen.getByRole('link', { name: /Ver resolución \(PDF\)/ })).toHaveAttribute(
    'href',
    '/api/centers/1/resolutions/5',
  );
  await waitFor(() =>
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toMatch(
      /\/centros\/1-centro-de-crecimiento-empresarial-macondolab$/,
    ),
  );
});

test('centro: lista solo sus grupos (cruce group.centerIds)', async () => {
  const groups = [
    makeGroupDetail({ id: 1, name: 'Bioinformática y Salud', centerIds: [1] }),
    makeGroupDetail({ id: 2, code: 'COL0000002', name: 'Otro centro', centerIds: [5] }),
    makeGroupDetail({ id: 3, code: 'COL0000003', name: 'Sin centro' }),
  ];
  renderApp('/centros/1-centro-de-crecimiento-empresarial-macondolab', fakeRepo(), fakeGroupRepo(groups));
  const section = (await screen.findByRole('heading', { name: 'Grupos de investigación' })).closest(
    'section',
  )!;
  expect(await within(section).findByText('Bioinformática y Salud')).toBeInTheDocument();
  expect(within(section).queryByText('Otro centro')).not.toBeInTheDocument();
  expect(within(section).queryByText('Sin centro')).not.toBeInTheDocument();
  expect(within(section).getByText(/^1 grupo de investigación adscrito/)).toBeInTheDocument();
});

test('grupos: la lista no lleva logos de centro; las tarjetas sí, enlazados a la ficha del centro', async () => {
  const groups = [makeGroupDetail({ id: 1, name: 'Bioinformática y Salud', centerIds: [1] })];
  renderApp('/grupos', fakeRepo(), fakeGroupRepo(groups));
  await screen.findByText('Bioinformática y Salud');
  expect(screen.queryByRole('list', { name: 'Centros de investigación' })).not.toBeInTheDocument();

  cleanup();
  renderApp('/grupos?vista=tarjetas', fakeRepo(), fakeGroupRepo(groups));
  const centers = await screen.findByRole('list', { name: 'Centros de investigación' });
  expect(within(centers).getByRole('link', { name: /MACONDOLAB/ })).toHaveAttribute(
    'href',
    '/centros/1-centro-de-crecimiento-empresarial-macondolab',
  );
});

test('admin fotos: lista a todos los seleccionados, no solo la primera página', async () => {
  sessionStorage.setItem('cris-admin-token', 't');
  // 130: más de una página del directorio (12) y más de una del BFF (100).
  const authors = Array.from({ length: 130 }, (_, i) =>
    makeAuthor({ id: i + 1, name: `Investigador ${i + 1}` }),
  );
  renderApp('/admin/fotos', fakeRepo({}, authors));
  expect(await screen.findByText('130 investigadores seleccionados en el ranking')).toBeInTheDocument();
  expect(screen.getByText('Investigador 1')).toBeInTheDocument();
  expect(screen.getByText('Investigador 130')).toBeInTheDocument();
});

test('admin fotos: buscador por nombre, sin importar tildes ni mayúsculas', async () => {
  sessionStorage.setItem('cris-admin-token', 't');
  const authors = [
    makeAuthor({ id: 1, name: 'JOSÉ PÉREZ LARA' }),
    makeAuthor({ id: 2, name: 'Ana María Gómez' }),
  ];
  renderApp('/admin/fotos', fakeRepo({}, authors));
  await userEvent.type(await screen.findByLabelText('Buscar investigador por nombre'), 'jose perez');
  expect(screen.getByText('José Pérez Lara')).toBeInTheDocument();
  expect(screen.queryByText('Ana María Gómez')).not.toBeInTheDocument();
  expect(screen.getByText('1 de 2 investigadores seleccionados en el ranking')).toBeInTheDocument();
  await userEvent.clear(screen.getByLabelText('Buscar investigador por nombre'));
  await userEvent.type(screen.getByLabelText('Buscar investigador por nombre'), 'zzz');
  expect(screen.getByText('Ningún investigador coincide con «zzz».')).toBeInTheDocument();
});

test('admin ranking: buscador por nombre sin tildes, con contador y aviso sin resultados', async () => {
  sessionStorage.setItem('cris-admin-token', 't');
  const row = (id: number, name: string, center: string) => ({
    id,
    name,
    index: 90 - id,
    rank: id,
    centerRank: 1,
    center,
    hidden: false,
    shown: { rank: id, centerRank: 1 },
  });
  const rows = [row(1, 'JOSÉ PÉREZ LARA', 'CICV'), row(2, 'ANA MARÍA GÓMEZ', 'CIISO')];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url === '/api/ranking' ? new Response(JSON.stringify({ rows })) : new Response('{}', { status: 404 }),
    ),
  );
  renderApp('/admin/ranking');
  const search = await screen.findByLabelText('Buscar investigador');
  await screen.findByText('José Pérez Lara');
  await userEvent.type(search, 'jose perez');
  expect(screen.getByText('José Pérez Lara')).toBeInTheDocument();
  expect(screen.queryByText('Ana María Gómez')).not.toBeInTheDocument();
  expect(screen.getByText('1 de 2 investigadores')).toBeInTheDocument();
  await userEvent.clear(search);
  await userEvent.type(search, 'zzz');
  expect(screen.getByText('Ningún investigador coincide con «zzz».')).toBeInTheDocument();
  vi.unstubAllGlobals();
});

test('admin ranking: respuesta ilegible → mensaje claro, sin mostrar el token', async () => {
  sessionStorage.setItem('cris-admin-token', 'TOKEN-SECRETO-123');
  // Como en Vercel con gzip doble: 200, pero el cuerpo no es JSON.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('\x1f\x8b basura comprimida', { status: 200 })),
  );
  renderApp('/admin/ranking');
  expect(
    await screen.findByText(/No se pudo cargar el ranking: El servidor respondió con un formato inesperado/),
  ).toBeInTheDocument();
  expect(document.body.textContent).not.toContain('TOKEN-SECRETO-123');
  vi.unstubAllGlobals();
});

test('productos: misma tabla que los productos del investigador (año, título, tipología, tipo, enlace)', async () => {
  renderApp('/productos');
  const row = within((await screen.findByText('Metabolic Reprogramming in Cancer Cells')).closest('tr')!);
  expect(row.getByText('2022')).toBeInTheDocument();
  expect(row.getByText('Nuevo Conocimiento')).toBeInTheDocument();
  expect(row.getByText('Artículo científico')).toBeInTheDocument();
  // Revista y DOI bajo el título; acceso abierto bajo el tipo; citas en su columna (el cuartil nunca se muestra).
  expect(row.getByText('Pharmaceutics · DOI: 10.3390/pharmaceutics14061303')).toBeInTheDocument();
  expect(row.getByText('Scopus · Acceso abierto')).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Citas' })).toBeInTheDocument();
  expect(row.getByText('133')).toBeInTheDocument();
  expect(screen.getByText('En revistas Q1')).toBeInTheDocument();
  // Del cuartil solo se muestra el total en Q1; nunca el de cada publicación.
  expect(screen.getByRole('table')).not.toHaveTextContent(/\bQ[1-4]\b/);
  expect(screen.queryByRole('combobox', { name: /cuartil/i })).not.toBeInTheDocument();
  expect(row.getByRole('link', { name: /DOI/ })).toHaveAttribute(
    'href',
    'https://doi.org/10.3390/pharmaceutics14061303',
  );
  expect(row.getAllByText('Puesto 1').length).toBeGreaterThan(0);
  expect(screen.getByText('1 publicación')).toBeInTheDocument();
});

test('productos: sin resultados para el filtro ofrece restablecerlo', async () => {
  const user = userEvent.setup();
  renderApp('/productos?tipo=Book');
  const empty = await screen.findByRole('status');
  expect(empty).toHaveTextContent('No se encontraron publicaciones');
  await user.click(within(empty).getByRole('button', { name: 'Restablecer filtros' }));
  expect(await screen.findByText('1 publicación')).toBeInTheDocument();
});

test('productos: con rango de años el puesto se recalcula y se muestra el general', async () => {
  renderApp(
    '/productos?desde=2020&hasta=2023',
    undefined,
    undefined,
    undefined,
    fakePublicationRepo([
      makePublication({ rank: 1, eid: '2-s2.0-1', title: 'Reciente', year: 2025 }),
      makePublication({ rank: 2, eid: '2-s2.0-2', title: 'En rango', year: 2022 }),
    ]),
  );
  expect(await screen.findByText('En rango')).toBeInTheDocument();
  expect(screen.queryByText('Reciente')).not.toBeInTheDocument();
  // Con filtro, el puesto se recalcula (1) y se muestra el general (#2).
  expect(screen.getAllByText('Puesto 1').length).toBeGreaterThan(0);
  expect(screen.getAllByText('#2 general').length).toBeGreaterThan(0);
  expect(screen.getByRole('combobox', { name: 'Año desde' })).toHaveTextContent('Desde 2020');
  expect(screen.getByRole('combobox', { name: 'Año hasta' })).toHaveTextContent('Hasta 2023');
});

test('proyectos: lista con título enlazado, área, año y estado como icono', async () => {
  renderApp('/proyectos?estado=En%20ejecuci%C3%B3n');
  const link = await screen.findByRole('link', { name: /Programa de fortalecimiento/ });
  expect(link).toHaveAttribute('href', expect.stringMatching(/^\/proyectos\/3-programa-de-fortalecimiento/));
  expect(screen.getByText('1 proyecto')).toBeInTheDocument();
  // El estado no va como texto visible: solo icono, con el texto para lectores de pantalla.
  expect(screen.getAllByText('En ejecución', { selector: '.sr-only' }).length).toBeGreaterThan(0);
});

test('ficha de proyecto: carrusel con las fotos asociadas y flechas', async () => {
  const gallery = [1, 2, 3, 4].map((slot) => ({ slot, url: `/api/projects/3/photos/${slot}?v=1` }));
  const repo = fakeProjectRepo([makeProject({ gallery })]);
  renderApp(
    '/proyectos/3-programa-de-fortalecimiento-a-organizaciones-de-cuidado-comunitario',
    undefined,
    undefined,
    undefined,
    undefined,
    repo,
  );
  const carousel = await screen.findByRole('group', { name: 'Registro fotográfico' });
  expect(within(carousel).getAllByRole('img')).toHaveLength(4);
  // Al inicio no se puede retroceder.
  expect(within(carousel).getByRole('button', { name: 'Foto anterior' })).toBeDisabled();
  expect(within(carousel).getByRole('button', { name: 'Foto siguiente' })).toBeInTheDocument();
});

test('ficha de proyecto: un equipo grande se pliega con «Ver más»', async () => {
  const user = userEvent.setup();
  const team = Array.from({ length: 8 }, (_, i) => ({
    name: `PERSONA NUMERO ${i + 1}`,
    role: 'Coinvestigador',
  }));
  const repo = fakeProjectRepo([makeProject({ team })]);
  renderApp(
    '/proyectos/3-programa-de-fortalecimiento-a-organizaciones-de-cuidado-comunitario',
    undefined,
    undefined,
    undefined,
    undefined,
    repo,
  );
  expect(await screen.findByText('Persona Numero 6')).toBeInTheDocument();
  expect(screen.queryByText('Persona Numero 7')).not.toBeInTheDocument();
  const toggle = screen.getByRole('button', { name: /Ver 2 integrantes más/ });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await user.click(toggle);
  expect(screen.getByText('Persona Numero 8')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Ver menos integrantes/ })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
});

test('centro: lista sus proyectos (cruce por nombre del centro, sin tildes ni mayúsculas)', async () => {
  const repo = fakeProjectRepo([
    makeProject({ id: 3, centers: ['CENTRO DE CRECIMIENTO EMPRESARIAL MACONDOLAB'] }),
    makeProject({ id: 4, title: 'Proyecto de otro centro', centers: ['Otro centro'] }),
  ]);
  renderApp('/centros/1-nombre-viejo', fakeRepo(), fakeGroupRepo(), fakeCenterRepo(), undefined, repo);
  const section = await screen.findByRole('region', { name: 'Proyectos de investigación' });
  expect(
    await within(section).findByRole('link', { name: /Programa de fortalecimiento/ }),
  ).toBeInTheDocument();
  expect(within(section).queryByText('Proyecto de otro centro')).not.toBeInTheDocument();
  expect(within(section).getByText('1 proyecto de investigación de este centro.')).toBeInTheDocument();
});

test('proyectos: la lista muestra el investigador principal y cuántos más hay en el equipo', async () => {
  const repo = fakeProjectRepo([
    makeProject({
      team: [
        { name: 'LUISA DÍAZ', role: 'Estudiante' },
        { name: 'ROBERTO FIGUEROA DEL VALLE', role: 'Investigador Principal' },
      ],
    }),
  ]);
  renderApp('/proyectos', undefined, undefined, undefined, undefined, repo);
  expect((await screen.findAllByText('Roberto Figueroa del Valle')).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Investigador Principal · \+1 más/).length).toBeGreaterThan(0);
});

test('grupo: la producción usa la misma tabla que los productos del investigador', async () => {
  const user = userEvent.setup();
  const author = makeAuthor({
    production: {
      publications: [
        {
          id: 1,
          title: 'Artículo del grupo',
          year: 2024,
          journal: 'Revista Uno',
          type: 'Article',
          citedBy: 5,
          doi: null,
          url: null,
          authors: null,
        },
      ],
      theses: [
        {
          id: 2,
          title: 'Tesis del grupo',
          year: 2023,
          level: 'Maestria',
          program: 'P',
          url: null,
          authors: null,
        },
      ],
      developments: [],
    },
  });
  renderApp('/grupos/1-bioinformatica-y-salud', fakeRepo({}, [author]));
  await user.click(await screen.findByRole('tab', { name: /Producción/ }));
  const row = within((await screen.findByText('Artículo del grupo')).closest('tr')!);
  expect(row.getByText('2024')).toBeInTheDocument();
  expect(row.getByText('Nuevo Conocimiento')).toBeInTheDocument();
  // Mismos filtros que en el perfil: tipología, tipo y año.
  expect(screen.getByRole('combobox', { name: 'Tipología' })).toBeInTheDocument();
  expect(screen.getByText('Tesis del grupo').closest('tr')).toBeInTheDocument();
});

test('grupo: con más de 6 líneas muestra 6 y el resto con «Ver más líneas»', async () => {
  const user = userEvent.setup();
  const lines = Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    code: null,
    name: `Línea número ${i + 1}`,
    objective: null,
    achievements: null,
    impact: null,
  }));
  renderApp('/grupos/1-bioinformatica-y-salud', fakeRepo(), fakeGroupRepo([makeGroupDetail({ lines })]));
  expect(await screen.findByText('Línea número 6')).toBeInTheDocument();
  expect(screen.queryByText('Línea número 7')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Ver 2 líneas más/ }));
  expect(screen.getByText('Línea número 8')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Ver menos líneas/ }));
  expect(screen.queryByText('Línea número 8')).not.toBeInTheDocument();
});

test('relacionamiento: un clic en el país del mapa lo selecciona (el arrastre no lo impide)', async () => {
  const user = userEvent.setup();
  renderApp('/relacionamiento');
  await screen.findByRole('img', { name: /Mapa mundial/ });
  const spainOnMap = await waitFor(() => {
    const el = document.querySelector('path[data-iso="ESP"]');
    if (!el) throw new Error('mapa aún sin países');
    return el;
  });
  await user.click(spainOnMap);
  expect(await screen.findByRole('region', { name: 'España' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /España/ })).toHaveAttribute('aria-pressed', 'true');
});

test('portada: las seis áreas enlazan a sus rutas y muestran cifras reales', async () => {
  renderApp('/');
  expect(
    await screen.findByRole('heading', { level: 1, name: /desafíos de nuestro territorio/ }),
  ).toBeInTheDocument();
  const area = (name: string) => within(screen.getByRole('main')).getByRole('link', { name });
  expect(area('Centros')).toHaveAttribute('href', '/centros');
  expect(area('Grupos')).toHaveAttribute('href', '/grupos');
  expect(area('Investigadores')).toHaveAttribute('href', '/investigadores');
  expect(area('Proyectos')).toHaveAttribute('href', '/proyectos');
  expect(area('Productos')).toHaveAttribute('href', '/productos');
  expect(area('Relacionamiento')).toHaveAttribute('href', '/relacionamiento');
  // Iraka: botón principal del hero, menú principal y pie (en todas las páginas).
  expect(
    within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('link', {
      name: 'Iraka · Periodismo científico (abre en una pestaña nueva)',
    }),
  ).toHaveAttribute('href', 'https://iraka.unisimon.edu.co/');
  expect(
    within(screen.getByRole('contentinfo')).getByRole('link', { name: /Iraka · Periodismo científico/ }),
  ).toHaveAttribute('href', 'https://iraka.unisimon.edu.co/');
  expect(
    within(screen.getByRole('main')).getByRole('link', { name: /Iraka · Periodismo científico/ }),
  ).toHaveAttribute('href', 'https://iraka.unisimon.edu.co/');
  // Orden pedido: proyectos, grupos, publicaciones y países.
  expect(
    within(screen.getByRole('region', { name: 'La investigación en cifras' }))
      .getAllByRole('term')
      .map((d) => d.firstChild?.textContent),
  ).toEqual([
    'Proyectos publicados',
    'Grupos de investigación',
    'Publicaciones científicas',
    'Países con coautoría',
  ]);
  // Colombia es el país local: no cuenta como aliado; España, sí.
  expect(await screen.findByText('1 país aliado · Mayor coautoría: España')).toBeInTheDocument();
  expect(screen.getByText('Mayor coautoría: España')).toBeInTheDocument(); // nota de la métrica
  expect(screen.getByText('1 perfil · 1 Sénior y Eméritos')).toBeInTheDocument();
  // El hero muestra proyectos reales en ejecución y nada de noticias de ejemplo.
  expect(screen.queryByText(/noticia/i)).not.toBeInTheDocument();
  await waitFor(() =>
    expect(document.title).toBe('Investigación en la Universidad Simón Bolívar | Unisimón Research'),
  );
  expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
});

test('portada: un área que falla no tumba las demás y se puede reintentar', async () => {
  let fail = true;
  const relations = {
    ...fakeRelationsRepo(),
    countries: async (year: number | null) => {
      if (fail) throw new ApiError(503, 'Servicio no disponible');
      return fakeRelationsRepo().countries(year);
    },
  };
  renderApp('/', undefined, undefined, undefined, undefined, undefined, relations);
  const retry = await screen.findByRole('button', { name: 'Reintentar: Países con coautoría' });
  expect(await screen.findByText(/1 perfil/)).toBeInTheDocument();
  expect(within(screen.getByRole('main')).getByRole('link', { name: 'Relacionamiento' })).toBeInTheDocument();
  fail = false;
  await userEvent.click(retry);
  expect(await screen.findByText(/1 país aliado/)).toBeInTheDocument();
});

test('portada: sin datos no muestra 0 y oculta los destacados vacíos', async () => {
  renderApp('/', fakeRepo({}, []), undefined, undefined, undefined, fakeProjectRepo([]));
  expect(await screen.findByText('Sin datos publicados')).toBeInTheDocument(); // proyectos
  expect(screen.queryByText(/Top 12/)).not.toBeInTheDocument();
  expect(screen.queryByRole('complementary', { name: 'Proyecto en ejecución' })).not.toBeInTheDocument();
});

test('portada: los enlaces antiguos del directorio redirigen con sus filtros', async () => {
  renderApp('/?vista=top12');
  expect(await screen.findByRole('heading', { name: 'Quiénes investigan en Unisimón' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Top 12', pressed: true })).toBeInTheDocument();
});
