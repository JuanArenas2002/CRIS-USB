# Informe final de auditoría: CRIS-UNISIMON

Cierre técnico de la refactorización (fases 1 a 4). No se hicieron commits, push ni despliegues; no se modificó ninguna configuración, dependencia ni contrato de API (salvo el cambio deliberado a 413 descrito en la sección 10).

## 1. Resumen ejecutivo

El repositorio está íntegro y listo para revisión humana. Las validaciones definitivas pasan: TypeScript y ESLint sin errores, Prettier limpio en los 86 archivos tocados, **232/232 pruebas en dos corridas seguidas** y build de producción con código 0 (619 s).

Lo que **no** pude hacer es la revisión visual en un navegador real: en esta sesión no hay herramientas de navegador. La equivalencia visual se sostiene con evidencia indirecta (sección 6), pero no sustituye una revisión humana en móvil, tablet y escritorio.

La auditoría encontró dos asuntos menores, ambos corregidos: un comentario que apuntaba a `public-api.ts` para una constante que ahora vive en `scripts/api/http.ts`, y un `export` sin uso. Encontró también un archivo huérfano **preexistente** (`ProjectSpotlight.tsx`) que no es parte de este trabajo y no se tocó.

## 2. Estado final del repositorio

| Concepto                | Resultado                                                                    |
| ----------------------- | ---------------------------------------------------------------------------- |
| Rama                    | `proyectos`, último commit `f80fc63` (sin commits nuevos)                    |
| Archivos modificados    | 12 (+324 / −4.730 líneas)                                                    |
| Archivos nuevos         | 74, sin versionar                                                            |
| Archivo ajeno           | `Brandbook Unisimón Research.pdf`: ya estaba sin versionar antes del trabajo |
| Temporales y artefactos | Ninguno en el árbol (`*.tmp.*`, `*.orig`, `*.bak`)                           |
| Código de diagnóstico   | Ninguno (`console.log`, `debugger`, `FIXME`) en los módulos nuevos           |

**Grafo de imports** (284 archivos de `src/` y `scripts/`, analizado con el compilador de TypeScript):

- Dependencias circulares: **ninguna**.
- Imports rotos: ninguno (el único marcado por mi script fue `./styles/index.css`, un `.css` que el script no resuelve; es un falso positivo).
- Archivos huérfanos: uno, `src/presentation/components/home/ProjectSpotlight.tsx`. Ya no lo importaba nadie en el commit original (`git grep` sobre `HEAD`), así que es anterior a este trabajo. No lo borré porque no lo verifiqué como innecesario para el producto.
- Exportaciones sin consumidores en módulos nuevos: solo tipos auxiliares (`KpiDelta`, `Stage`, `StatCard`, `JsonField`, `Cached`) y dos funciones puras exportadas para pruebas futuras (`classifyRankingRows`, `dedupePublicationRows`), que hoy se verifican a través de la prueba de caracterización HTTP.
- Referencias obsoletas: las de comentarios se corrigieron; el código que apuntaba a las implementaciones anteriores ya no existe.

## 3. Archivos modificados y creados

**Modificados (12):** `ARCHITECTURE.md`, `scripts/public-api.ts` (de 930 a 42 líneas), `src/application/authors/author-queries.ts` (un comentario), `src/infrastructure/publications/publication-admin.ts` y su prueba, `AuthorPage.tsx`, `CenterPage.tsx`, `GroupPage.tsx`, `ProductsPage.tsx`, `ProjectPage.tsx`, `news-admin/AnalyticsView.tsx` y `news-admin/NewsEditorView.tsx`.

**Creados (74):**

