// @vitest-environment node
import { authorQueries, toPublicProfile } from '@/application/authors/author-queries';
import { createQueryClient } from '@/app/App';
import { fakeCenterRepo, fakeGroupRepo, fakeRepo, makeAuthor } from '@/test-utils';
import { centerQueries } from '@/application/centers/center-queries';
import { groupQueries } from '@/application/groups/group-queries';
import { createServerAuthorQueries, render } from './entry-server';

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
