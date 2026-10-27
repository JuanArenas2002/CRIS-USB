// @vitest-environment node
import { toPublicProject } from './projects-source';
import { projectProducts, projectTitle } from '../src/domain/projects/project';
import { projectPhotoKey, withProjectPhotos } from './photo-store';

const raw = {
  id: 1,
  codigo: '1-3-02-7-24',
  titulo: 'Programa de cuidado comunitario',
  centros: ['Centro X', ''],
  periodo: '2024 - 2025',
  estadoProyecto: 'En ejecución',
  ods: ['ODS 5: Igualdad de género', 'ODS 1: Fin de la pobreza', 'ODS 99: no existe'],
  lideres: [
    { nombre: '', cedula: '' },
    { nombre: 'Ana Pérez', cedula: '11111111' },
  ],
  personal: [{ cedula: '22222222', nombreCompleto: 'LUIS GÓMEZ', rol: 'Investigador Principal' }],
  productos: [
    { titulo: 'App', tipo: 'Software', anio: 2025, url: 'javascript:alert(1)' },
    { titulo: '', tipo: 'vacío' },
  ],
};

test('proyecto público: sin cédulas, ODS por número, periodo en años y URLs seguras', () => {
  const p = toPublicProject(raw)!;
  expect(JSON.stringify(p)).not.toContain('11111111');
  expect(JSON.stringify(p)).not.toContain('22222222');
  // `personal` con rol primero; los `lideres` antiguos se suman sin rol.
  expect(p.team).toEqual([
    { name: 'LUIS GÓMEZ', role: 'Investigador Principal' },
    { name: 'Ana Pérez', role: null },
  ]);
  expect(p.ods).toEqual([1, 5]);
  expect([p.startYear, p.endYear]).toEqual([2024, 2025]);
  expect(p.centers).toEqual(['Centro X']);
  expect(p.products).toEqual([
    { title: 'App', type: 'Software', subtype: null, year: 2025, status: null, url: null },
  ]);
  expect(toPublicProject({ ...raw, titulo: '' })).toBeNull();
});

test('fotos de proyecto: principal en la posición 0 y galería en orden', () => {
  const v = new Map([
    [projectPhotoKey(1, 0), 10],
    [projectPhotoKey(1, 3), 30],
    [projectPhotoKey(1, 1), 20],
    [projectPhotoKey(2, 0), 99],
  ]);
  const p = withProjectPhotos({ id: 1 }, v);
  expect(p.photoUrl).toBe('/api/projects/1/photos/0?v=10');
  expect(p.gallery).toEqual([
    { slot: 1, url: '/api/projects/1/photos/1?v=20' },
    { slot: 3, url: '/api/projects/1/photos/3?v=30' },
  ]);
});

test('títulos en mayúsculas → tipo oración; siglas y tramos en minúsculas se respetan', () => {
  expect(
    projectTitle('APROVECHAMIENTO DE LOS ECOSISTEMAS MARINOS COSTEROS COMO UNA ALTERNATIVA - AGROBAC'),
  ).toBe('Aprovechamiento de los ecosistemas marinos costeros como una alternativa - AGROBAC');
  expect(projectTitle('IMPLEMENTACIÓN DE UNA ESTRATEGIA. - Puerta de Oro')).toBe(
    'Implementación de una estrategia. - Puerta de Oro',
  );
  expect(projectTitle('VART – Valoración de Retina por Telemedicina')).toBe(
    'VART – Valoración de Retina por Telemedicina',
  );
  expect(projectTitle('Hacia una mirada globalizante 2018-2024')).toBe(
    'Hacia una mirada globalizante 2018-2024',
  );
});

test('productos del proyecto → tabla del investigador: tipología por tipo, subtipo como tipo, recientes primero', () => {
  const rows = projectProducts({
    id: 1,
    products: [
      {
        title: 'App',
        type: 'Desarrollo de Software',
        subtype: 'Aplicación Móvil',
        year: 2023,
        status: 'Publicado',
        url: null,
      },
      { title: 'Guía', type: 'Apropiación Social', subtype: null, year: 2025, status: null, url: null },
      {
        title: 'Art',
        type: 'Artículo de investigación',
        subtype: 'Artículo Q1',
        year: 2024,
        status: null,
        url: 'https://doi.org/10.1/x',
      },
    ],
  });
  expect(rows.map((r) => [r.title, r.typology, r.type])).toEqual([
    ['Guía', 'ASC', 'Apropiación Social'],
    ['Art', 'GNC', 'Artículo Q1'],
    ['App', 'DTI', 'Aplicación Móvil'],
  ]);
  expect(rows[1]!.doi).toBe('10.1/x');
});
