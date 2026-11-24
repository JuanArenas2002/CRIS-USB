// Contraseña de centro (la tienen solo los directores): protege las fotos y el equipo de sus proyectos.
import { projectsOfCenter } from '../../../src/domain/projects/project.ts';
import { verifyPassword } from '../../center-password.ts';
import type { RequestContext } from '../router.ts';

/** El centro activo `centerId` si la contraseña de la cabecera X-Center-Password es la suya; si no, null. */
export async function centerOk({ ctx, req }: RequestContext, centerId: number) {
  const center = (await ctx.metrikCenters()).find((c) => c.id === centerId && c.active);
  let password = '';
  try {
    password = decodeURIComponent(String(req.headers['x-center-password'] ?? ''));
  } catch {
    /* mal codificada: cuenta como vacía */
  }
  return center && verifyPassword(password, (await ctx.centerPasswords.all())[centerId]) ? center : null;
}

/**
 * Fotos y equipo de un proyecto: además del token, la contraseña del centro (X-Center-Id y
 * X-Center-Password) y el proyecto debe ser de ese centro. Responde 403 y devuelve false si no.
 */
export async function projectAccess(rc: RequestContext, projectId: number) {
  const center = await centerOk(rc, Number(rc.req.headers['x-center-id']));
  if (!center) {
    rc.send(403, { detail: 'Contraseña del centro incorrecta' });
    return false;
  }
  if (!projectsOfCenter(await rc.ctx.metrikProjects(), center.name).some((x) => x.id === projectId)) {
    rc.send(403, { detail: 'El proyecto no es de este centro' });
    return false;
  }
  return true;
}
