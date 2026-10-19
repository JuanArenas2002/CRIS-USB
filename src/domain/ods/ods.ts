/**
 * Objetivos de Desarrollo Sostenible (Agenda 2030). Nombres oficiales de Naciones Unidas en español;
 * `short` es la etiqueta corta de la plantilla y `color` el color oficial de cada objetivo.
 */
export const ODS = [
  { id: 1, name: 'Fin de la pobreza', short: 'Pobreza', color: '#E5243B' },
  { id: 2, name: 'Hambre cero', short: 'Hambre', color: '#DDA63A' },
  { id: 3, name: 'Salud y bienestar', short: 'Salud', color: '#4C9F38' },
  { id: 4, name: 'Educación de calidad', short: 'Educación', color: '#C5192D' },
  { id: 5, name: 'Igualdad de género', short: 'Género', color: '#FF3A21' },
  { id: 6, name: 'Agua limpia y saneamiento', short: 'Agua', color: '#26BDE2' },
  { id: 7, name: 'Energía asequible y no contaminante', short: 'Energía', color: '#FCC30B' },
  { id: 8, name: 'Trabajo decente y crecimiento económico', short: 'Trabajo', color: '#A21942' },
  { id: 9, name: 'Industria, innovación e infraestructura', short: 'Innovación', color: '#FD6925' },
  { id: 10, name: 'Reducción de las desigualdades', short: 'Equidad', color: '#DD1367' },
  { id: 11, name: 'Ciudades y comunidades sostenibles', short: 'Ciudades', color: '#FD9D24' },
  { id: 12, name: 'Producción y consumo responsables', short: 'Consumo', color: '#BF8B2E' },
  { id: 13, name: 'Acción por el clima', short: 'Clima', color: '#3F7E44' },
  { id: 14, name: 'Vida submarina', short: 'Océanos', color: '#0A97D9' },
  { id: 15, name: 'Vida de ecosistemas terrestres', short: 'Ecosistemas', color: '#56C02B' },
  { id: 16, name: 'Paz, justicia e instituciones sólidas', short: 'Paz', color: '#00689D' },
  { id: 17, name: 'Alianzas para lograr los objetivos', short: 'Alianzas', color: '#19486A' },
] as const;

export type OdsId = (typeof ODS)[number]['id'];

export const isOdsId = (n: unknown): n is OdsId =>
  Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 17;

export const odsOf = (id: OdsId) => ODS[id - 1]!;

/** Icono oficial (versión en español, 2019) alojado por el portal. */
export const odsIcon = (id: OdsId) => `/assets/ods/ods-${id}.webp`;

/** Sin repetidos, solo ODS válidos y en orden ascendente (así se guardan y se muestran). */
export function normalizeOds(values: unknown): OdsId[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter(isOdsId))].sort((a, b) => a - b);
}

/**
 * ODS heredados de los grupos a los que pertenece un investigador: cada ODS una sola vez, con los
 * grupos que lo aportan (en el orden recibido). Ascendentes por número.
 */
export function inheritOds(groups: { name: string; ods?: OdsId[] }[]): { id: OdsId; groups: string[] }[] {
  const by = new Map<OdsId, string[]>();
  for (const g of groups)
    for (const id of g.ods ?? [])
      by.set(
        id,
        [...(by.get(id) ?? []), g.name].filter((n, i, a) => a.indexOf(n) === i),
      );
  return [...by.entries()].sort(([a], [b]) => a - b).map(([id, names]) => ({ id, groups: names }));
}
