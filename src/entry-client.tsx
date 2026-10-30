import { BASE, withBase } from '@/shared/base';
import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { hydrate, type DehydratedState } from '@tanstack/react-query';
import { AppProviders, AppRoutes, createQueryClient } from '@/app/App';
import { authorQueries } from '@/application/authors/author-queries';
import { centerQueries } from '@/application/centers/center-queries';
import { groupQueries } from '@/application/groups/group-queries';
import { publicationQueries } from '@/application/publications/publication-queries';
import { projectQueries } from '@/application/projects/project-queries';
import { relationQueries } from '@/application/relations/relation-queries';
import { httpRelationsRepository } from '@/infrastructure/relations/http-relations-repository';
import { httpCenterRepository } from '@/infrastructure/centers/http-center-repository';
import { httpGroupRepository } from '@/infrastructure/groups/http-group-repository';
import { httpAuthorRepository } from '@/infrastructure/authors/http-author-repository';
import { httpPublicationRepository } from '@/infrastructure/publications/http-publication-repository';
import { httpProjectRepository } from '@/infrastructure/projects/http-project-repository';
import { createApiClient } from '@/infrastructure/http/api-client';
import i18n, { DEFAULT_LANGUAGE } from '@/i18n';
import './styles/index.css';

declare global {
  interface Window {
    __CRIS__?: { path: string; queries: DehydratedState };
  }
}

// Navegador: rutas relativas `/api/...` → proxy same-origin que añade la llave (nunca llega aquí).
// Vacía = la API del mismo portal (con su subruta, si la hay).
const api = createApiClient({ baseUrl: import.meta.env.VITE_API_BASE_URL || BASE });
const queries = authorQueries(httpAuthorRepository(api));
const groups = groupQueries(httpGroupRepository(api));
const centers = centerQueries(httpCenterRepository(api));
const publications = publicationQueries(httpPublicationRepository(api));
const projects = projectQueries(httpProjectRepository(api));
const relations = relationQueries(httpRelationsRepository(api));
const queryClient = createQueryClient();
const root = document.getElementById('root')!;

// Solo se hidrata si el HTML prerenderizado corresponde exactamente a esta URL (404.html sirve a otras).
const prerendered = window.__CRIS__;
const matches = !!prerendered && withBase(prerendered.path) === location.pathname && !location.search;
if (prerendered && matches) {
  hydrate(queryClient, prerendered.queries);
  // El HTML se generó en el build: se pinta tal cual y luego se refresca en segundo plano, para que
  // lo cambiado después (fotos, ODS, datos de Metri-K) aparezca sin volver a desplegar.
  void queryClient.invalidateQueries();
}

const app = (
  <StrictMode>
    <AppProviders
      queryClient={queryClient}
      queries={queries}
      groups={groups}
      centers={centers}
      publications={publications}
      projects={projects}
      relations={relations}
    >
      <BrowserRouter basename={BASE || undefined}>
        <AppRoutes />
      </BrowserRouter>
    </AppProviders>
  </StrictMode>
);

// El HTML prerenderizado está en español: con otro idioma se pinta de nuevo (datos ya en caché, sin parpadeo de red).
if (matches && i18n.resolvedLanguage === DEFAULT_LANGUAGE) hydrateRoot(root, app);
else {
  root.textContent = '';
  createRoot(root).render(app);
}
