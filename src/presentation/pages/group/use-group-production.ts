import { useMemo } from 'react';
import type { GroupMember } from '@/domain/groups/group';
import { useAuthorProfiles } from '@/presentation/hooks/use-authors';
import { mergeGroupProducts } from './group-model';

/**
 * Producción del grupo. Metri-K no la expone por grupo: se une la de los integrantes con perfil publicado
 * (se piden sus perfiles) y `productionReady` indica que ya llegaron todos.
 */
export function useGroupProduction(members: { data: GroupMember[] | undefined; isSuccess: boolean }) {
  const published = (members.data ?? []).filter((m) => m.profilePublished);
  const profiles = useAuthorProfiles(published.map((m) => m.id));
  const productionReady = members.isSuccess && profiles.isSuccess;
  const products = useMemo(() => mergeGroupProducts(profiles.data), [profiles.data]);
  return { published, profiles, productionReady, products };
}
