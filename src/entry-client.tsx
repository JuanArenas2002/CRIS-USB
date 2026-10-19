import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { hydrate, type DehydratedState } from '@tanstack/react-query';
import { AppProviders, AppRoutes, createQueryClient } from '@/app/App';
import { authorQueries } from '@/application/authors/author-queries';
import { groupQueries } from '@/application/groups/group-queries';
import { httpGroupRepository } from '@/infrastructure/groups/http-group-repository';
import { httpAuthorRepository } from '@/infrastructure/authors/http-author-repository';
import { createApiClient } from '@/infrastructure/http/api-client';
import './styles/index.css';

declare global {
  interface Window {
    __CRIS__?: { path: string; queries: DehydratedState };
  }
}

// Navegador: rutas relativas `/api/...` → proxy same-origin que añade la llave (nunca llega aquí).
const api = createApiClient({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? '' });
const queries = authorQueries(httpAuthorRepository(api));
const groups = groupQueries(httpGroupRepository(api));
const queryClient = createQueryClient();
const root = document.getElementById('root')!;

// Solo se hidrata si el HTML prerenderizado corresponde exactamente a esta URL (404.html sirve a otras).
const prerendered = window.__CRIS__;
const matches = prerendered?.path === location.pathname && !location.search;
if (prerendered && matches) {
  hydrate(queryClient, prerendered.queries);
  // El HTML se generó en el build: se pinta tal cual y luego se refresca en segundo plano, para que
  // lo cambiado después (fotos, ODS, datos de Metri-K) aparezca sin volver a desplegar.
  void queryClient.invalidateQueries();
}

const app = (
  <StrictMode>
    <AppProviders queryClient={queryClient} queries={queries} groups={groups}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProviders>
  </StrictMode>
);

if (matches) hydrateRoot(root, app);
else {
  root.textContent = '';
  createRoot(root).render(app);
}
