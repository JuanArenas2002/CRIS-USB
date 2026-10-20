// Generación estática (SSG): HTML con contenido real para cada página pública, más sitemap.xml,
// robots.txt y llms.txt. Los datos de Metri-K se proyectan a campos públicos antes de renderizar.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEnv } from 'vite';
import { fetchPublicCenters } from './centers-source.ts';
import { fetchPublicGroups, mapLimit } from './groups-source.ts';
import {
  fetchGroupMembers,
  fetchInvestigators,
  publishAuthors,
  withProfiles,
} from './investigators-source.ts';
import { DEFAULT_METRIK_URL } from './public-api.ts';
import { logoUrl, photoUrl } from './photo-store.ts';
import { createStores, storeOptionsFromEnv } from './stores.ts';

const env = loadEnv('production', process.cwd(), ['CRIS_', 'VITE_', 'BLOB_']);
const metrik = (env.CRIS_METRIK_URL || DEFAULT_METRIK_URL).replace(/\/+$/, '');
const siteUrl = (env.VITE_SITE_URL || 'http://localhost:5173').replace(/\/+$/, '');

const dist = path.resolve('dist');
const ssr = await import(pathToFileURL(path.resolve('dist-ssr/entry-server.js')).href);
const template = await fs.readFile(path.join(dist, 'index.html'), 'utf8');

// 1. Datos (si Metri-K falla, el build falla: no se publica un sitio vacío).
// Fotos y ODS del mismo almacenamiento que el BFF (disco en local, Vercel Blob en Vercel).
const stores = createStores({
  ...storeOptionsFromEnv({ ...env, ...process.env }),
  onVercel: !!process.env.VERCEL,
});
const odsByGroup = await stores.ods.all();
const photoVersions = await stores.photos.versions();
const photoOf = (id) => (photoVersions.has(id) ? photoUrl(id, photoVersions.get(id)) : null);
const groups = (await fetchPublicGroups(`${metrik}/group`)).map((g) => ({
  ...g,
  ods: odsByGroup[g.id] ?? [],
}));
const logoVersions = await stores.logos.versions();
const logoOf = (id) => (logoVersions.has(id) ? logoUrl(id, logoVersions.get(id)) : null);
// Publicados: los del ranking USB (/admin/ranking) o, sin ranking, los seleccionados en Metri-K.
const directory = await fetchInvestigators(metrik);
const ranked = publishAuthors(directory, await stores.ranking.all(), await stores.rankingHidden.all());
const authors = (await withProfiles(metrik, { authors: ranked, production: directory.production })).map(
  (a) => ({
    ...a,
    groups: a.groups.map((g) => ({
      ...g,
      ods: odsByGroup[g.id] ?? [],
      type: groups.find((x) => x.id === g.id)?.type ?? null,
    })),
    centers: a.centers.map((c) => ({ ...c, logoUrl: logoOf(c.id) })),
    photoUrl: photoOf(a.id),
  }),
);
const authorsQ = ssr.createServerAuthorQueries(authors);
const published = new Map(authors.map((a) => [a.id, a]));
// Interinstitucionales: solo en el listado (sin ficha ni integrantes).
const activeGroups = groups.filter((g) => g.active && ssr.hasPublicDetail(g));
const members = new Map(
  await mapLimit(activeGroups, 6, async (g) => [
    g.id,
    (await fetchGroupMembers(metrik, g.id)).map((m) => ({
      ...m,
      photoUrl: photoOf(m.id),
      metrics: published.get(m.id)?.metrics ?? m.metrics,
      profilePublished: published.has(m.id),
    })),
  ]),
);
const groupsQ = ssr.createServerGroupQueries(groups, members);
const sites = await stores.sites.all();
const centers = (await fetchPublicCenters(metrik)).map((c) => ({
  ...c,
  logoUrl: logoOf(c.id),
  website: sites[c.id] ?? null,
}));
const centersQ = ssr.createServerCenterQueries(centers);

async function writePage(url, file, prefetch = async () => {}) {
  const qc = ssr.createQueryClient();
  await prefetch(qc);
  const { html, head } = ssr.render(url, qc, authorsQ, groupsQ, centersQ);
  const out = template.replace('<!--app-head-->', () => head).replace('<!--app-html-->', () => html);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, out);
}

