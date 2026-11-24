// Proyectos: listado y ficha (públicos); equipo en Metri-K `personal` (admin, con la contraseña del centro).
import { fetchStaff, removeStaff, saveStaff, toStaff } from '../../projects-source.ts';
import { MAX_JSON_BYTES, readBody, readField, type Send } from '../http.ts';
import type { RequestContext, Route } from '../router.ts';
import { projectAccess } from './center-access.ts';

// ponytail: el listado va completo (~10 proyectos, pocos KB); resumirlo si pasan de cientos.
const listProjects: Route = {
  match: /^\/api\/projects$/,
  async handler({ ctx, send }) {
    return send(200, await ctx.projects());
  },
};

const projectDetail: Route = {
  match: /^\/api\/projects\/(\d{1,12})$/,
  async handler({ ctx, send }, m) {
    const x = (await ctx.projects()).find((y) => y.id === Number(m[1]));
    return x ? send(200, x) : send(404, { detail: 'No encontrado' });
  },
};

const STAFF_PATH = /^\/api\/projects\/(\d{1,10})\/personal$/;
const STAFF_ONE_PATH = /^\/api\/projects\/(\d{1,10})\/personal\/([^/]{1,40})$/;
const DOCUMENT = /^\d{4,15}$/;

/** Un fallo de Metri-K en el equipo se informa tal cual (502 privado): el director necesita saber qué pasó. */
async function orBadGateway<T>(send: Send, run: () => Promise<T>): Promise<{ value: T } | null> {
  try {
    return { value: await run() };
  } catch (err) {
    send(502, { detail: (err as Error).message }, true);
    return null;
  }
}

/** Tras escribir: la página pública muestra el cambio de inmediato y se devuelve el equipo vigente. */
async function staffAfterWrite({ ctx, send }: RequestContext, projectId: number) {
  ctx.metrikProjects.reset();
  return send(200, await fetchStaff(ctx.base, projectId), true);
}

// GET: lista con cédulas (solo para el admin).
const staffList: Route = {
  match: STAFF_PATH,
  methods: ['GET'],
  async handler(rc, m) {
    const projectId = Number(m[1]);
    if (!(await projectAccess(rc, projectId))) return;
    await orBadGateway(rc.send, async () => rc.send(200, await fetchStaff(rc.ctx.base, projectId), true));
  },
};

// PATCH: agrega o actualiza. Nombre obligatorio; cédula opcional (solo dígitos); rol libre y corto.
const staffAdd: Route = {
  match: STAFF_PATH,
  methods: ['PATCH'],
  async handler(rc, m) {
    const projectId = Number(m[1]);
    if (!(await projectAccess(rc, projectId))) return;
    const written = await orBadGateway(rc.send, async () => {
      const person = readField(await readBody(rc.req, MAX_JSON_BYTES), toStaff, null) as ReturnType<
        typeof toStaff
      >;
      if (
        !person ||
        person.nombreCompleto.length > 200 ||
        (person.rol?.length ?? 0) > 80 ||
        (person.cedula !== null && !DOCUMENT.test(person.cedula))
      ) {
        rc.send(400, {
          detail: 'Se espera { "nombreCompleto": "…", "rol": "…", "cedula": "123…" (opcional) }',
        });
        return false;
      }
      await saveStaff(rc.ctx.base, projectId, person);
      return true;
    });
    if (written?.value) return staffAfterWrite(rc, projectId);
  },
};

// DELETE: quita por cédula.
const staffRemove: Route = {
  match: STAFF_ONE_PATH,
  methods: ['DELETE'],
  async handler(rc, m) {
    const projectId = Number(m[1]);
    if (!(await projectAccess(rc, projectId))) return;
    const removed = await orBadGateway(rc.send, async () => {
      const cedula = decodeURIComponent(m[2]!);
      if (!DOCUMENT.test(cedula)) {
        rc.send(400, { detail: 'Cédula inválida' });
        return false;
      }
      await removeStaff(rc.ctx.base, projectId, cedula);
      return true;
    });
    if (removed?.value) return staffAfterWrite(rc, projectId);
  },
};

export const projectPublicRoutes = [listProjects, projectDetail];
export const projectAdminRoutes = [staffList, staffAdd, staffRemove];
