import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderApp } from '@/test-utils';

const item = (id: number, over: object = {}) => ({
  id,
  title: `Noticia ${id}`,
  slug: `noticia-${id}`,
  summary: `Resumen ${id}`,
  content: '<p>Cuerpo <strong>seguro</strong></p>',
  image_url: `/media/news/${id}-0123456789abcdef.webp`,
  image_caption: `Foto ${id}`,
  category_id: 1,
  author_id: 1,
  relevance_level: 'high',
  priority: 0,
  is_featured: true,
  is_pinned: false,
  start_at: null,
  end_at: null,
  published_at: '2026-11-10T12:00:00Z',
  created_at: '2026-11-10T12:00:00Z',
  updated_at: '2026-11-10T12:00:00Z',
  status: 'published',
  tags: ['ciencia'],
  scopes: [],
  people: [],
  ...over,
});

const CATALOGS = {
  statuses: [],
  relevance_levels: [],
  scope_types: [],
  person_types: [],
  relationship_types: [{ id: 1, code: 'protagonist', name: 'Protagonista' }],
  categories: [{ id: 1, name: 'Investigación' }],
};
const PROFILE = {
  orcid: '0000-0002-1825-0097',
  uri: 'https://orcid.org/0000-0002-1825-0097',
  givenName: 'Josiah',
  middleName: null,
  familyName: 'Carberry',
  publishedName: null,
  displayName: 'Josiah Carberry',
  biography: null,
  country: null,
  createdAt: null,
  lastModifiedAt: null,
  educations: [],
  employments: [
    {
      kind: 'employment',
      organization: 'Wesleyan University',
      department: null,
      role: 'Professor',
      startDate: null,
      endDate: null,
      current: true,
      city: null,
      region: null,
      country: null,
      orgId: null,
      ror: null,
      url: null,
      source: null,
      visibility: 'public',
      putCode: 1,
    },
  ],
};

