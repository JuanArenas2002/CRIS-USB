// Grupos de investigación (públicos): listado, personal, trayectoria, ficha e integrantes.
import { toGroupStaffing } from '../../groups-source.ts';
import { hasPublicDetail, summarizeGroup, tallyByConvocation } from '../../../src/domain/groups/group.ts';
import type { Route } from '../router.ts';

const listGroups: Route = {
  match: /^\/api\/groups$/,
  async handler({ ctx, send }) {
    return send(200, (await ctx.groups()).map(summarizeGroup));
  },
};

const groupsStaffing: Route = {
  match: /^\/api\/groups\/staffing$/,
  async handler({ ctx, send }) {
    return send(200, toGroupStaffing(await ctx.staffRows()));
  },
};

const groupsTrajectory: Route = {
  match: /^\/api\/groups\/trajectory$/,
  async handler({ ctx, send }) {
    return send(200, tallyByConvocation(await ctx.groups()));
  },
};

const groupMembers: Route = {
  match: /^\/api\/groups\/(\d{1,12})\/members$/,
  async handler({ ctx, send }, m) {
    const id = Number(m[1]);
    if (!(await ctx.groups()).some((g) => g.id === id && g.active && hasPublicDetail(g)))
      return send(404, { detail: 'No encontrado' });
    return send(200, await ctx.membersOf(id));
  },
};

const groupDetail: Route = {
  match: /^\/api\/groups\/(\d{1,12})$/,
  async handler({ ctx, send }, m) {
    // Interinstitucionales: solo en el listado, sin ficha.
    const g = (await ctx.groups()).find((x) => x.id === Number(m[1]) && hasPublicDetail(x));
    return g ? send(200, g) : send(404, { detail: 'No encontrado' });
  },
};

export const groupRoutes = [listGroups, groupsStaffing, groupsTrajectory, groupMembers, groupDetail];
