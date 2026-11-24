// ORCID (públicos): búsqueda por nombre y perfil de una persona.
import { normalizeOrcid } from '../../../src/domain/orcid/orcid.ts';
import type { Route } from '../router.ts';

// Búsqueda por nombre en ORCID (mínimo 3 letras). Va antes que /api/orcid/{orcid}.
const orcidSearch: Route = {
  match: /^\/api\/orcid\/search$/,
  async handler({ ctx, sp, send }) {
    const term = (sp.get('q') ?? '').trim().toLowerCase().slice(0, 80);
    return send(200, term.replace(/\s/g, '').length >= 3 ? await ctx.orcidSearch(term) : []);
  },
};

// Perfil público ORCID de una persona (nombre, empleos, educación). 400 si el ORCID no es válido.
const orcidProfile: Route = {
  match: /^\/api\/orcid\/([^/]{1,60})$/,
  async handler({ ctx, send }, m) {
    const orcid = normalizeOrcid(decodeURIComponent(m[1]!));
    if (!orcid) return send(400, { detail: 'ORCID no válido' });
    const profile = await ctx.orcidProfile(orcid);
    return profile
      ? send(200, profile)
      : send(404, { detail: 'No existe un registro ORCID público con ese iD' });
  },
};

export const orcidRoutes = [orcidSearch, orcidProfile];
