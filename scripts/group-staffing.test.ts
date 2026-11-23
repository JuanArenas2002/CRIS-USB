import { expect, test } from 'vitest';
import { toGroupStaffing } from './groups-source.ts';

test('toGroupStaffing: todos los contratados de cada grupo, por sede (se repiten entre grupos)', () => {
  const r = (id: number, contracted: boolean, site: string | null, gruplac = true) => ({
    id,
    contracted,
    state_gruplac: gruplac,
    site: site && { name: site },
    person: { email: 'x@y' },
  });
  const ana = r(1, true, 'Cúcuta');
  expect(
    toGroupStaffing([
      [
        7,
        [
          ana,
          r(2, true, 'Barranquilla'),
          r(3, true, null),
          r(4, false, 'Cúcuta'),
          r(5, true, 'Cúcuta', false),
        ],
      ],
      [9, [ana]],
    ]),
  ).toEqual([
    { groupId: 7, contracted: 3, bySite: { Cúcuta: 1, Barranquilla: 1, 'Sin sede': 1 } },
    { groupId: 9, contracted: 1, bySite: { Cúcuta: 1 } },
  ]);
});
