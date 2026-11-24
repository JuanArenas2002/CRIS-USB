// Relacionamiento (públicos): producción por año, mapa por país y publicaciones con un país.
import { FIRST_RELATIONS_YEAR } from '../../../src/domain/relations/relations.ts';
import type { Handler, Route } from '../router.ts';

const byYear: Route = {
  match: /^\/api\/relations\/by-year$/,
  async handler({ ctx, send }) {
    return send(200, await ctx.institutionByYear());
  },
};

/** `?year=`: ausente → todos (null); fuera de [FIRST_RELATIONS_YEAR, año actual] → undefined (400). */
function yearParam(raw: string | null) {
  const year = raw ? Number(raw) : null;
  if (
    year !== null &&
    !(Number.isInteger(year) && year >= FIRST_RELATIONS_YEAR && year <= new Date().getFullYear())
  )
    return undefined;
  return year;
}

/** Ambas rutas validan el año igual y responden 400 «Año inválido». */
const withYear =
  (answer: (rc: Parameters<Handler>[0], year: number | null, m: RegExpExecArray) => unknown): Handler =>
  (rc, m) => {
    const year = yearParam(rc.sp.get('year'));
    return year === undefined ? rc.send(400, { detail: 'Año inválido' }) : answer(rc, year, m);
  };

const countries: Route = {
  match: /^\/api\/relations\/countries$/,
  handler: withYear(async ({ ctx, send }, year) => send(200, await ctx.collaboration(year))),
};

const countryPublications: Route = {
  match: /^\/api\/relations\/countries\/([A-Z]{3})\/publications$/,
  handler: withYear(async ({ ctx, send }, year, m) => {
    const pubs = await ctx.publicationsWith(m[1]!, year);
    return pubs ? send(200, pubs) : send(404, { detail: 'País sin publicaciones' });
  }),
};

export const relationRoutes = [byYear, countries, countryPublications];
