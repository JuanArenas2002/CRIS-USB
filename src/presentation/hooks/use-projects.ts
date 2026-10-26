import { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ProjectQueries } from '@/application/projects/project-queries';

export const ProjectQueriesContext = createContext<ProjectQueries | null>(null);

export function useProjectQueries() {
  const q = useContext(ProjectQueriesContext);
  if (!q) throw new Error('ProjectQueriesContext no está provisto');
  return q;
}

export const useProjects = () => useQuery(useProjectQueries().list());
