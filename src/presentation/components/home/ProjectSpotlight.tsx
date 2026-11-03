import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { isRunning, projectTitle, sortProjects } from '@/domain/projects/project';
import { Icon } from '@/presentation/components/ui/Icon';
import { useProjects } from '@/presentation/hooks/use-projects';
import { projectPath } from '@/presentation/pages/ProjectsPage';

const SHOWN = 4;
const arrow =
  'flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant ring-1 ring-outline-variant transition-colors hover:bg-badge-sage-bg hover:text-primary-container';

/** Tarjeta del hero: proyectos en ejecución, los más recientes primero. Sin proyectos no se muestra. */
export function ProjectSpotlight() {
  const { t } = useTranslation('home');
  const { data } = useProjects();
  const [index, setIndex] = useState(0);
  const projects = sortProjects(data ?? [])
    .filter(isRunning)
    .slice(0, SHOWN);
  const project = projects[index];
  if (!project) return null;
  const move = (step: number) => setIndex((index + step + projects.length) % projects.length);

  return (
    <aside
      aria-label={t('spotlight.label')}
      className="w-full max-w-md rounded-2xl border border-surface-container bg-surface-container-lowest/95 p-6 shadow-2xl backdrop-blur-md sm:p-7"
    >
      <p className="mb-4 flex items-center gap-2">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-secondary motion-reduce:animate-none" />
        <span className="rounded-full bg-badge-sage-bg px-2.5 py-0.5 text-label-sm font-bold tracking-wider text-badge-sage-text uppercase">
          {t('spotlight.label')}
        </span>
      </p>
      <div aria-live="polite" className="min-h-[170px] space-y-3">
        <h2 className="line-clamp-3 text-headline-sm font-bold text-on-surface">
          {projectTitle(project.title)}
        </h2>
        <p className="line-clamp-4 text-body-sm text-on-surface-variant">
          {project.objective ?? project.problem ?? project.solution}
        </p>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-surface-container pt-4">
        <Link
          to={projectPath(project)}
          aria-label={`${t('spotlight.read')}: ${projectTitle(project.title)}`}
          className="inline-flex min-h-11 items-center gap-1.5 text-body-sm font-semibold text-primary-container hover:underline"
        >
          {t('spotlight.read')} <Icon name="arrow_forward" className="text-[18px]" />
        </Link>
        {projects.length > 1 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={t('spotlight.previous')}
              onClick={() => move(-1)}
              className={arrow}
            >
              <Icon name="chevron_left" className="text-[20px]" />
            </button>
            <span className="text-label-md font-semibold text-neutral-muted tabular-nums">
              {index + 1} / {projects.length}
            </span>
            <button type="button" aria-label={t('spotlight.next')} onClick={() => move(1)} className={arrow}>
              <Icon name="chevron_right" className="text-[20px]" />
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
