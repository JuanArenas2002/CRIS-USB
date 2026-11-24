import { withBaseUrl } from '@/shared/base';
import { useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { parseAuthorId } from '@/domain/authors/author';
import { projectProducts, projectSlug, type Project } from '@/domain/projects/project';
import { EMPTY_FILTERS, ProductsTable } from '@/presentation/components/authors/ProductsTable';
import { ErrorState } from '@/presentation/components/feedback/Feedback';
import { Carousel } from '@/presentation/components/ui/Carousel';
import { Icon } from '@/presentation/components/ui/Icon';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
import { useProjectQueries } from '@/presentation/hooks/use-projects';
import { safeJson } from '@/shared/seo';
import { NotFoundPage } from './NotFoundPage';
import { projectPath } from './ProjectsPage';
import { ProjectFramework } from './project/ProjectFramework';
import { SectionTitle } from './project/ProjectParts';
import { ProjectBreadcrumb, ProjectHero, ProjectInstitutional } from './project/ProjectSummary';
import { ProjectTeam } from './project/ProjectTeam';
import { projectDescription, projectJsonLd } from './project/project-model';

export function ProjectPage() {
  const { slug } = useParams();
  const { search } = useLocation();
  const id = parseAuthorId(slug);
  const q = useProjectQueries();
  const { data, isError, error, refetch } = useQuery({ ...q.detail(id ?? 0), enabled: id !== null });
  const { t } = useTranslation('projects');

  if (id === null || data?.kind === 'not-found') return <NotFoundPage />;
  if (data?.kind === 'found') {
    const canonical = projectSlug(data.project);
    if (slug !== canonical) return <Navigate replace to={`/proyectos/${canonical}${search}`} />;
    return <ProjectProfile project={data.project} />;
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

function ProjectProfile({ project: p }: { project: Project }) {
  const { t } = useTranslation(['projects', 'common', 'groups']);
  const path = projectPath(p);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  useDocumentMetadata({ title: p.title, description: projectDescription(t, p.objective), path });

  return (
    <article className="pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJson(projectJsonLd(p, path, t)) }}
      />
      <ProjectBreadcrumb code={p.code} />
      <ProjectHero project={p} />

      <div className="container-page mt-8 flex flex-col gap-12">
        <ProjectInstitutional project={p} />
        {/* Marco y objetivos, con los ODS en una columna a la derecha */}
        <ProjectFramework project={p} />

        {/* Fotos asociadas (/admin/proyectos/fotos) */}
        {p.gallery.length ? (
          <section>
            <SectionTitle>{t('detail.gallery')}</SectionTitle>
            <Carousel
              label={t('detail.gallery')}
              images={p.gallery.map((g, i) => ({
                src: withBaseUrl(g.url),
                alt: t('detail.galleryAlt', { n: i + 1, title: p.title }),
              }))}
            />
          </section>
        ) : null}

        <ProjectTeam project={p} />

        {/* Productos: misma tabla que en el perfil del investigador */}
        <section>
          <SectionTitle lead={t('detail.productsLead', { count: p.products.length, code: p.code })}>
            {t('detail.products')}
          </SectionTitle>
          {p.products.length ? (
            <ProductsTable products={projectProducts(p)} filters={filters} onFiltersChange={setFilters} />
          ) : (
            <p className="text-body-sm text-neutral-muted">{t('detail.noProducts')}</p>
          )}
        </section>

        <Link
          to="/proyectos"
          className="inline-flex items-center gap-1 text-label-md font-semibold text-primary hover:underline"
        >
          <Icon name="chevron_left" className="text-[18px]" /> {t('detail.back')}
        </Link>
      </div>
    </article>
  );
}
