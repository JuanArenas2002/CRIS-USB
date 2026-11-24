// Centros: listado, ficha y PDF de resoluciones (públicos); acceso por contraseña, contraseña y página oficial (admin).
import { summarizeCenter } from '../../../src/domain/centers/center.ts';
import { MIN_CENTER_PASSWORD, hashPassword } from '../../center-password.ts';
import { fetchResolutionPdf } from '../../centers-source.ts';
import { normalizeWebsite } from '../../ods-store.ts';
import { MAX_JSON_BYTES, jsonField, readBody, saveOr500, tooLarge } from '../http.ts';
import type { Route } from '../router.ts';
import { centerOk } from './center-access.ts';

const listCenters: Route = {
  match: /^\/api\/centers$/,
  async handler({ ctx, send }) {
    return send(200, (await ctx.centers()).map(summarizeCenter));
  },
};

const centerDetail: Route = {
  match: /^\/api\/centers\/(\d{1,12})$/,
  async handler({ ctx, send }, m) {
    const c = (await ctx.centers()).find((x) => x.id === Number(m[1]));
    return c ? send(200, c) : send(404, { detail: 'No encontrado' });
  },
};

// PDF de una resolución (solo de centros activos). Bajo demanda: Metri-K lo trae en base64.
const resolutionPdf: Route = {
  match: /^\/api\/centers\/(\d{1,12})\/resolutions\/(\d{1,12})$/,
  async handler({ ctx, req, res, send }, m) {
    const centerId = Number(m[1]);
    const c = (await ctx.centers()).find((x) => x.id === centerId && x.active);
    if (!c?.resolutions.some((r) => r.id === Number(m[2]) && r.hasFile))
      return send(404, { detail: 'No encontrado' });
    const file = await fetchResolutionPdf(ctx.base, centerId, Number(m[2]));
    if (!file) return send(404, { detail: 'No encontrado' });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${file.name}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    return res.end(req.method === 'HEAD' ? undefined : file.pdf);
  },
};

// Comprobar la contraseña de un centro antes de mostrar sus proyectos en el admin.
const centerAccess: Route = {
  match: /^\/api\/centers\/(\d{1,12})\/access$/,
  methods: ['GET'],
  async handler(rc, m) {
    return (await centerOk(rc, Number(m[1])))
      ? rc.send(200, { ok: true }, true)
      : rc.send(403, { detail: 'Contraseña del centro incorrecta' });
  },
};

const centerPassword: Route = {
  match: /^\/api\/centers\/(\d{1,12})\/password$/,
  methods: ['PUT'],
  async handler({ ctx, req, send }, m) {
    const id = Number(m[1]);
    if (!(await ctx.metrikCenters()).some((c) => c.id === id && c.active))
      return send(404, { detail: 'No encontrado' });
    const body = await readBody(req, MAX_JSON_BYTES);
    if (!body) return tooLarge(send, '1 KB'); // antes se leía como `null` y borraba la contraseña
    const field = jsonField(body, 'password');
    // Inválido o ausente → 400; `null` es una orden explícita de quitarla.
    const password = field.kind === 'value' ? field.value : undefined;
    if (!(password === null || (typeof password === 'string' && password.length >= MIN_CENTER_PASSWORD)))
      return send(400, {
        detail: `Se espera { "password": "…" } (mínimo ${MIN_CENTER_PASSWORD} caracteres) o { "password": null }`,
      });
    const saved = await saveOr500(send, 'No se pudo guardar la contraseña', () =>
      ctx.centerPasswords.set(id, password === null ? null : hashPassword(password as string)),
    );
    if (saved) send(200, { hasPassword: password !== null }, true);
  },
};

const centerWebsite: Route = {
  match: /^\/api\/centers\/(\d{1,12})\/website$/,
  methods: ['PUT'],
  async handler({ ctx, req, send }, m) {
    const id = Number(m[1]);
    if (!(await ctx.metrikCenters()).some((c) => c.id === id && c.active))
      return send(404, { detail: 'No encontrado' });
    const body = await readBody(req, MAX_JSON_BYTES);
    if (!body) return tooLarge(send, '1 KB'); // antes se leía como `null` y borraba la página
    const field = jsonField(body, 'website');
    const website = field.kind === 'value' ? field.value : undefined;
    // null o "" quitan la página; cualquier otro valor debe ser una URL http(s) válida.
    if (!(website === null || website === '' || normalizeWebsite(website)))
      return send(400, { detail: 'Se espera { "website": "https://…" } o { "website": null }' });
    const saved = await saveOr500(send, 'No se pudo guardar la página', () =>
      ctx.sites.set(id, website as string | null),
    );
    if (saved) send(200, { website: saved.value });
  },
};

export const centerPublicRoutes = [listCenters, centerDetail, resolutionPdf];
export const centerAdminRoutes = [centerAccess, centerPassword, centerWebsite];
