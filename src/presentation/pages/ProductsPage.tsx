import { useTranslation } from 'react-i18next';
import { ContactCta } from '@/presentation/components/layout/ContactCta';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
import {
  usePublicationSearch,
  usePublicationStats,
  usePublications,
} from '@/presentation/hooks/use-publications';
import { safeJson } from '@/shared/seo';
import { ProductsChart } from './products/ProductsChart';
import { ProductsFilters } from './products/ProductsFilters';
import { ProductsHero } from './products/ProductsHero';
import { ProductsList } from './products/ProductsList';
import { collectionJsonLd } from './products/products-model';

/** Producción científica destacada: ranking de publicaciones Scopus cargado en /admin/produccion. */
export function ProductsPage() {
  const { t } = useTranslation(['publications', 'common']);
  const search = usePublicationSearch();
  const stats = usePublicationStats();
  const list = usePublications(search.filters);
  const s = stats.data;

  useDocumentMetadata({
    title: t('metaTitle'),
    description: t('metaDescription'),
    path: '/productos',
    // Vacío o filtrado: no se indexa.
    noindex: search.isFiltered || s?.total === 0,
  });

  const jsonLd = collectionJsonLd(t('metaTitle'), list.data, search.isFiltered);

  return (
    <>
      {jsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(jsonLd) }} />
      ) : null}
      <ProductsHero stats={s} />
      <ProductsFilters search={search} stats={s} />
      {s?.total ? <ProductsChart filters={search.filters} /> : null}
      <ProductsList list={list} stats={s} onReset={search.reset} />
      <ContactCta />
    </>
  );
}
