// Banderas SVG del paquete country-flag-icons, servidas por el propio portal: cada una es un
// archivo aparte (solo se descarga la que se muestra), sin depender de un CDN externo.
// Solo países (código de 2 letras): el paquete trae también subdivisiones como `BQ-BO.svg`
// (Bonaire) o `GB-ENG.svg`, que no deben pisar a `BO.svg` (Bolivia) ni a `NG.svg` (Nigeria).
const FLAGS = import.meta.glob(
  [
    '../../../../node_modules/country-flag-icons/3x2/*.svg',
    '!../../../../node_modules/country-flag-icons/3x2/*-*.svg',
  ],
  {
    query: '?no-inline',
    import: 'default',
    eager: true,
  },
) as Record<string, string>;
const byCode = new Map(
  Object.entries(FLAGS).flatMap(([path, url]) => {
    const code = /\/([A-Z]{2})\.svg$/.exec(path)?.[1];
    return code ? [[code, url] as const] : [];
  }),
);

/** Bandera 3:2 de un país por su ISO alfa-2; decorativa (el nombre va siempre al lado). */
export function Flag({ iso2, className = 'h-4 w-6' }: { iso2: string; className?: string }) {
  const src = byCode.get(iso2.toUpperCase());
  if (!src)
    return (
      <span aria-hidden="true" className={`${className} inline-block rounded-sm bg-surface-cream-alt`} />
    );
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className={`${className} inline-block shrink-0 rounded-sm object-cover ring-1 ring-black/10`}
    />
  );
}

/** Nombre del país en el idioma activo ("ES" → "España" / "Spain"); si no, el de Scopus. */
export function countryName(iso2: string, fallback: string, locale: string) {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(iso2) ?? fallback;
  } catch {
    return fallback;
  }
}
