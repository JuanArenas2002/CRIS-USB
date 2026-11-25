# Arquitectura

## Capas

```text
src/
  domain/authors/          Investigador, categorías Minciencias, consulta (filtrar/ordenar/paginar), puerto
  domain/groups/           Grupo, líneas, historial de categorías, puerto
  application/             Casos de uso como queries de TanStack Query + reglas de publicación
  infrastructure/          Cliente HTTP (timeout, cancelación, errores) y adaptadores del BFF (Zod)
  presentation/            Páginas, componentes y hooks (sin fetch directo)
  shared/                  SEO, navegación, contacto
  app/App.tsx              Rutas, QueryClient, inyección de dependencias (contextos)
  entry-client.tsx         Navegador: hidrata el HTML prerenderizado
  entry-server.tsx         Node: renderiza rutas para el prerender
scripts/
  groups-source.ts         Metri-K → grupos públicos (+ líneas e historial)
  investigators-source.ts  Metri-K → investigadores públicos (+ sus grupos)
  projects-source.ts       Metri-K → proyectos seleccionados (sin la cédula de los líderes)
  public-api.ts            Fachada del BFF: `createPublicApi(opciones)` (dev, preview y producción)
  api/                     Implementación del BFF (ver «Estructura del BFF»)
  prerender.mjs            SSG: páginas, 404, sitemap.xml, robots.txt, llms.txt
```

Las dependencias apuntan hacia el dominio. El dominio no importa React ni infraestructura; sus funciones puras (`queryAuthors`, `authorStats`, `filterGroups`…) las usan por igual el BFF, el prerender y los tests.

## Organización de las páginas

Las páginas grandes se componen de piezas con una sola responsabilidad. Cada página conserva su archivo (`XPage.tsx`: carga, redirección al slug canónico, metadatos y composición) y su carpeta hermana con el resto:

```text
src/presentation/pages/
  AuthorPage.tsx   ->  author/    ProfileHero, ProfileAside, ProfileIndicators, profile-model.ts
  GroupPage.tsx    ->  group/     GroupHeader, GroupOverview, GroupMembers, ResearchLines,
                                  use-group-production.ts, group-model.ts
  CenterPage.tsx   ->  center/    CenterHeader, CenterInstitutional, CenterLinesAndOds,
                                  CenterResolutions, CenterRelated, center-model.ts
  ProjectPage.tsx  ->  project/   ProjectSummary, ProjectFramework, ProjectTeam, ProjectParts,
                                  project-model.ts
  ProductsPage.tsx ->  products/  ProductsHero, ProductsFilters, ProductsChart, ProductsList,
                                  products-model.ts
  news-admin/AnalyticsView.tsx  ->  news-admin/analytics/   Toolbar, Summary, KpiStrip, Trend,
                                  Breakdowns, Performance, ReportNotes y sus modelos puros
  news-admin/NewsEditorView.tsx ->  news-admin/editor/      NextStepCard, next-step-model.ts
```

Reglas que siguen estas carpetas:

- **Lo que se calcula va en un `*-model.ts` sin React**: orden y filtrado, agregaciones, geometría de gráficas, JSON-LD, descripciones SEO, etiquetas. Son funciones puras y tienen pruebas unitarias directas (`*-model.test.ts`).
- **Un hook solo cuando hay estado o consultas relacionadas** (`useGroupProduction`, `useStatsFilter`); un cálculo sin estado es una función, no un hook.
- **Cada sección de la página es un componente** que recibe lo que muestra por propiedades; el marcado y las clases de Tailwind no cambian al refactorizar.
- Las consultas que antes se lanzaban desde el componente grande se siguen lanzando siempre (por ejemplo, los catálogos del filtro de estadísticas se piden aunque el panel esté plegado): extraer un componente no cambia cuándo se consulta.
- `src/shared/years.ts` (`yearsSince`) es el único cálculo de antigüedad (grupos y centros).

**Cómo agregar un componente o una sección a una página.**

1. Si hay que calcular algo (filtrar, ordenar, formatear, armar JSON-LD), escribirlo como función en el `*-model.ts` de la página y probarlo en `*-model.test.ts`.
2. La sección es un componente de la carpeta de la página que recibe lo que muestra por propiedades; no hace `fetch` directo (las consultas van en hooks de `presentation/hooks`).
3. La página (`XPage.tsx`) solo compone: carga, redirección al slug canónico, `useDocumentMetadata` y el orden de las secciones.
4. No cambiar clases de Tailwind al mover marcado: el CSS de producción debe seguir con el mismo hash.

## Decisiones

