import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  fakeRepo,
  fakeGroupRepo,
  fakeCenterRepo,
  fakePublicationRepo,
  makePublication,
  renderApp,
} from '@/test-utils';
import { collectionJsonLd, publicationToProduct, selectableYears, yearRange } from './products-model';

test('productos: el gráfico por año se pide con el botón, sigue el rango de años y se oculta', async () => {
  const user = userEvent.setup();
  renderApp('/productos?desde=2026&hasta=2026');
  const button = await screen.findByRole('button', { name: 'Ver evolución anual' });
  expect(button).toHaveAttribute('aria-expanded', 'false');
  expect(document.getElementById('pubs-chart')).toBeNull();

  await user.click(button);
  expect(screen.getByRole('button', { name: 'Ocultar gráfico' })).toHaveAttribute('aria-expanded', 'true');
  const panel = document.getElementById('pubs-chart')!;
  expect(panel).not.toBeNull();
  // Los datos simulados (2025 y 2026) caen dentro del rango pedido: no es el aviso de «sin resultados».
  await within(panel).findByText(/Publicaciones indexadas en Scopus/);

  await user.click(screen.getByRole('button', { name: 'Ocultar gráfico' }));
  expect(document.getElementById('pubs-chart')).toBeNull();
});

test('productos: sin publicaciones cargadas no se ofrece el gráfico', async () => {
  renderApp('/productos', fakeRepo(), fakeGroupRepo(), fakeCenterRepo(), fakePublicationRepo([]));
  expect(await screen.findByText('Aún no hay publicaciones')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Ver evolución anual' })).not.toBeInTheDocument();
});

test('modelo: rango de años (invertido o abierto) y años elegibles con los del enlace', () => {
  expect(yearRange({ yearFrom: 2020, yearTo: 2023 })).toEqual([2020, 2023]);
  expect(yearRange({ yearFrom: 2023, yearTo: 2020 })).toEqual([2020, 2023]); // invertido: se toma al derecho
  expect(yearRange({})).toEqual([0, Infinity]);
  expect(yearRange({ yearFrom: 2021 })).toEqual([2021, Infinity]);
  expect(selectableYears([2024, 2022], {})).toEqual([2024, 2022]);
  // El año de un enlace sin publicaciones también se puede elegir, sin repetidos y recientes primero.
  expect(selectableYears([2024, 2022], { yearFrom: 2019, yearTo: 2022 })).toEqual([2024, 2022, 2019]);
  expect(selectableYears(undefined, {})).toEqual([]);
});

test('modelo: publicación → producto (acceso abierto en el detalle) y JSON-LD solo sin filtros', () => {
  const p = { ...makePublication({ openAccess: true, doi: null }), position: 1 };
  expect(publicationToProduct(p, 'Acceso abierto')).toMatchObject({
    key: p.eid,
    typology: 'GNC',
    index: 'Acceso abierto',
    citations: p.citations,
    doi: null,
    url: expect.stringContaining('scopus.com'),
  });
  expect(publicationToProduct({ ...p, openAccess: false }, 'Acceso abierto').index).toBeNull();

  const page = { items: [p], total: 1, page: 1, pages: 1 };
  expect(collectionJsonLd('Título', undefined, false)).toBeNull();
  expect(collectionJsonLd('Título', page, true)).toBeNull(); // una lista filtrada no es la colección
  const ld = collectionJsonLd('Título', page, false) as { mainEntity: { numberOfItems: number } };
  expect(ld.mainEntity.numberOfItems).toBe(1);
});