| Carpeta                                                       | Archivos |
| ------------------------------------------------------------- | -------- |
| `scripts/api/` (BFF modular)                                  | 17       |
| `scripts/__golden__/` + `public-api.characterization.test.ts` | 2        |
| `src/presentation/pages/author/`                              | 6        |
| `.../group/`                                                  | 8        |
| `.../center/`                                                 | 8        |
| `.../project/`                                                | 6        |
| `.../products/`                                               | 6        |
| `.../news-admin/analytics/`                                   | 16       |
| `.../news-admin/editor/`                                      | 3        |
| `src/shared/years.ts` y su prueba                             | 2        |

(Algunas carpetas incluyen su `*-model.test.ts`.)

## 4. Arquitectura final

**BFF (`scripts/`).** `public-api.ts` es una fachada de 42 líneas con los mismos `export`. Todo lo demás vive en `scripts/api/`:

- `context.ts`: configuración, almacenes y accesores de datos con caché (el contexto compartido).
- `router.ts`: despacho y orden de validación 405 → 503 → 401; el 502 genérico se maneja en un solo lugar.
- `routes/`: tabla de rutas (`index.ts`) y un módulo de handlers por recurso.
- `http.ts`, `admin-auth.ts`, `cache.ts`: utilidades transversales.

**Frontend (`src/presentation/pages/`).** Cada página grande conserva su archivo, que solo compone (carga, redirección al slug canónico, metadatos y orden de las secciones), y tiene una carpeta hermana con sus secciones, su modelo puro (`*-model.ts`) y, si hay estado relacionado, su hook.

**Complejidad ciclomática** (mismo instrumento, `src/` + `scripts/`, sin pruebas ni traducciones):

|                               | Antes      | Ahora      |
| ----------------------------- | ---------- | ---------- |
| Complejidad máxima            | 205        | 29         |
| Funciones con cc > 25         | 9          | 2          |
| Funciones con cc > 10         | 66         | 54         |
| Función más larga             | 771 líneas | 330 líneas |
| Archivos de más de 300 líneas | 31         | 24         |

Las 54 funciones con cc > 10 que quedan están fuera del alcance acordado (ver sección 12).

## 5. Documentación actualizada

`ARCHITECTURE.md` ahora incluye, verificado contra el código y la referencia ejecutada:

- Estructura de `scripts/api/` y orden de validación del router.
- Tablas de **rutas públicas** y de **rutas de administración** (módulo, ruta, método, efecto).
- Autenticación (token, cookie firmada de 8 h, contraseñas de centro con scrypt), cachés (TTL, respaldo, topes, qué no se cachea), encabezados, manejo de errores y tamaños máximos.
- Organización de las páginas React, dónde viven los modelos puros, las funciones y los hooks.
- Convenciones para agregar un endpoint y para agregar un componente o sección.

Limitación honesta: la tabla original «Contrato del BFF» sigue describiendo solo las lecturas principales; las rutas restantes están en las tablas nuevas.

## 6. Auditoría visual

| Área                                                                                          | Estado                              |
| --------------------------------------------------------------------------------------------- | ----------------------------------- |
| Perfil de investigador, estadísticas, productos, grupo, centro, proyecto, editor/NextStepCard | **NO VERIFICADO en navegador real** |

No dispongo de navegador en esta sesión, por lo que **no se revisaron en pantalla**: escritorio, tablet, móvil, desbordamientos horizontales, consola del navegador ni errores de red.

Evidencia indirecta disponible (útil, no equivalente a ver las pantallas):

- **108 escenarios** de HTML renderizado, idénticos byte a byte antes y después (53 de páginas públicas, 25 de estadísticas, 30 de «Qué sigue»), con estados de carga, error, vacío, filtros, pestañas, idioma inglés e interacciones. En «Qué sigue» también se compararon las llamadas a la API de cada botón.
- **El CSS de producción conserva el mismo hash** (`index-D24IMpzs.css`, 143,15 kB) que antes de la refactorización: ninguna clase de Tailwind cambió.
- Ninguna advertencia de React ni error de consola en las dos corridas de pruebas (solo el `ExperimentalWarning` de Node, que ya existía).