// 2. Páginas.
await writePage('/', path.join(dist, 'index.html'), (qc) =>
  Promise.all([
    qc.fetchQuery(authorsQ.directory({ search: '', page: 1 })),
    qc.fetchQuery(authorsQ.stats()),
    qc.fetchQuery(authorsQ.featured()),
    qc.fetchQuery(groupsQ.list()),
  ]),
);
const profilePaths = [];
for (const a of authors) {
  const url = `/investigadores/${ssr.authorSlug(a)}`;
  if (ssr.isIndexable(a)) profilePaths.push(url);
  await writePage(url, path.join(dist, url, 'index.html'), (qc) => qc.fetchQuery(authorsQ.profile(a.id)));
}
await writePage('/grupos', path.join(dist, 'grupos', 'index.html'), (qc) => qc.fetchQuery(groupsQ.list()));
const groupPaths = [];
for (const g of activeGroups) {
  const url = `/grupos/${ssr.authorSlug(g)}`;
  groupPaths.push(url);
  await writePage(url, path.join(dist, url, 'index.html'), (qc) =>
    Promise.all([
      qc.fetchQuery(groupsQ.detail(g.id)),
      qc.fetchQuery(groupsQ.members(g.id)),
      // Producción del grupo = la de sus integrantes con perfil publicado.
      ...(members.get(g.id) ?? [])
        .filter((m) => m.profilePublished)
        .map((m) => qc.fetchQuery(authorsQ.profile(m.id))),
    ]),
  );
}
// Centros: catálogo y una ficha por centro activo (como grupos).
await writePage('/centros', path.join(dist, 'centros', 'index.html'), (qc) => qc.fetchQuery(centersQ.list()));
const centerPaths = [];
for (const c of centers.filter((x) => x.active)) {
  const url = `/centros/${ssr.authorSlug(c)}`;
  centerPaths.push(url);
  await writePage(url, path.join(dist, url, 'index.html'), (qc) => qc.fetchQuery(centersQ.detail(c.id)));
}
for (const section of ssr.NAV_ITEMS.filter((i) => !i.ready).map((i) => i.to)) {
  await writePage(section, path.join(dist, section, 'index.html'));
}
await writePage('/404', path.join(dist, '404.html'));

// 3. Archivos para rastreadores.
const xmlEsc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${['/', '/grupos', ...groupPaths, '/centros', ...centerPaths, ...profilePaths].map((p) => `  <url><loc>${xmlEsc(siteUrl + p)}</loc></url>`).join('\n')}
</urlset>
`;
await fs.writeFile(path.join(dist, 'sitemap.xml'), sitemap);
await fs.writeFile(
  path.join(dist, 'robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
);
await fs.writeFile(
  path.join(dist, 'llms.txt'),
  `# Unisimón Research

> Portal público de investigación de la Universidad Simón Bolívar (Colombia): investigadores activos con su categoría Minciencias, grupos de investigación y perfiles científicos (ORCID, Scopus, CvLAC, Google Scholar), y grupos con sus líneas de investigación e historial de categoría.

- [Directorio de investigadores](${siteUrl}/)
- [Grupos de investigación](${siteUrl}/grupos)
- [Sitemap con todas las páginas](${siteUrl}/sitemap.xml)
`,
);

// Verificación de Google Search Console por archivo HTML (CRIS_GOOGLE_VERIFICATION, separadas por
// coma). Acepta "google123abc.html", "google123abc" o la línea completa que muestra Google.
for (const raw of (env.CRIS_GOOGLE_VERIFICATION || '').split(',')) {
  const name = raw
    .replace(/^\s*google-site-verification:\s*/i, '')
    .trim()
    .replace(/(\.html)?$/, '.html');
  if (name === '.html') continue;
  if (!/^google[0-9a-f]{8,}\.html$/.test(name)) throw new Error(`CRIS_GOOGLE_VERIFICATION inválido: ${raw}`);
  await fs.writeFile(path.join(dist, name), `google-site-verification: ${name}`);
  console.log(`Google Search Console: /${name}`);
}

console.log(
  `Prerender: ${authors.length} investigadores (${profilePaths.length} indexables), ${groupPaths.length} grupos, ${centerPaths.length} centros. Sitemap en ${siteUrl}/sitemap.xml`,
);
