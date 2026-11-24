// Lo que se cruza con el centro: sus grupos de investigación y sus proyectos.
import { useTranslation } from 'react-i18next';
import { sortGroups } from '@/domain/groups/group';
import { projectsOfCenter } from '@/domain/projects/project';
import { GroupRow, GroupRowHeader } from '@/presentation/components/groups/GroupRow';
import { ErrorState } from '@/presentation/components/feedback/Feedback';
import { SectionHead } from '@/presentation/components/ui/InfoBlocks';
import { useGroups } from '@/presentation/hooks/use-groups';
import { useProjects } from '@/presentation/hooks/use-projects';
import { ProjectList } from '../ProjectsPage';
import { card } from './styles';

const skeleton = 'h-40 animate-pulse rounded-2xl bg-surface-cream-alt motion-reduce:animate-none';

/** Grupos de investigación del centro: cruce `group.centerIds` (Metri-K) con el id del centro. */
export function CenterGroups({ centerId }: { centerId: number }) {
  const { t } = useTranslation('centers');
  const { data, isError, refetch, error } = useGroups();
  const groups = data ? sortGroups(data.filter((g) => g.centerIds?.includes(centerId))) : null;
  return (
    <section aria-labelledby="center-groups-title" className={`${card} p-5 md:p-6`}>
      <SectionHead icon="hub" id="center-groups-title">
        {t('detail.groups')}
      </SectionHead>
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !groups ? (
        <div aria-busy="true" aria-label={t('detail.groupsLoading')} className={skeleton} />
      ) : groups.length ? (
        <div className="overflow-hidden rounded-2xl ring-1 ring-border-subtle">
          <GroupRowHeader />
          <ul className="divide-y divide-border-subtle">
            {groups.map((g) => (
              <GroupRow key={g.id} group={g} />
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-body-sm text-neutral-muted">{t('detail.noGroups')}</p>
      )}
    </section>
  );
}

/** Proyectos del centro: Metri-K los vincula por el nombre del centro (`projectsOfCenter`). */
export function CenterProjects({ centerName }: { centerName: string }) {
  const { t } = useTranslation('centers');
  const { data, isError, refetch, error } = useProjects();
  const projects = data ? projectsOfCenter(data, centerName) : null;
  return (
    <section aria-labelledby="center-projects-title" className={`${card} p-5 md:p-6`}>
      <SectionHead icon="science" id="center-projects-title">
        {t('detail.projects')}
      </SectionHead>
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !projects ? (
        <div aria-busy="true" aria-label={t('detail.projectsLoading')} className={skeleton} />
      ) : projects.length ? (
        <ProjectList projects={projects} />
      ) : (
        <p className="text-body-sm text-neutral-muted">{t('detail.noProjects')}</p>
      )}
    </section>
  );
}
