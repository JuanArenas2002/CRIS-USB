import { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { GroupQueries } from '@/application/groups/group-queries';

export const GroupQueriesContext = createContext<GroupQueries | null>(null);

export function useGroups() {
  const q = useContext(GroupQueriesContext);
  if (!q) throw new Error('GroupQueriesContext no está provisto');
  return useQuery(q.list());
}
