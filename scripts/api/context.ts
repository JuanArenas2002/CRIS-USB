// Contexto compartido del BFF: configuración, almacenes y accesores de datos (con su caché). Lo crea
// `createPublicApi` una vez y todos los handlers lo reciben; aquí no hay rutas ni HTTP.
import type { OrcidProfile, OrcidSearchHit } from '../../src/domain/orcid/orcid.ts';
import { DEFAULT_ORCID_URL, fetchOrcidProfile, searchOrcid } from '../orcid-source.ts';
import { fetchInvestigatorCenters, fetchPublicCenters } from '../centers-source.ts';
import {
  fetchCollaborationMap,
  fetchCountryPublications,
  fetchInstitutionByYear,
} from '../collaboration-source.ts';
import { fetchPublicGroups, getData, mapLimit } from '../groups-source.ts';
import { fetchPublicProjects } from '../projects-source.ts';
import {
  fetchGroupMembers,
  fetchInvestigatorGroups,
  fetchInvestigators,
  publishAuthors,
  publishWithTiers,
} from '../investigators-source.ts';
import { logoUrl, photoUrl, withProjectPhotos } from '../photo-store.ts';
import { createStores, type StoreOptions } from '../stores.ts';
import type { CenterDetail, CenterRef } from '../../src/domain/centers/center.ts';
import type { GroupDetail } from '../../src/domain/groups/group.ts';
import { withRankingCenter, type Author, type GroupRef } from '../../src/domain/authors/author.ts';
import { withAuthors } from '../../src/domain/publications/publication.ts';
import { cached, cachedByKey } from './cache.ts';

export const DEFAULT_METRIK_URL = 'https://metrik.unisimon.edu.co/back/api';
/** API de colaboración (relacionamiento). Sin `/api` al final. */
export const DEFAULT_COLLAB_URL = 'https://metrik.unisimon.edu.co/etl';

export type PublicApiOptions = {
  metrikUrl?: string;
  /** API de colaboración (mapa de relacionamiento). */
  collabUrl?: string;
  /** API pública de ORCID (perfiles de las personas asociadas a noticias). */
  orcidUrl?: string;
  adminToken?: string;
  onVercel?: boolean;
  /** gzip propio del JSON: solo en el servidor propio (Vercel y Vite ya tienen su capa delante). */
  compress?: boolean;
} & StoreOptions;

