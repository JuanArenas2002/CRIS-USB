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
} from '@/test-utils';

test('directorio: tarjetas con enlace rastreable al perfil y métricas reales', async () => {
  renderApp('/');
  const link = await screen.findByRole('link', { name: 'Ana María Pérez' });
  expect(link).toHaveAttribute('href', '/investigadores/7-ana-maria-perez');
  // Cada identificador de la tarjeta enlaza a su perfil externo.
  expect(screen.getByRole('link', { name: /^ORCID, perfil de Ana María Pérez/ })).toHaveAttribute(
    'href',
    'https://orcid.org/0000-0002-1825-0097',
  );
  expect(screen.getByText('1 Perfil Activo')).toBeInTheDocument();
  expect(screen.getByText('Investigador Sénior')).toBeInTheDocument(); // categoría Minciencias
  await waitFor(() => expect(document.title).toBe('Directorio de investigadores | Unisimón Research'));
  expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
});

test('directorio: la búsqueda va al backend (debounce) y una búsqueda filtrada es noindex', async () => {
  const list = vi.fn(fakeRepo().list);
  renderApp('/', fakeRepo({ list }));
  await userEvent.type(await screen.findByLabelText('Buscar investigadores'), 'ana');
  await waitFor(() =>
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ search: 'ana', page: 1 }), expect.anything()),
  );
  await waitFor(() =>
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow'),
  );
});

test('directorio: vacío ofrece restablecer filtros', async () => {
  renderApp('/?q=zzz', fakeRepo({ list: async () => ({ items: [], total: 0, page: 1, pages: 0 }) }));
  expect(await screen.findByText('No se encontraron investigadores')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Restablecer filtros' })).toBeInTheDocument();
});

test('directorio: error recuperable con reintento', async () => {
  let fail = true;
  const repo = fakeRepo({
    list: async () => {
      if (fail) throw new ApiError(0, 'No se pudo conectar con el servicio de datos.');
      return { items: [makeAuthor()], total: 1, page: 1, pages: 1 };
    },
  });
  renderApp('/', repo);
  expect(await screen.findByText('No se pudo conectar con el servicio de datos.')).toBeInTheDocument();
  fail = false;
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByRole('link', { name: 'Ana María Pérez' })).toBeInTheDocument();
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

test('menú: las 6 secciones en orden; las pendientes llevan a "en construcción" (noindex)', async () => {
  renderApp('/proyectos');
  const nav = screen.getByRole('navigation', { name: 'Principal' });
  expect(
    within(nav)
      .getAllByRole('link')
      .map((a) => a.textContent),
  ).toEqual(['Centros', 'Grupos', 'Investigadores', 'Proyectos', 'Productos', 'Relacionamiento']);
  expect(within(nav).getByRole('link', { name: 'Proyectos' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('heading', { level: 1, name: 'Proyectos' })).toBeInTheDocument();
  await waitFor(() =>
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow'),
  );
});

test('directorio: filtro por categoría Minciencias va a la consulta', async () => {
  const list = vi.fn(fakeRepo().list);
  renderApp('/', fakeRepo({ list }));
  await userEvent.selectOptions(await screen.findByLabelText('Categoría Minciencias'), 'junior');
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

  await userEvent.selectOptions(screen.getByLabelText('Categoría Minciencias'), 'B');
  expect(await titles()).toEqual(['Zoología']);
  await userEvent.selectOptions(screen.getByLabelText('Categoría Minciencias'), '');
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

test('grupos: cada grupo muestra logo y sigla de su centro, enlazados a la ficha del centro', async () => {
  const groups = [makeGroupDetail({ id: 1, name: 'Bioinformática y Salud', centerIds: [1] })];
  renderApp('/grupos', fakeRepo(), fakeGroupRepo(groups));
  const centers = await screen.findByRole('list', { name: 'Centros de investigación' });
  expect(within(centers).getByRole('link', { name: /MACONDOLAB/ })).toHaveAttribute(
    'href',
    '/centros/1-centro-de-crecimiento-empresarial-macondolab',
  );

  // En la ficha de ese mismo centro, la fila del grupo no repite su logo.
  cleanup();
  renderApp('/centros/1-centro-de-crecimiento-empresarial-macondolab', fakeRepo(), fakeGroupRepo(groups));
  const section = (await screen.findByRole('heading', { name: 'Grupos de investigación' })).closest(
    'section',
  )!;
  await within(section).findByText('Bioinformática y Salud');
  expect(within(section).queryByRole('list', { name: 'Centros de investigación' })).not.toBeInTheDocument();
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
