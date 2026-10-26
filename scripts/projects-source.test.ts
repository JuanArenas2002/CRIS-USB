// @vitest-environment node
import { toPublicProject } from './projects-source';
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
  productos: [
    { titulo: 'App', tipo: 'Software', anio: 2025, url: 'javascript:alert(1)' },
    { titulo: '', tipo: 'vacío' },
  ],
};

test('proyecto público: sin cédulas, ODS por número, periodo en años y URLs seguras', () => {
  const p = toPublicProject(raw)!;
  expect(JSON.stringify(p)).not.toContain('11111111');
  expect(p.leaders).toEqual(['Ana Pérez']);
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