**BFF obligatorio.** Metri-K expone sin autenticación y con `Access-Control-Allow-Origin: *` cédulas, correos, teléfonos, género, etnia y **hashes de contraseña** (`/api/investigator`, `/api/group`, `/api/group/investigator/{id}`). El navegador nunca llama a Metri-K: el BFF proyecta a una lista blanca de campos públicos (`toPublicInvestigator`, `toPublicGroup`) y los tests verifican que ningún dato personal pase. **Esto no corrige la exposición en Metri-K**, que debe cerrarse en origen.

**Búsqueda y paginación en el BFF.** Metri-K devuelve listas completas sin filtros. El BFF guarda en memoria (10 min, con respaldo si Metri-K falla) ~600 investigadores y ~50 grupos, y resuelve búsqueda sin tildes, filtros, orden y paginación.

**Política de publicación.**

- Investigadores: solo los activos en GrupLAC (`state_gruplac`).
- Grupos: solo activos (`state`).
- Un perfil sin identificadores externos se publica, pero con `noindex` y fuera del sitemap.

**SSG.** HTML estático con contenido real para el directorio, cada investigador y cada grupo. El costo es reconstruir periódicamente.

**Portada.** `/` presenta las seis áreas con las mismas consultas (y caché) de cada módulo, por lo que sus cifras coinciden con lo publicado; `/investigadores` es el directorio y `/` reenvía allí los enlaces antiguos con filtros (`?q=`, `?vista=`…).

**URLs** `/investigadores/{id}-{slug}` y `/grupos/{id}-{slug}`. El id resuelve el recurso; un slug distinto redirige al canónico.

## Estructura del BFF

`scripts/public-api.ts` solo ensambla: `createApiHandler(createApiContext(opciones))`. Conserva la firma pública y los `export` (`createPublicApi`, `DEFAULT_METRIK_URL`, `DEFAULT_COLLAB_URL`, `DEFAULT_PHOTOS_DIR`) que usan `server.ts`, `vercel-api.ts`, `prerender.mjs` y `vite.config.ts`. Todo lo demás vive en `scripts/api/`:

```text
scripts/api/
  context.ts        Contexto compartido (`ctx`): configuración, almacenes y accesores de datos con caché
  router.ts         Despacho de la petición y orden de validación
  routes/
    index.ts        Tabla de rutas: SESSION_ROUTE, ADMIN_ROUTES y PUBLIC_ROUTES (el orden importa)
    admin-session.ts  /api/admin/session (GET comprueba, POST inicia, DELETE cierra)
    images.ts       Fotos de investigadores, logos de centros y fotos de proyectos (GET público; escritura con token)
    center-access.ts  Contraseña de centro: `centerOk` y `projectAccess`
    centers.ts      Centros: listado, ficha, PDF de resoluciones, acceso, contraseña y página oficial
    projects.ts     Proyectos: listado, ficha y equipo (`personal`) en Metri-K
    ranking.ts      Ranking Unisimón (general, Top 12 / Top 60) y visibilidad
    publications.ts Ranking de publicaciones: consulta pública y carga del Excel
    investigators.ts, groups.ts, relations.ts, orcid.ts   Lecturas públicas
  http.ts           `createSend` (JSON, caché, gzip), `readBody`, `readField`, `jsonField`, `saveOr500`, `pageParams`
  admin-auth.ts     Cookie de sesión firmada, comparación en tiempo constante, `hasAdminCredentials`
  cache.ts          `cached` (10 min, con respaldo si la fuente falla) y `cachedByKey`
```

**Contexto compartido.** `createApiContext` se crea una vez por instancia del BFF y reúne lo que antes era el cierre de un único handler: las URLs, el token de administración, los almacenes (disco o Vercel Blob, según `stores.ts`) y los accesores de datos (`investigators()`, `groups()`, `centers()`, `projects()`, `publications()`…), cada uno con su caché. Los handlers lo reciben como `rc.ctx`; no hay estado global.

**Sistema de rutas.** Cada ruta es `{ match: RegExp, methods?, handler }`. `router.ts` despacha en este orden:

1. Fuera de `/api/` → `next()` (404 si no hay siguiente middleware).
2. `/api/admin/session`.
3. Escrituras (`PUT`/`PATCH`/`DELETE`) y lecturas de admin (`GET` en `ADMIN_ROUTES`): método sin ruta → **405**; sin `CRIS_ADMIN_TOKEN` → **503**; sin cookie de sesión ni `X-Admin-Token` válidos → **401**; después, el handler.
4. Cualquier otro método que no sea `GET`/`HEAD` → **405**.
5. `PUBLIC_ROUTES`; sin coincidencia → **404**.

