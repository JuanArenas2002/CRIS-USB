// @vitest-environment node
import { authorQueries, toPublicProfile } from '@/application/authors/author-queries';
import { createQueryClient } from '@/app/App';
import { fakeGroupRepo, fakeRepo, makeAuthor } from '@/test-utils';
import { groupQueries } from '@/application/groups/group-queries';
import { render } from './entry-server';

test('prerender de perfil: HTML con contenido, metadatos únicos y JSON-LD verificable', () => {
  const queries = authorQueries(fakeRepo());
  const qc = createQueryClient();
  const author = makeAuthor({ name: 'Ana </script> Pérez' });
  qc.setQueryData(queries.profile(7).queryKey, toPublicProfile(author));

  const slug = '/investigadores/7-ana-script-perez';
  const { html, head } = render(slug, qc, queries, groupQueries(fakeGroupRepo()));

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
