/** Publicaciones en coautoría con un país (fuente: API de colaboración, afiliaciones Scopus). */
export interface CountryCollaboration {
  /** ISO 3166 alfa-2 ("CO"): bandera y nombre traducido del país. */
  iso2: string;
  iso3: string;
  /** ISO 3166 numérico de 3 dígitos ("170"): el id de los países en el mapa (world-atlas). */
  isoNumeric: string;
  /** Nombre en Scopus (inglés): con él se piden sus publicaciones a la API. */
  country: string;
  /** El país local cuenta como "nacional"; los demás, "internacional". */
  local: boolean;
  publications: number;
  citations: number;
}

export interface CollaborationMap {
  /** null = todos los años. */
  year: number | null;
  countries: CountryCollaboration[];
}

/** Publicación en coautoría con un país. */
export interface CountryPublication {
  eid: string;
  title: string;
  year: number | null;
  doi: string | null;
  journal: string | null;
  /** Tipo documental de Scopus ("Article", "Review", "Conference paper"…). */
  docType: string | null;
  citations: number;
  quartile: string | null;
  /** Instituciones del país con las que se publicó. */
  partners: string[];
}

export interface RelationsRepository {
  countries(year: number | null, signal?: AbortSignal): Promise<CollaborationMap>;
  /** Publicaciones con un país (por ISO3); [] si el país no tiene. */
  publications(iso3: string, year: number | null, signal?: AbortSignal): Promise<CountryPublication[]>;
}

/** Primer año del selector. ponytail: fijo; pedir a la API el rango real si cambia la serie. */
export const FIRST_RELATIONS_YEAR = 2015;

/**
 * Tramos del mapa de calor (escala logarítmica: Colombia tiene >1000 y la mayoría de países <20).
 * `HEAT_BINS[i]` es el mínimo del tramo i; 0 publicaciones queda fuera de la escala.
 */
export const HEAT_BINS = [1, 2, 6, 21, 101] as const;

/** Tramo 0–4 de un conteo; -1 si no hay publicaciones. */
export const heatBin = (n: number) => {
  for (let i = HEAT_BINS.length - 1; i >= 0; i--) if (n >= HEAT_BINS[i]!) return i;
  return -1;
};
