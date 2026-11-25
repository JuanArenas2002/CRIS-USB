/** Criterios del puntaje de las publicaciones y su peso en % (suman 100). Los de peso 0 no cuentan y no se listan. */
export const RANKING_CRITERIA = [
  ['quartile', 30],
  ['citations', 30],
  ['correspondence', 20],
  ['openAccess', 10],
  ['nonMultidisciplinary', 5],
  ['language', 5],
] as const;

/** Peso más alto: la barra de cada criterio se mide contra él. */
export const RANKING_MAX_WEIGHT = 30;