export function createApiContext({
  metrikUrl = DEFAULT_METRIK_URL,
  collabUrl = DEFAULT_COLLAB_URL,
  orcidUrl = DEFAULT_ORCID_URL,
  adminToken,
  compress = false,
  ...storage
}: PublicApiOptions = {}) {
  const base = metrikUrl.replace(/\/+$/, '');
  const {
    photos,
    logos,
    projectPhotos,
    sites,
    centerPasswords,
    ranking: rankingStore,
    rankingHidden,
    rankingTiers,
    publications: publicationStore,
  } = createStores(storage);

  // Perfiles ORCID: uno cacheado por persona (10 min, con respaldo si ORCID falla).
  // ponytail: tope de 500 perfiles en memoria; al pasarlo se descarta el más antiguo.
  const orcidProfile = cachedByKey<string, OrcidProfile | null>(
    (orcid) => fetchOrcidProfile(orcid, orcidUrl),
    500,
  );
  // Búsquedas por nombre en ORCID: cacheadas por término (tope de 200).
  const orcidSearch = cachedByKey<string, OrcidSearchHit[]>((term) => searchOrcid(term, orcidUrl), 200);

  const metrikGroups = cached<GroupDetail[]>(() => fetchPublicGroups(`${base}/group`));
  const metrikCenters = cached<CenterDetail[]>(() => fetchPublicCenters(base));
  const metrikProjects = cached(() => fetchPublicProjects(base));
  // Fotos fuera de la caché, como los logos: lo que sube el admin se ve al instante.
  // Relacionamiento: un mapa por año (y uno con todos), cacheado 10 min como lo demás.
  const collabBase = collabUrl.replace(/\/+$/, '');
  const collaborationByYear = cachedByKey<number, Awaited<ReturnType<typeof fetchCollaborationMap>>>((key) =>
    fetchCollaborationMap(collabBase, key || null),
  );
  const collaboration = (year: number | null) => collaborationByYear(year ?? 0);
  const institutionByYear = cached(() => fetchInstitutionByYear(collabBase));
  const countryPubs = new Map<string, () => ReturnType<typeof fetchCountryPublications>>();
  /** Publicaciones con un país (ISO3 → nombre Scopus del mapa del mismo año); null si no está. */
  const publicationsWith = async (iso3: string, year: number | null) => {
    const country = (await collaboration(year)).countries.find((c) => c.iso3 === iso3);
    if (!country) return null;
    const key = `${iso3}:${year ?? ''}`;
    if (!countryPubs.has(key))
      countryPubs.set(
        key,
        cached(() => fetchCountryPublications(collabBase, country.country, year)),
      );
    return countryPubs.get(key)!();
  };
  const projects = async () => {
    const v = await projectPhotos.versions();
    return (await metrikProjects()).map((p) => withProjectPhotos(p, v));
  };
  const centers = async () => {
    const [v, site] = await Promise.all([logos.versions(), sites.all()]);
    return (await metrikCenters()).map((c) => {
      const version = v.get(c.id);
      return {
        ...c,
        logoUrl: version === undefined ? null : logoUrl(c.id, version),
        website: site[c.id] ?? null,
      };
    });
  };
  // Grupos con sus ODS, ambos de Metri-K (caché). Fotos y logos no pasan por la caché: un cambio del
  // admin se ve al instante.
  const groups = metrikGroups;
  // Filas crudas por grupo (con datos personales): nunca salen; /api/groups/staffing solo da conteos.
  const staffRows = cached(async () =>
    mapLimit(
      (await groups()).filter((g) => g.active),
      6,
      async (g) => [g.id, await getData(`${base}/investigator/group/${g.id}`)] as const,
    ),
  );
  const directory = cached(() => fetchInvestigators(base));
  const photoUrls = async () => {
    const v = await photos.versions();
    return <T extends Author>(a: T): T => {
      const version = v.get(a.id);
      return { ...a, photoUrl: version === undefined ? null : photoUrl(a.id, version) };
    };
  };

  const groupsOf = cachedByKey<number, GroupRef[]>((id) => fetchInvestigatorGroups(base, id));
  const centersOf = cachedByKey<number, CenterRef[]>((id) => fetchInvestigatorCenters(base, id));
  const groupMembers = cachedByKey<number, Author[]>((groupId) => fetchGroupMembers(base, groupId));

  // Publicados según el ranking USB (o los seleccionados, sin ranking); cada uno con sus centros
  // (tarjeta y perfil) y el logo del portal. El ranking no pasa por la caché: un Excel nuevo se ve
  // al instante.
  // ponytail: una consulta a Metri-K por investigador (cacheada 10 min, 8 a la vez); con cientos de
  // publicados, la primera visita tras vencer la caché tarda unos segundos. Pedir a Metri-K un
  // endpoint masivo de centros si molesta.
  const investigators = async () => {
    const [withPhoto, v, ranking, hidden, top12, top60] = await Promise.all([
      photoUrls(),
      logos.versions(),
      rankingStore.all(),
      rankingHidden.all(),
      rankingTiers.top12.all(),
      rankingTiers.top60.all(),
    ]);
    const withLogo = <C extends { id: number }>(c: C) => {
      const version = v.get(c.id);
      return { ...c, logoUrl: version === undefined ? null : logoUrl(c.id, version) };
    };
    const known: CenterRef[] = (await metrikCenters().catch(() => []))
      .filter((c) => c.active)
      .map(({ id, code, acronym, name }) => withLogo({ id, code, acronym, name }));
    const published = publishWithTiers(await directory(), ranking, hidden, { top12, top60 });
    return mapLimit(published, 8, async (a) =>
      withRankingCenter(
        {
          ...withPhoto(a),
          centers: (await centersOf(a.id).catch((): CenterRef[] => [])).map(withLogo),
        },
        known,
      ),
    );
  };
  // Ranking de publicaciones con sus autores de Metri-K; como el ranking USB, sin caché propia.
  const publications = async () => {
    const [stored, dir, ranking, hidden] = await Promise.all([
      publicationStore.all(),
      directory(),
      rankingStore.all(),
      rankingHidden.all(),
    ]);
    return withAuthors(
      Object.values(stored),
      dir.byEid,
      new Map(dir.authors.map((a) => [a.id, a.name])),
      new Set(publishAuthors(dir, ranking, hidden).map((a) => a.id)),
    );
  };
  const membersOf = async (groupId: number) => {
    // Los integrantes publicados heredan las métricas del perfil (pubs e índice h en su tarjeta).
    const published = new Map((await investigators()).map((a) => [a.id, a]));
    const withPhoto = await photoUrls();
    return (await groupMembers(groupId)).map((m) => ({
      ...withPhoto(m),
      metrics: published.get(m.id)?.metrics ?? m.metrics,
      profilePublished: published.has(m.id),
    }));
  };

  return {
    // Configuración
    base,
    adminToken,
    compress,
    // Almacenes
    photos,
    logos,
    projectPhotos,
    sites,
    centerPasswords,
    rankingStore,
    rankingHidden,
    rankingTiers,
    publicationStore,
    // Datos de Metri-K, ORCID y colaboración (con caché)
    orcidProfile,
    orcidSearch,
    metrikGroups,
    metrikCenters,
    metrikProjects,
    collaboration,
    institutionByYear,
    publicationsWith,
    groups,
    staffRows,
    directory,
    groupsOf,
    // Vistas públicas compuestas
    projects,
    centers,
    investigators,
    publications,
    membersOf,
  };
}

export type ApiContext = ReturnType<typeof createApiContext>;