function stubNews(list: unknown[]) {
  const fetchMock = vi.fn((url: string) => {
    const path = String(url).replace(/^.*\/news-api/, '');
    const body = path.startsWith('/news?')
      ? list
      : path === '/news/noticia-1'
        ? list[0]
        : path === '/news/catalogs'
          ? CATALOGS
          : path === '/api/orcid/0000-0002-1825-0097'
            ? PROFILE
            : null;
    return Promise.resolve(
      new Response(JSON.stringify(body ?? { detail: 'No encontrado' }), {
        status: body ? 200 : 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

test('portada: sin tarjeta de noticias en el hero y con el botón a Unisimon Global', async () => {
  stubNews([item(1), item(2)]);
  renderApp('/');
  const global = (await screen.findAllByRole('link', { name: /Unisimon Global/ }))[0]!;
  expect(global).toHaveAttribute('href', 'https://unisimon.edu.co/global/unisimon-global-home.html');
  expect(screen.queryByRole('complementary', { name: 'Noticias' })).not.toBeInTheDocument();
});

test('/noticias/:slug muestra la noticia con su imagen y contenido; inexistente => aviso', async () => {
  stubNews([item(1)]);
  renderApp('/noticias/noticia-1');
  expect(await screen.findByRole('heading', { level: 1, name: 'Noticia 1' })).toBeInTheDocument();
  const crumbs = within(screen.getByRole('navigation', { name: 'breadcrumb' }));
  expect(crumbs.getByRole('link', { name: /Unisimón/ })).toHaveAttribute('href', '/'); // distintivo del portal
  expect(crumbs.getByRole('link', { name: 'Noticias' })).toHaveAttribute('href', '/noticias');
  expect(screen.getByRole('article')).toHaveTextContent('Universidad Simón Bolívar');
  // Imagen responsive: WebP del ancho adecuado (el backend sirve ?w=), nunca el original de varios MB.
  const photo = screen.getByRole('img', { name: 'Foto 1' });
  expect(photo).toHaveAttribute('src', '/news-api/media/news/1-0123456789abcdef.webp?w=1280');
  expect(photo.getAttribute('srcset')).toContain('/news-api/media/news/1-0123456789abcdef.webp?w=640 640w');
  expect(photo).toHaveAttribute('fetchpriority', 'high');
  const share = screen.getByRole('button', { name: /Compartir noticia/ });
  expect(share).toHaveAttribute('aria-expanded', 'false');
  await userEvent.click(share);
  expect(share).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('complementary')).toHaveTextContent('WhatsApp');
  expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('target', '_blank');
  expect(screen.getByRole('link', { name: 'Facebook' })).toHaveAttribute('target', '_blank');
  for (const label of ['WhatsApp', 'Facebook', 'Correo electrónico'])
    expect(screen.getByRole('link', { name: label })).toHaveClass('w-full');
  expect(screen.getByRole('button', { name: 'Copiar vínculo' })).toHaveClass('w-full');
  expect(
    screen.getByRole('link', { name: 'WhatsApp' }).querySelector('[data-brand="whatsapp"]'),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Facebook' }).querySelector('[data-brand="facebook"]'),
  ).toBeInTheDocument();

  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Copiar vínculo' }));
  expect(writeText).toHaveBeenCalledWith(window.location.href);
  expect(await screen.findByRole('status')).toHaveTextContent('Vínculo copiado');
  expect(screen.getByText('seguro').tagName).toBe('STRONG');
  expect(screen.getByText('#ciencia')).toBeInTheDocument();
});

test('/noticias/:slug inexistente muestra que no se encontró', async () => {
  stubNews([item(1)]);
  renderApp('/noticias/no-existe');
  expect(await screen.findByRole('heading', { name: 'Noticia no encontrada' })).toBeInTheDocument();
});

test('/noticias/:slug: imágenes del contenido por el proxy, tiempo de lectura y más noticias', async () => {
  stubNews([
    item(1, { content: '<p>Texto</p><img src="/media/news/1-aaaaaaaaaaaaaaaa.png" alt="Laboratorio">' }),
    item(2),
    item(3),
  ]);
  renderApp('/noticias/noticia-1');
  const inline = await screen.findByRole('img', { name: 'Laboratorio' });
  expect(inline).toHaveAttribute('src', '/news-api/media/news/1-aaaaaaaaaaaaaaaa.png?w=1280');
  expect(inline).toHaveAttribute('loading', 'lazy'); // dentro del texto: se carga al acercarse
  expect(inline.getAttribute('srcset')).toContain('?w=320 320w');
  expect(screen.getByText('1 min de lectura')).toBeInTheDocument();
  const more = await screen.findByRole('region', { name: 'Más noticias' });
  expect(more).toHaveTextContent('Noticia 2');
  expect(more).not.toHaveTextContent('Noticia 1'); // no repite la actual
});

test('/noticias/:slug: personas por ORCID con nombre, papel, cargo y enlace al perfil; y la categoría', async () => {
  stubNews([
    item(1, {
      people: [{ person_type: 'researcher', orcid: '0000-0002-1825-0097', relationship_type: 'protagonist' }],
    }),
  ]);
  renderApp('/noticias/noticia-1');
  const people = await screen.findByRole('region', { name: 'Personas en esta noticia' });
  expect(await within(people).findByText('Josiah Carberry')).toBeInTheDocument();
  expect(within(people).getByText('Protagonista')).toBeInTheDocument();
  expect(within(people).getByText('Professor · Wesleyan University')).toBeInTheDocument();
  expect(within(people).getByRole('link', { name: /Ver perfil en ORCID/ })).toHaveAttribute(
    'href',
    'https://orcid.org/0000-0002-1825-0097',
  );
  // Categoría en las migas y como antetítulo, ambas llevan a su sección.
  const section = await screen.findAllByRole('link', { name: 'Investigación' });
  expect(section).toHaveLength(2);
  for (const link of section) expect(link).toHaveAttribute('href', '/noticias?seccion=1');
});

test('/noticias: portada tipo portal (principal, lo último, destacadas, secciones y cargar más)', async () => {
  const many = Array.from({ length: 9 }, (_, i) =>
    item(i + 1, { published_at: `2026-11-${String(10 - (i % 9)).padStart(2, '0')}T12:00:00Z` }),
  );
  const fetchMock = stubNews(many);
  renderApp('/noticias');
  expect(await screen.findByRole('heading', { level: 1, name: 'Noticias científicas' })).toBeInTheDocument();
  const nav = await screen.findByRole('navigation', { name: 'Secciones de noticias' });
  expect(await within(nav).findByRole('link', { name: 'Investigación' })).toHaveAttribute(
    'href',
    '/noticias?seccion=1',
  );
  expect(within(nav).getByRole('link', { name: 'Todas' })).toHaveAttribute('aria-current', 'page');

  // Principal grande + "Lo último" (sin repetir la principal) + destacadas + más noticias.
  const lead = within(await screen.findByRole('article')).getByRole('link');
  expect(lead).toHaveAttribute('href', '/noticias/noticia-1');
  expect(lead).toHaveTextContent('Resumen 1');
  const latest = screen.getByRole('region', { name: 'Lo último' });
  expect(within(latest).queryByText('Noticia 1')).not.toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Destacadas' })).getAllByRole('listitem')).toHaveLength(4);
  expect(within(screen.getByRole('region', { name: 'Más noticias' })).getAllByRole('listitem')).toHaveLength(
    4,
  );

  // Página llena => "cargar más" pide la siguiente con offset.
  await userEvent.click(screen.getByRole('button', { name: 'Ver más noticias' }));
  await vi.waitFor(() =>
    expect(
      fetchMock.mock.calls.some(([u]) => String(u).includes('offset=9') && String(u).includes('limit=4')),
    ).toBe(true),
  );
});

test('/noticias?seccion=1: filtra por sección y la marca como actual', async () => {
  const fetchMock = stubNews([item(1)]);
  renderApp('/noticias?seccion=1');
  expect(await screen.findByRole('heading', { level: 1, name: 'Investigación' })).toBeInTheDocument();
  expect(
    within(await screen.findByRole('navigation', { name: 'Secciones de noticias' })).getByRole('link', {
      name: 'Investigación',
    }),
  ).toHaveAttribute('aria-current', 'page');
  expect(
    fetchMock.mock.calls.some(
      ([u]) => String(u).includes('category_id=1') && String(u).includes('public=true'),
    ),
  ).toBe(true);
  expect(screen.queryByRole('button', { name: 'Ver más noticias' })).not.toBeInTheDocument();
});
