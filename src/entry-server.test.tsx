// @vitest-environment node
import { authorQueries, toPublicProfile } from '@/application/authors/author-queries';
import { createQueryClient } from '@/app/App';
import {
  fakeCenterRepo,
  fakeGroupRepo,
  fakeProjectRepo,
  fakePublicationRepo,
  fakeRepo,
  makeAuthor,
  makePublication,
} from '@/test-utils';
import { centerQueries } from '@/application/centers/center-queries';
import { groupQueries } from '@/application/groups/group-queries';
import { publicationQueries } from '@/application/publications/publication-queries';
import { projectQueries } from '@/application/projects/project-queries';
import { createServerAuthorQueries, createServerPublicationQueries, render } from './entry-server';

test('prerender de perfil: HTML con contenido, metadatos únicos y JSON-LD verificable', () => {
  const queries = authorQueries(fakeRepo());
  const qc = createQueryClient();
  const author = makeAuthor({ name: 'Ana </script> Pérez' });
  qc.setQueryData(queries.profile(7).queryKey, toPublicProfile(author));

  const slug = '/investigadores/7-ana-script-perez';
  const { html, head } = render(
    slug,
    qc,
    queries,
    groupQueries(fakeGroupRepo()),
    centerQueries(fakeCenterRepo()),
    publicationQueries(fakePublicationRepo()),
    projectQueries(fakeProjectRepo()),
  );

  expect(html).toContain('<h1');
  expect(html).toContain('Ana &lt;/script&gt; Pérez');
  expect(head).toContain('<title>Ana &lt;/script&gt; Pérez | Unisimón Research</title>');
  expect(head).toMatch(/<link data-seo rel="canonical" href="[^"]+\/investigadores\/7-ana-script-perez">/);
  expect(head).toContain('content="index, follow"');
  // JSON embebido no puede cerrar el <script>.
  expect(head.split('</script>')).toHaveLength(2);
  expect(html.match(/<\/script>/g)?.length).toBe(1);

  const jsonLd = JSON.parse(/application\/ld\+json">(.*?)<\/script>/.exec(html)![1]!);
  expect(jsonLd[0].mainEntity).toMatchObject({
    '@type': 'Person',
    identifier: { propertyID: 'ORCID', value: '0000-0002-1825-0097' },
    sameAs: ['https://orcid.org/0000-0002-1825-0097', expect.stringContaining('scopus.com')],
  });
  expect(jsonLd[0].mainEntity).not.toHaveProperty('email');
});

test('prerender: listado y destacados llevan solo la tarjeta, sin la producción del perfil', async () => {
  const author = makeAuthor({
    metrics: { hIndex: 5, scopusPublications: 1, products: 1 },
    production: {
      publications: [
        {
          id: 1,
          title: 'TITULO-DE-PRODUCCION',
          year: 2020,
          journal: null,
          type: 'Article',
          citedBy: 0,
          doi: null,
          url: null,
          authors: null,
        },
      ],
      theses: [],
      developments: [],
    },
  });
  const q = createServerAuthorQueries([author]);
  const qc = createQueryClient();
  const [page, featured, profile] = await Promise.all([
    qc.fetchQuery(q.directory({ search: '', page: 1 })),
    qc.fetchQuery(q.featured()),
    qc.fetchQuery(q.profile(author.id)),
  ]);
  expect(page.items[0]).not.toHaveProperty('production');
  expect(featured[0]).not.toHaveProperty('production');
  expect(JSON.stringify([page, featured])).not.toContain('TITULO-DE-PRODUCCION');
  // El perfil sí la conserva.
  expect(profile.kind === 'found' && profile.author.production?.publications).toHaveLength(1);
});

test('prerender de /productos: el ranking de publicaciones sale en el HTML y es indexable', async () => {
  const publications = createServerPublicationQueries([
    makePublication(),
    makePublication({ rank: 2, eid: '2-s2.0-1000000', title: 'Second <b>paper</b>', doi: null }),
  ]);
  const qc = createQueryClient();
  await Promise.all([
    qc.fetchQuery(publications.list({ search: '', sort: 'rank', page: 1 })),
    qc.fetchQuery(publications.stats()),
  ]);
  const { html, head } = render(
    '/productos',
    qc,
    authorQueries(fakeRepo()),
    groupQueries(fakeGroupRepo()),
    centerQueries(fakeCenterRepo()),
    publications,
    projectQueries(fakeProjectRepo()),
  );
  expect(html).toContain('Metabolic Reprogramming in Cancer Cells');
  expect(html).toContain('Second &lt;b&gt;paper&lt;/b&gt;');
  expect(html).toContain('href="https://doi.org/10.3390/pharmaceutics14061303"');
  expect(html).toContain('scopus.com/inward/record.uri?eid=2-s2.0-1000000');
  expect(html).toMatch(/ISSN (<!-- -->)?1999-4923/);
  expect(head).toContain('content="index, follow"');
  // Sin «Cargando…»: los datos se hidratan desde el HTML.
  expect(html).not.toContain('aria-busy="true"');
});

test('prerender de proyecto: ficha con objetivo, productos, ODS y enlaces de evidencia', async () => {
  const projects = projectQueries(fakeProjectRepo());
  const qc = createQueryClient();
  await qc.fetchQuery(projects.detail(3));
  const { html, head } = render(
    '/proyectos/3-programa-de-fortalecimiento-a-organizaciones-de-cuidado-comunitario',
    qc,
    authorQueries(fakeRepo()),
    groupQueries(fakeGroupRepo()),
    centerQueries(fakeCenterRepo()),
    publicationQueries(fakePublicationRepo()),
    projects,
  );
  expect(html).toContain('<h1');
  expect(html).toContain('Diseñar e implementar un programa de fortalecimiento.');
  expect(html).toContain('Plataforma Cuida Conmigo');
  expect(html).toContain('href="https://cuidaconmigo.com/x"');
  expect(html).toContain('ods-5.webp');
  expect(html).toContain('ResearchProject');
  expect(head).toContain('content="index, follow"');
});