Una excepción que ningún handler atrapa responde **502** «Servicio de datos no disponible». Los handlers sí atrapan los errores propios de su operación y responden con su código y mensaje (p. ej. 500 «No se pudo guardar el ranking: …», 502 privado con el motivo de Metri-K en el equipo de proyectos): centralizar el mecanismo (`saveOr500`) no unifica su semántica.

**Cuerpos de petición.** Cada escritura lee el cuerpo con un tope (1 KB, 1 MB o 16 MB según la ruta). Un cuerpo que lo excede llega como `null`; las rutas donde `null` significaría «quitar» (contraseña y página oficial de un centro) responden **413** sin escribir nada y distinguen con `jsonField` entre cuerpo inválido, campo ausente y `null` explícito.

**Cómo agregar un endpoint.** Crear el handler en el módulo del recurso (o uno nuevo en `routes/`), exportarlo en la lista del recurso y añadirlo a `PUBLIC_ROUTES` o `ADMIN_ROUTES` en `routes/index.ts`. Un endpoint de admin hereda las compuertas 405/503/401 sin repetirlas.

**Prueba de caracterización.** `scripts/public-api.characterization.test.ts` compara con `scripts/__golden__/public-api.golden.json` el estado, los encabezados y el cuerpo exacto de más de 300 peticiones (incluidos los errores, sin token, con Metri-K caído y con almacenes que no guardan). Cualquier diferencia es un cambio de contrato: si es deliberado, regenerar con `UPDATE_GOLDEN=1` y revisar el diff del JSON.

## Contrato del BFF