**Pendiente humano:** revisar las 7 áreas en móvil, tablet y escritorio, con la consola abierta.

## 7. TypeScript, ESLint y Prettier

| Verificación                                                               | Resultado |
| -------------------------------------------------------------------------- | --------- |
| `tsc -b`                                                                   | 0 errores |
| `eslint .`                                                                 | 0 errores |
| Prettier (`--end-of-line auto`) sobre los 86 archivos modificados y nuevos | Limpio    |

El repo tiene finales de línea CRLF en el árbol de trabajo; por eso Prettier se ejecutó con `--end-of-line auto` (el resto del proyecto cumple con ese criterio).

## 8. Pruebas

`vitest --pool=vmThreads --maxWorkers=2`, dos corridas consecutivas: **42 archivos y 232 pruebas, todas en verde**.

|          | Línea base        | Final |
| -------- | ----------------- | ----- |
| Archivos | 33                | 42    |
| Pruebas  | 196               | 232   |
| Fallos   | 2 (intermitentes) | 0     |

Las 36 pruebas nuevas cubren los modelos puros y el comportamiento de la gráfica por año. La prueba de caracterización del BFF (323 peticiones HTTP, 8 escenarios) confirma que los contratos HTTP están intactos, incluido el 413 deliberado. No se modificó la configuración de Vitest ni se aumentó ningún timeout.

Nota de entorno: con la concurrencia por defecto, esta máquina produce timeouts aleatorios en pruebas no relacionadas (comprobado también contra el código original). Con `--maxWorkers=2` desaparecen.

## 9. Build

`npm run build`: **código 0, 619 s** (el tiempo lo domina el prerender, que consulta Metri-K en vivo).

- SSR generado (`dist-ssr/entry-server.js`).
- Prerender: 16 investigadores, 31 grupos, 6 centros, 9 proyectos y 1.155 publicaciones, iguales a la línea base. 71 páginas HTML, 69 URLs en el sitemap, `robots.txt` y `llms.txt` presentes.
- Sin errores en el log; los avisos son los de siempre (configuración de Vite y tamaño de chunk).
- **Arranque del servidor completo** (`node scripts/server.ts`): `/`, `/investigadores`, `/grupos`, `/productos`, `/sitemap.xml` y `/robots.txt` responden 200; `/api/nada` 404; `POST /api/groups` 405; el intento de salir de `dist` con `../` devuelve 404. Solo se hicieron lecturas, sin modificar datos.
- **Empaquetado de Vercel** (`vercel-api.ts` en un solo archivo): se genera y la función responde.
- Bundle JS de entrada: 670,2 kB (665,5 kB antes, +0,7 %).

## 10. Verificaciones de seguridad

Revisión de código y de las pruebas existentes; no se hicieron pruebas destructivas ni contra producción.

| Aspecto                 | Resultado                                                                                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token de administración | Comparación en tiempo constante (`sha256` + `timingSafeEqual`); sin token configurado, las escrituras responden 503                                                                                |
| Sesión                  | Cookie `HttpOnly`, `SameSite=Strict`, `Secure` bajo HTTPS; contiene vencimiento y HMAC, no el secreto; 8 h                                                                                         |
| Orden de validación     | 405 → 503 → 401, igual que el original (fijado por la prueba de caracterización)                                                                                                                   |
| Contraseñas de centro   | scrypt con sal, `timingSafeEqual`, solo se guarda `sal:hash`; mínimo 8 caracteres                                                                                                                  |
| Límites de tamaño       | 1 KB, 1 MB y 4 MB según la ruta; imágenes: WebP real (cabecera RIFF/WEBP) y ≤ 1 MB                                                                                                                 |
| **Cuerpos excesivos**   | **Corrección deliberada:** `PUT .../password` y `.../website` responden 413 y no escriben. Antes un cuerpo de más de 1 KB se leía como `null` y borraba el valor. Cubierto con pruebas específicas |
| Cabeceras               | Respuestas privadas del admin y errores con `no-store`; públicas con caché corta; estáticos con `nosniff`, `Referrer-Policy` y `X-Frame-Options`                                                   |
| Estáticos               | Guarda contra salida de `dist/` (probada: 404)                                                                                                                                                     |
| Datos personales        | Los listados públicos proyectan una lista blanca de campos; las pruebas existentes verifican que cédulas, correos, teléfonos y hashes no salgan                                                    |

