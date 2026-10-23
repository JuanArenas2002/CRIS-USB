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
  public-api.ts            BFF de solo lectura (dev, preview y producción)
  prerender.mjs            SSG: páginas, 404, sitemap.xml, robots.txt, llms.txt
```

Las dependencias apuntan hacia el dominio. El dominio no importa React ni infraestructura; sus funciones puras (`queryAuthors`, `authorStats`, `filterGroups`…) las usan por igual el BFF, el prerender y los tests.

## Decisiones

**BFF obligatorio.** Metri-K expone sin autenticación y con `Access-Control-Allow-Origin: *` cédulas, correos, teléfonos, género, etnia y **hashes de contraseña** (`/api/investigator`, `/api/group`, `/api/group/investigator/{id}`). El navegador nunca llama a Metri-K: el BFF proyecta a una lista blanca de campos públicos (`toPublicInvestigator`, `toPublicGroup`) y los tests verifican que ningún dato personal pase. **Esto no corrige la exposición en Metri-K**, que debe cerrarse en origen.

**Búsqueda y paginación en el BFF.** Metri-K devuelve listas completas sin filtros. El BFF guarda en memoria (10 min, con respaldo si Metri-K falla) ~600 investigadores y ~50 grupos, y resuelve búsqueda sin tildes, filtros, orden y paginación.

**Política de publicación.**

- Investigadores: solo los activos en GrupLAC (`state_gruplac`).
- Grupos: solo activos (`state`).
- Un perfil sin identificadores externos se publica, pero con `noindex` y fuera del sitemap.

**SSG.** HTML estático con contenido real para el directorio, cada investigador y cada grupo. El costo es reconstruir periódicamente.

**URLs** `/investigadores/{id}-{slug}` y `/grupos/{id}-{slug}`. El id resuelve el recurso; un slug distinto redirige al canónico.

## Contrato del BFF

| Ruta | Respuesta |
| --- | --- |
| `GET /api/investigators?q&cat&group&page&size` | `{ items: Author[], total, page, pages }` (máx. 100 por página) |
| `GET /api/investigators/stats` | `{ total, byCategory }` |
| `GET /api/investigators/{id}` | `AuthorProfile` (con `groups`) o 404 |
| `GET /api/groups` | `Group[]` (líneas solo con nombre) |
| `GET /api/groups/{id}` | `GroupDetail` (líneas completas + historial) o 404 |
| `GET /api/publications?q&from&to&quartile&type&area&oa&sort&page&size` | `{ items: (RankedPublication & { position })[], total, page, pages }`: `rank` es el puesto general; `position`, el puesto recalculado dentro del filtro |
| `GET /api/publications/stats` | `{ total, byQuartile, openAccess, international, citations, years, types, areas }` |

## Limitaciones

1. **Fotos:** Metri-K aún no tiene foto de investigadores; se muestra un monograma con iniciales.
2. **Publicaciones:** Metri-K no tiene conteo de publicaciones por investigador.
3. **Exposición de datos en Metri-K:** pendiente de corregir en origen (ver arriba).
4. Proyectos y Relacionamiento muestran una página "en construcción" (`noindex`) hasta tener fuente de datos. Productos muestra el ranking de publicaciones Scopus cargado en `/admin/produccion`.
