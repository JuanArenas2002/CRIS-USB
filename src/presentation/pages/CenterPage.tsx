import { Link, Navigate, useLocation, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { authorSlug, parseAuthorId } from '@/domain/authors/author';
import type { CenterDetail } from '@/domain/centers/center';
import { ErrorState } from '@/presentation/components/feedback/Feedback';
import { Icon } from '@/presentation/components/ui/Icon';
import { useCenterQueries } from '@/presentation/hooks/use-centers';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
import { safeJson } from '@/shared/seo';
import { NotFoundPage } from './NotFoundPage';
import { CenterBreadcrumb, CenterHeader } from './center/CenterHeader';
import { CenterInstitutional } from './center/CenterInstitutional';
import { CenterLinesAndOds } from './center/CenterLinesAndOds';
import { CenterGroups, CenterProjects } from './center/CenterRelated';
import { CenterResolutions } from './center/CenterResolutions';
import { centerDescription, centerJsonLd, centerTitle } from './center/center-model';

export function CenterPage() {
  const { slug } = useParams();
  const { search } = useLocation();
  const id = parseAuthorId(slug);
  const q = useCenterQueries();
  const { data, isError, error, refetch } = useQuery({ ...q.detail(id ?? 0), enabled: id !== null });
  const { t } = useTranslation('centers');

  if (id === null || data?.kind === 'not-found') return <NotFoundPage />;
  if (data?.kind === 'found') {
    const canonical = authorSlug(data.center);
    if (slug !== canonical) return <Navigate replace to={`/centros/${canonical}${search}`} />;
    return <CenterProfile center={data.center} />;
  }
  return (
    <div className="container-page py-16">
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <div
          aria-busy="true"
          aria-label={t('detail.loading')}
          className="h-64 animate-pulse rounded-3xl bg-surface-container-lowest"
        />
      )}
    </div>
  );
}

function CenterProfile({ center: c }: { center: CenterDetail }) {
  const { t } = useTranslation(['centers', 'common']);
  const lineNames = c.lines.map((l) => l.name);

  useDocumentMetadata({
    title: centerTitle(c),
    description: centerDescription(t, c.name, lineNames),
    path: `/centros/${authorSlug(c)}`,
  });

  return (
    <article className="pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJson(centerJsonLd(c, t, lineNames)) }}
      />
      <CenterBreadcrumb label={c.acronym ?? c.code} />

      <div className="container-page mt-gutter flex flex-col gap-5">
        <CenterHeader center={c} />
        <CenterInstitutional center={c} />
        <CenterLinesAndOds center={c} />
        {/* Resoluciones: sin resoluciones, la sección no se muestra. */}
        <CenterResolutions center={c} />
        <CenterGroups centerId={c.id} />
        <CenterProjects centerName={c.name} />

        <Link
          to="/centros"
          className="inline-flex items-center gap-1 text-label-md font-semibold text-primary hover:underline"
        >
          <Icon name="chevron_left" className="text-[18px]" /> {t('detail.back')}
        </Link>
      </div>
    </article>
  );
}
