import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { newsAuth } from '@/infrastructure/news/news-auth';

const SESSION = ['news-session'] as const;

/** Sesión del panel de noticias. El backend decide todo; esto solo refleja su estado. */
export function useNewsSession() {
  const qc = useQueryClient();
  const user = useQuery({ queryKey: SESSION, queryFn: newsAuth.me, retry: false, staleTime: 0 });
  const permissions = useQuery({
    queryKey: [...SESSION, 'permissions', user.data?.id],
    queryFn: newsAuth.permissions,
    enabled: !!user.data && !user.data.must_change_password, // con clave temporal el backend responde 403
    retry: false,
  });
  const providers = useQuery({
    queryKey: [...SESSION, 'providers'],
    queryFn: newsAuth.providers,
    retry: false,
  });

  const login = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => newsAuth.login(email, password),
    onSuccess: (u) => qc.setQueryData(SESSION, u),
  });
  const logout = useMutation({
    mutationFn: newsAuth.logout,
    onSettled: (federatedUrl) => {
      qc.setQueryData(SESSION, null);
      qc.removeQueries({ queryKey: [...SESSION, 'permissions'] });
      if (federatedUrl) window.location.assign(federatedUrl); // cierra también la sesión de Microsoft
    },
  });

  return { user, permissions, providers, login, logout };
}
