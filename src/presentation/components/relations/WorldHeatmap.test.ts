import { clamp, zoomAt } from './WorldHeatmap';

test('zoom: el punto bajo el cursor queda fijo y la escala se limita a 1–12', () => {
  const v = zoomAt({ k: 1, x: 0, y: 0 }, 2, 300, 200);
  expect(v.k).toBe(2);
  // El punto (300, 200) del viewBox sigue en (300, 200) en pantalla: x + k·300 = 300.
  expect(v.x + v.k * 300).toBeCloseTo(300);
  expect(v.y + v.k * 200).toBeCloseTo(200);
  expect(zoomAt({ k: 10, x: 0, y: 0 }, 5).k).toBe(12);
  expect(zoomAt({ k: 1, x: 0, y: 0 }, 0.5)).toEqual({ k: 1, x: 0, y: 0 });
});

test('desplazamiento: el mapa nunca se sale del recuadro', () => {
  expect(clamp({ k: 1, x: 50, y: -30 })).toEqual({ k: 1, x: 0, y: 0 });
  // A escala 2 el desplazamiento va de −960 a 0 (x) y de −470 a 0 (y).
  expect(clamp({ k: 2, x: -5000, y: 100 })).toEqual({ k: 2, x: -960, y: 0 });
});
