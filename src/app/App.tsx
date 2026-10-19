import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AuthorQueries } from '@/application/authors/author-queries';
import type { GroupQueries } from '@/application/groups/group-queries';
import { ApiError } from '@/infrastructure/http/api-client';
import { RootLayout } from '@/presentation/components/layout/RootLayout';
import { AuthorQueriesContext } from '@/presentation/hooks/use-authors';
import { GroupQueriesContext } from '@/presentation/hooks/use-groups';
import { GroupsPage } from '@/presentation/pages/GroupsPage';
import { GroupPage } from '@/presentation/pages/GroupPage';
import { AdminOdsPage } from '@/presentation/pages/AdminOdsPage';
import { AdminPhotosPage } from '@/presentation/pages/AdminPhotosPage';
import { HeadCollectorContext } from '@/presentation/hooks/use-document-metadata';
import { AuthorPage } from '@/presentation/pages/AuthorPage';
import { DirectoryPage } from '@/presentation/pages/DirectoryPage';
import { NotFoundPage } from '@/presentation/pages/NotFoundPage';
import { ComingSoonPage } from '@/presentation/pages/ComingSoonPage';
import { NAV_ITEMS } from '@/shared/navigation';
import type { PageMeta } from '@/shared/seo';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Datos frescos al volver a la pestaña (p. ej. tras subir una foto en el backend).
        staleTime: 30 * 1000,
        // 4xx no se arregla reintentando; red/5xx sí, hasta 2 veces.
        retry: (count, err) =>
          !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
      },
    },
  });
}

interface ProvidersProps {
  queryClient: QueryClient;
  queries: AuthorQueries;
  groups: GroupQueries;
  /** Solo en prerender: recibe los metadatos de la página renderizada. */
  onHead?: (meta: PageMeta) => void;
  children: ReactNode;
}

export function AppProviders({ queryClient, queries, groups, onHead, children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthorQueriesContext.Provider value={queries}>
        <GroupQueriesContext.Provider value={groups}>
          <HeadCollectorContext.Provider value={onHead ?? null}>{children}</HeadCollectorContext.Provider>
        </GroupQueriesContext.Provider>
      </AuthorQueriesContext.Provider>
    </QueryClientProvider>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Con llaves: en Chrome reciente scrollTo devuelve una Promise y React la tomaría como cleanup.
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<RootLayout />}>
          <Route index element={<DirectoryPage />} />
          <Route path="investigadores" element={<Navigate replace to="/" />} />
          <Route path="investigadores/:slug" element={<AuthorPage />} />
          <Route path="grupos" element={<GroupsPage />} />
          <Route path="grupos/:slug" element={<GroupPage />} />
          {/* Vista oculta: fuera del menú, noindex y bloqueada en robots.txt. */}
          <Route path="admin/fotos" element={<AdminPhotosPage />} />
          <Route path="admin/ods" element={<AdminOdsPage />} />
          {NAV_ITEMS.filter((i) => !i.ready).map((i) => (
            <Route key={i.to} path={i.to} element={<ComingSoonPage item={i} />} />
          ))}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}
