import { USB_INDEX_GROUPS, USB_INDEX_MAX_WEIGHT, groupWeight } from './usb-index';
import es from '@/i18n/locales/es';

const vars: (readonly [string, number])[] = USB_INDEX_GROUPS.flatMap(
  (g) => g.vars as readonly (readonly [string, number])[],
);

test('el índice USB: los pesos suman 100 y el máximo es el de la barra', () => {
  expect(USB_INDEX_GROUPS.reduce((sum, g) => sum + groupWeight(g.vars), 0)).toBe(100);
  expect(Math.max(...vars.map(([, w]) => w))).toBe(USB_INDEX_MAX_WEIGHT);
});

test('el índice USB: cada grupo y cada variable tienen su texto', () => {
  for (const { key } of USB_INDEX_GROUPS) expect(es.authors.usbInfo.groups).toHaveProperty(key);
  for (const [key] of vars) expect(es.authors.usbInfo.vars).toHaveProperty(key);
});
