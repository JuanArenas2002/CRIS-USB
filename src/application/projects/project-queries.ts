import { queryOptions } from '@tanstack/react-query';
import { sortProjects, type Project, type ProjectRepository } from '@/domain/projects/project';

export type PublicProjectDetail = { kind: 'found'; project: Project } | { kind: 'not-found' };

/** Metri-K ya entrega solo los proyectos seleccionados para divulgación: todos se publican. */
export function projectQueries(repo: ProjectRepository) {
  return {
    list: () =>
      queryOptions({
        queryKey: ['projects', 'list'],
        queryFn: async ({ signal }) => sortProjects(await repo.list(signal)),
      }),
    detail: (id: number) =>
      queryOptions({
        queryKey: ['projects', 'detail', id],
        queryFn: async ({ signal }): Promise<PublicProjectDetail> => {
          const project = await repo.getById(id, signal);
          return project ? { kind: 'found', project } : { kind: 'not-found' };
        },
      }),
  };
}

export type ProjectQueries = ReturnType<typeof projectQueries>;