## 11. Riesgos residuales

1. **Sin límite de intentos** en el inicio de sesión del admin, en la comprobación de contraseña de centro (scrypt es costoso) ni en la búsqueda pública de ORCID. Hoy lo mitigaría el proxy. Preexistente.
2. **Mensajes de error con detalle interno**, solo hacia usuarios autenticados: el 500 de «No se pudo guardar…» puede incluir el mensaje del sistema de archivos y el 502 del equipo de proyectos incluye el motivo de Metri-K. Preexistente.
3. **Sin CSP ni HSTS** en el servidor propio (HSTS suele ponerlo el proxy). Preexistente.
4. **Cuerpos excesivos en otras rutas** responden 400, no 413 (contrato conservado a propósito); no borran nada.
5. **Revisión visual pendiente** (sección 6).
6. **Entorno de pruebas** que exige `--maxWorkers=2`.
7. **`ProjectSpotlight.tsx`**: archivo huérfano preexistente.

## 12. Pendientes para una futura intervención

- Revisión visual en navegador real de las 7 áreas, con consola y red.
- Los componentes grandes que quedan fuera del alcance acordado: `Editor` en `NewsEditorView` (cc 29), `GroupsPage` (cc 27), `toPublicCenter` (cc 24), `RankingList`, `NewsListView`, `CentersPage`, `NewsHomePage` y `AuthorCard`; más 24 archivos de más de 300 líneas.
- Decidir qué hacer con `ProjectSpotlight.tsx`.
- Limitar la tasa de intentos en las rutas de autenticación y de ORCID.
- Corregir el entorno de Vitest (pool y concurrencia) en una intervención independiente.
- Ampliar la tabla «Contrato del BFF» de `ARCHITECTURE.md` con todas las rutas.

## Tabla de estado

| Área                                                     | Estado                     | Observación                                         |
| -------------------------------------------------------- | -------------------------- | --------------------------------------------------- |
| Integridad del repositorio (imports, ciclos, temporales) | APROBADO                   | Un huérfano preexistente documentado                |
| `tsc -b`                                                 | APROBADO                   |                                                     |
| `eslint .`                                               | APROBADO                   |                                                     |
| Prettier                                                 | APROBADO                   | Con `--end-of-line auto` por el CRLF del árbol      |
| Pruebas (232/232 ×2)                                     | APROBADO                   | Requiere `--maxWorkers=2` en esta máquina           |
| Contratos HTTP                                           | APROBADO                   | Cambio deliberado a 413 documentado y probado       |
| Build, prerender y sitemap                               | APROBADO                   |                                                     |
| Arranque del servidor y empaquetado de Vercel            | APROBADO                   |                                                     |
| Documentación de arquitectura                            | APROBADO CON OBSERVACIONES | La tabla «Contrato del BFF» original sigue resumida |
| Seguridad                                                | APROBADO CON OBSERVACIONES | Cuatro riesgos preexistentes (sección 11)           |
| Equivalencia visual (HTML y CSS)                         | APROBADO                   | 108 escenarios idénticos y CSS con el mismo hash    |
| Revisión visual en navegador real                        | NO VERIFICADO              | Sin navegador disponible en esta sesión             |
| Refactorización del resto de componentes grandes         | PENDIENTE                  | Fuera del alcance acordado                          |
| Limitación de tasa de intentos                           | PENDIENTE                  | Preexistente                                        |
