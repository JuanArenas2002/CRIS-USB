import { useQuery } from '@tanstack/react-query';
import { normalizeOrcid } from '@/domain/orcid/orcid';
import { orcidClient } from '@/infrastructure/orcid/orcid-client';

/** Perfil público de un ORCID (solo si el iD es válido). El BFF lo cachea; aquí también 30 min. */
export function useOrcidProfile(raw: string | null | undefined) {
  const orcid = normalizeOrcid(raw);
  return useQuery({
    queryKey: ['orcid', orcid],
    queryFn: ({ signal }) => orcidClient.profile(orcid!, signal),
    enabled: !!orcid,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
}
