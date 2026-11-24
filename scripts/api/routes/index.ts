// Tabla centralizada de rutas del BFF. El orden se conserva del handler original: en las públicas, imágenes
// primero y `/api/orcid/search` antes que `/api/orcid/{orcid}`.
import type { Route } from '../router.ts';
import { adminSessionRoute } from './admin-session.ts';
import { centerAdminRoutes, centerPublicRoutes } from './centers.ts';
import { groupRoutes } from './groups.ts';
import { imageAdminRoutes, imagePublicRoutes } from './images.ts';
import { investigatorRoutes } from './investigators.ts';
import { orcidRoutes } from './orcid.ts';
import { projectAdminRoutes, projectPublicRoutes } from './projects.ts';
import { publicationAdminRoutes, publicationPublicRoutes } from './publications.ts';
import { rankingAdminRoutes } from './ranking.ts';
import { relationRoutes } from './relations.ts';

/** /api/admin/session: ella misma decide por método (GET comprueba, POST inicia, DELETE cierra). */
export const SESSION_ROUTE: Route = adminSessionRoute;

/**
 * Escrituras (PUT/PATCH/DELETE) y lecturas de admin (GET): exigen token (cookie de sesión o X-Admin-Token).
 * Las rutas de proyecto piden además la contraseña del centro (center-access.ts).
 */
export const ADMIN_ROUTES: readonly Route[] = [
  ...imageAdminRoutes,
  ...centerAdminRoutes,
  ...projectAdminRoutes,
  ...rankingAdminRoutes,
  ...publicationAdminRoutes,
];

/** GET/HEAD sin credenciales. */
export const PUBLIC_ROUTES: readonly Route[] = [
  ...imagePublicRoutes,
  ...orcidRoutes,
  ...investigatorRoutes,
  ...publicationPublicRoutes,
  ...groupRoutes,
  ...relationRoutes,
  ...projectPublicRoutes,
  ...centerPublicRoutes,
];
