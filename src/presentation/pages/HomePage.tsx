import { Navigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { HomeHero } from '@/presentation/components/home/HomeHero';
import { HomeHighlights } from '@/presentation/components/home/HomeHighlights';
import { HomeRecent } from '@/presentation/components/home/HomeRecent';
import { ResearchIndicators } from '@/presentation/components/home/ResearchIndicators';
import { TerritoryBanner } from '@/presentation/components/home/TerritoryBanner';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
import { useResearchIndicators } from '@/presentation/hooks/use-research-indicators';
import { isDirectorySearch } from '@/shared/navigation';
import { ORGANIZATION, SITE_NAME, SITE_URL, safeJson } from '@/shared/seo';

// WebSite + la universidad como Organization (tipo que Google reconoce en resultados enriquecidos).
// ponytail: sin `logo` hasta tener una versión cuadrada ≥ 112 px (el logo actual es 400×65).
const websiteJsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL + '/',
    inLanguage: 'es-CO',
    publisher: ORGANIZATION,
  },
  {
    '@context': 'https://schema.org',
    ...ORGANIZATION,
    alternateName: 'Unisimón',
    sameAs: ['https://www.unisimon.edu.co'],
  },
];

function Home() {
  const { t } = useTranslation('home');
  const indicators = useResearchIndicators();
  useDocumentMetadata({ title: t('metaTitle'), description: t('metaDescription'), path: '/' });
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(websiteJsonLd) }} />
      <HomeHero />
      <ResearchIndicators indicators={indicators} />
      <HomeRecent indicators={indicators} />
      <TerritoryBanner />
      <HomeHighlights />
    </>
  );
}

export function HomePage() {
  const { search } = useLocation();
  // El directorio vivía en "/": los enlaces guardados con filtros siguen funcionando.
  return isDirectorySearch(search) ? <Navigate replace to={`/investigadores${search}`} /> : <Home />;
}