| Ruta                                                          | Respuesta                                                                                                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/investigators?q&cat&group&page&size`                | `{ items: Author[], total, page, pages }` (máx. 100 por página)                                                                                         |
| `GET /api/investigators/stats`                                | `{ total, byCategory }`                                                                                                                                 |
| `GET /api/investigators/{id}`                                 | `AuthorProfile` (con `groups`) o 404                                                                                                                    |
| `GET /api/groups`                                             | `Group[]` (líneas solo con nombre)                                                                                                                      |
| `GET /api/groups/{id}`                                        | `GroupDetail` (líneas completas + historial) o 404                                                                                                      |
| `GET /api/publications?q&from&to&type&area&oa&sort&page&size` | `{ items: (RankedPublication & { position })[], total, page, pages }`: `rank` es el puesto general; `position`, el puesto recalculado dentro del filtro |
| `GET /api/projects`                                           | `Project[]` (todos los seleccionados en Metri-K, completos)                                                                                             |
| `GET /api/projects/{id}`                                      | `Project` o 404                                                                                                                                         |
| `GET /api/publications/stats`                                 | `{ total, openAccess, international, citations, years, types, areas }`                                                                                  |

### Rutas públicas (GET/HEAD, sin credenciales)

La tabla anterior resume las principales; el resto, por módulo de `scripts/api/routes/`:

| Módulo             | Rutas                                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `investigators.ts` | `/api/investigators`, `/stats`, `/featured`, `/{id}`                                                                                    |
| `publications.ts`  | `/api/publications`, `/stats`                                                                                                           |
| `groups.ts`        | `/api/groups`, `/staffing`, `/trajectory`, `/{id}`, `/{id}/members`                                                                     |
| `centers.ts`       | `/api/centers`, `/{id}`, `/{id}/resolutions/{resId}` (PDF)                                                                              |
| `projects.ts`      | `/api/projects`, `/{id}`                                                                                                                |
| `relations.ts`     | `/api/relations/by-year`, `/countries`, `/countries/{ISO3}/publications` (`?year=` validado: 400 «Año inválido»)                        |
| `orcid.ts`         | `/api/orcid/search?q=` (mín. 3 letras), `/api/orcid/{iD}` (400 si no es válido)                                                         |
| `images.ts`        | `GET /api/investigators/{id}/photo`, `/api/centers/{id}/logo`, `/api/projects/{id}/photos/{slot}` (WebP; con `?v=` la URL es inmutable) |

### Rutas de administración (token de administración)

Aceptan cookie de sesión (`/api/admin/session`) o la cabecera `X-Admin-Token`. Las marcadas con «centro» exigen además `X-Center-Id` y `X-Center-Password` (la contraseña del director) y que el proyecto sea de ese centro.

| Módulo             | Ruta                                                      | Método              | Efecto                                                                           |
| ------------------ | --------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------- |
| `admin-session.ts` | `/api/admin/session`                                      | GET / POST / DELETE | Comprobar, iniciar (valida el token una vez y fija la cookie) o cerrar la sesión |
| `images.ts`        | `/api/investigators/{id}/photo`, `/api/centers/{id}/logo` | PUT·PATCH / DELETE  | Guardar (WebP ≤ 1 MB) o quitar                                                   |
| `images.ts`        | `/api/projects/{id}/photos/{slot}`                        | PUT·PATCH / DELETE  | Igual, con «centro»                                                              |
| `centers.ts`       | `/api/centers/{id}/website`                               | PUT                 | Página oficial (URL http/s, `null` o `""` la quita)                              |
| `centers.ts`       | `/api/centers/{id}/password`                              | PUT                 | Contraseña del centro (mín. 8; `null` la quita)                                  |
| `centers.ts`       | `/api/centers/{id}/access`                                | GET                 | Comprobar la contraseña del centro                                               |
| `projects.ts`      | `/api/projects/{id}/personal`                             | GET / PATCH         | Listar (con cédulas) o agregar integrante en Metri-K; «centro»                   |
| `projects.ts`      | `/api/projects/{id}/personal/{cédula}`                    | DELETE              | Quitar integrante; «centro»                                                      |
| `ranking.ts`       | `/api/ranking`                                            | GET                 | Lista del ranking para el admin (incluye ocultos)                                |
| `ranking.ts`       | `/api/ranking`, `/top12`, `/top60`                        | PUT·PATCH / DELETE  | Cargar el Excel del ranking (general o por apartado) o vaciarlo                  |
| `ranking.ts`       | `/api/ranking/visibility`, `/api/ranking/{id}`            | PUT                 | Mostrar u ocultar a varios o a uno                                               |
| `publications.ts`  | `/api/publications`                                       | PUT·PATCH / DELETE  | Cargar el ranking de publicaciones o vaciarlo                                    |

### Autenticación, cachés y errores

- **Autenticación.** El token (`CRIS_ADMIN_TOKEN`) se compara en tiempo constante (`sameSecret`). La sesión es una cookie `cris_admin` = vencimiento + HMAC del token (8 h, `HttpOnly`, `SameSite=Strict`, `Secure` bajo HTTPS): no contiene el secreto y cambiar el token invalida todas. Las contraseñas de centro se guardan como `sal:hash` (scrypt) y se comparan con `timingSafeEqual`. Sin token configurado, las rutas de escritura responden 503.
- **Cachés** (`api/cache.ts`). `cached(load)`: 10 minutos y, si la fuente falla, se sirve la última copia buena; `reset()` tras escribir en Metri-K. `cachedByKey`: una caché por clave (perfiles y búsquedas de ORCID con tope de 500 y 200 entradas; integrantes, grupos y centros por investigador). **No** pasan por caché las fotos, logos, ranking, ocultos y publicaciones del admin: un cambio se ve al instante.
- **Encabezados** (`http.ts › createSend`). Respuestas 200 públicas: `Cache-Control: public, max-age=0, s-maxage=30, stale-while-revalidate=60`; todo lo demás y lo privado del admin: `no-store`. Con `compress`, gzip propio para JSON de más de 1 KB si el cliente lo acepta.
- **Errores.** Un handler atrapa los fallos de su operación y responde con su código y mensaje: 400 por forma del cuerpo, 413 por tamaño, 500 «No se pudo guardar…: motivo» si el almacén falla (`saveOr500`), 502 con el motivo de Metri-K en el equipo de proyectos. Lo que nadie atrapa llega al router: 502 «Servicio de datos no disponible».
- **Tamaños.** 1 KB para JSON pequeño, 1 MB para imágenes y el ranking, 16 MB para publicaciones. Un cuerpo mayor: 413 en las rutas de contraseña y página oficial de un centro (donde antes borraba el valor), y la respuesta de «forma inválida» (400) en el resto.

## Limitaciones

1. **Fotos:** Metri-K aún no tiene foto de investigadores; se muestra un monograma con iniciales.
2. **Publicaciones:** Metri-K no tiene conteo de publicaciones por investigador.
3. **Exposición de datos en Metri-K:** pendiente de corregir en origen (ver arriba).
4. Relacionamiento muestra el mapa de coautorías por país de la API de colaboración (`CRIS_COLLAB_URL`); se pide en el navegador, no en el prerender. Antes mostraba una página "en construcción" (`noindex`) hasta tener fuente de datos. Productos muestra el ranking de publicaciones Scopus cargado en `/admin/produccion`.
5. **Proyectos:** Metri-K entrega centros y grupos por nombre (sin id); la ficha los enlaza cuando el nombre coincide con uno publicado.
