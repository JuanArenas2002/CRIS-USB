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
import { collectionJsonLd, languageName, selectableYears } from './products-model';

test('productos: el gráfico por año se pide con el botón, sigue los filtros y se oculta', async () => {
  const user = userEvent.setup();
  renderApp('/productos?desde=2022&hasta=2022');
  const button = await screen.findByRole('button', { name: 'Ver evolución anual' });
  expect(button).toHaveAttribute('aria-expanded', 'false');
  expect(document.getElementById('pubs-chart')).toBeNull();

  await user.click(button);
  expect(screen.getByRole('button', { name: 'Ocultar gráfico' })).toHaveAttribute('aria-expanded', 'true');
  const panel = document.getElementById('pubs-chart')!;
  expect(panel).not.toBeNull();
  // La publicación simulada (2022) cumple el filtro: hay gráfico y no el aviso de «sin resultados».
  await within(panel).findByText(/Publicaciones indexadas en Scopus/);

  await user.click(screen.getByRole('button', { name: 'Ocultar gráfico' }));
  expect(document.getElementById('pubs-chart')).toBeNull();
});

test('productos: el gráfico por año aplica los mismos filtros que la tabla', async () => {
  const user = userEvent.setup();
  renderApp('/productos?tipo=Book'); // ninguna publicación es de ese tipo
  await user.click(await screen.findByRole('button', { name: 'Ver evolución anual' }));
  const panel = document.getElementById('pubs-chart')!;
  expect(await within(panel).findByText('No se encontraron publicaciones')).toBeInTheDocument();
});

test('productos: sin publicaciones cargadas no se ofrece el gráfico', async () => {
  renderApp('/productos', fakeRepo(), fakeGroupRepo(), fakeCenterRepo(), fakePublicationRepo([]));
  expect(await screen.findByText('Aún no hay publicaciones')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Ver evolución anual' })).not.toBeInTheDocument();
});

test('modelo: rango de años (invertido o abierto) y años elegibles con los del enlace', () => {
  expect(selectableYears([2024, 2022], {})).toEqual([2024, 2022]);
  // El año de un enlace sin publicaciones también se puede elegir, sin repetidos y recientes primero.
  expect(selectableYears([2024, 2022], { yearFrom: 2019, yearTo: 2022 })).toEqual([2024, 2022, 2019]);
  expect(selectableYears(undefined, {})).toEqual([]);
});

test('modelo: JSON-LD solo sin filtros', () => {
  const p = { ...makePublication({ doi: null }), position: 1 };
  const page = { items: [p], total: 1, page: 1, pages: 1 };
  expect(collectionJsonLd('Título', undefined, false)).toBeNull();
  expect(collectionJsonLd('Título', page, true)).toBeNull(); // una lista filtrada no es la colección
  const ld = collectionJsonLd('Título', page, false) as { mainEntity: { numberOfItems: number } };
  expect(ld.mainEntity.numberOfItems).toBe(1);
});

test('modelo: nombre del idioma desde el código de Scopus; desconocido, el código', () => {
  expect(languageName('eng', 'es')).toBe('Inglés');
  expect(languageName('spa', 'en')).toBe('Spanish');
  expect(languageName('zzzz-invalid-code', 'es')).toBe('ZZZZ-INVALID-CODE');
});

test('productos: tabla con las columnas pedidas, filtros activos en texto y modal de criterios', async () => {
  renderApp('/productos?desde=2020&oa=1');
  const table = await screen.findByRole('table', { name: 'Ranking de publicaciones' });
  const headers = within(table)
    .getAllByRole('columnheader')
    .map((h) => h.textContent);
  expect(headers).toEqual([
    '#',
    'Puntaje',
    'DOI',
    'Título',
    'Año',
    'Tipo documental',
    'Revista',
    'Citas',
    'Idioma',
    'Open Access',
    'Coautoría internacional',
    'Correspondencia institucional',
    'Autores de correspondencia',
  ]);
  expect(screen.getByText(/Filtros activos:/).closest('p')).toHaveTextContent(
    'Filtros activos: Desde 2020 · Solo acceso abierto',
  );
  expect(screen.getByRole('button', { name: 'Criterios de ranking' })).toHaveAttribute(
    'aria-haspopup',
    'dialog',
  );
  expect(screen.getByText('Cuartil de la revista')).toBeInTheDocument();
  expect(screen.getByText('Pérez, Ana María')).toBeInTheDocument();
});
