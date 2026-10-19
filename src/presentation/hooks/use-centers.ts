import { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CenterQueries } from '@/application/centers/center-queries';

export const CenterQueriesContext = createContext<CenterQueries | null>(null);

export function useCenterQueries() {
  const q = useContext(CenterQueriesContext);
  if (!q) throw new Error('CenterQueriesContext no está provisto');
  return q;
}

export const useCenters = () => useQuery(useCenterQueries().list());
