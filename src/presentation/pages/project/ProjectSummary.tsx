// Migas, encabezado e información institucional (área, periodo con avance y financiador).
import { withBaseUrl } from '@/shared/base';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { timeProgress, type Project } from '@/domain/projects/project';
import { Icon } from '@/presentation/components/ui/Icon';
import { ProjectStatus } from '../ProjectsPage';
import { projectPeriod } from './project-model';
import { InfoCard, SectionTitle } from './ProjectParts';

export function ProjectBreadcrumb({ code }: { code: string }) {
  const { t } = useTranslation(['projects', 'common', 'groups']);
  return (
    <div className="border-b border-border-subtle bg-surface-container-lowest">
      <nav aria-label={t('common:breadcrumb.label')} className="container-page py-3">
        <ol className="flex flex-wrap items-center gap-1 text-label-md text-neutral-muted">
          <li>
            <Link to="/" className="inline-flex items-center gap-1 hover:text-primary">
              <Icon name="home" className="text-[16px]" /> {t('common:breadcrumb.home')}
            </Link>
          </li>
          <li aria-hidden="true">
            <Icon name="chevron_right" className="text-[16px]" />
          </li>
          <li>
            <Link to="/proyectos" className="hover:text-primary">
              {t('common:nav.items.projects.label')}
            </Link>
          </li>
          <li aria-hidden="true">
            <Icon name="chevron_right" className="text-[16px]" />
          </li>
          <li aria-current="page" className="font-mono font-semibold text-on-surface">
            {code}
          </li>
        </ol>
      </nav>
    </div>
  );
}

/** Encabezado limpio: el código ya va en la ruta y los centros en «Equipo, grupos y centros». */
export function ProjectHero({ project: p }: { project: Project }) {
  const { t } = useTranslation(['projects', 'common', 'groups']);
  return (
    <section className="bg-surface-container-lowest py-8 shadow-sm">
      <div className="container-page flex flex-col gap-6 lg:flex-row lg:items-center">
        {p.photoUrl ? (
          <img
            src={withBaseUrl(p.photoUrl)}
            alt={t('detail.photoAlt', { title: p.title })}
            className="aspect-video w-full shrink-0 rounded-2xl object-cover shadow-sm lg:w-[28rem]"
          />
        ) : null}
        <div className="flex max-w-5xl flex-col gap-3">
          <h1 className="text-headline-lg-mobile leading-snug font-bold tracking-tight text-primary md:text-headline-lg">
            {p.title}
          </h1>
          <p className="flex flex-wrap items-center gap-3 text-body-sm text-on-surface-variant">
            {p.territory ? (
              <span className="flex items-center gap-1.5">
                <Icon name="location_on" className="text-[16px] text-secondary" /> {p.territory}
              </span>
            ) : null}
            <ProjectStatus status={p.status} />
          </p>
        </div>
      </div>
    </section>
  );
}

export function ProjectInstitutional({ project: p }: { project: Project }) {
  const { t } = useTranslation(['projects', 'common', 'groups']);
  const progress = timeProgress(p);
  return (
    <section>
      <SectionTitle>{t('detail.institutional')}</SectionTitle>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <InfoCard icon="menu_book" label={t('detail.area')} value={p.area ?? '—'} />
        <InfoCard icon="calendar_today" label={t('detail.period')} value={projectPeriod(p)}>
          {progress !== null ? (
            <>
              <div className="mb-1.5 flex justify-between text-on-surface-variant">
                <span>{t('detail.progress')}</span>
                <span className="font-semibold text-secondary">{progress}%</span>
              </div>
              <div
                role="progressbar"
                aria-label={t('detail.progress')}
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 w-full overflow-hidden rounded-full bg-surface-cream-alt"
              >
                <div className="h-full rounded-full bg-secondary" style={{ width: `${progress}%` }} />
              </div>
            </>
          ) : null}
        </InfoCard>
        <InfoCard icon="account_balance" label={t('detail.funder')} value={p.funder ?? '—'}>
          {p.resources ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-neutral-muted">{t('detail.resources')}</span>
              <span className="rounded-full bg-badge-sage-bg px-2.5 py-0.5 font-semibold text-badge-sage-text">
                {p.resources}
              </span>
            </div>
          ) : null}
        </InfoCard>
      </div>
    </section>
  );
}
