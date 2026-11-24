// @vitest-environment node
// Prueba de caracterización de createPublicApi: congela la semántica HTTP (estado, encabezados y cuerpo exacto)
// de cada ruta, incluidos los errores. Se registró contra la implementación monolítica antes de modularizarla;
// cualquier diferencia respecto de `__golden__/public-api.golden.json` es un cambio de contrato.
// Regenerar a propósito (solo si el contrato cambia adrede): UPDATE_GOLDEN=1 npx vitest run <este archivo>.
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { createPublicApi } from './public-api';

const TOKEN = 'secreto-de-prueba';
const GOLDEN = path.join(import.meta.dirname, '__golden__', 'public-api.golden.json');
const UPDATE = process.env.UPDATE_GOLDEN === '1';

// ── Orígenes simulados ───────────────────────────────────────────────────────────────────────────────
const person = {
  documentNumber: '11111111',
  email: 'p@x.co',
  phone: '3000000000',
  level_education: 'Doctorado',
};
const inv = (id: number, name: string, extra = {}) => ({
  id,
  name_standard: name,
  lastCategory: 'Junior (IJ)',
  state_gruplac: true,
  person,
  groupMain: { id: 14, code: 'COL1', name: 'Grupo Uno' },
  ...extra,
});
const groupRaw = {
  id: 14,
  code: 'COL1',
  name: 'Grupo Uno',
  state: true,
  lastCategory: 'A1',
  mentor: { user: { username: 'mentor', password: '$2b$10$hash' }, person },
};
const interRaw = {
  id: 15,
  code: 'COL2',
  name: 'Grupo Inter',
  state: true,
  lastCategory: 'B',
  type: 'Interinstitucional',
};
const PDF = Buffer.from('%PDF-1.4 resolución de prueba');
const centerRaw = {
  id: 1,
  code: 'CI-1',
  name: 'Centro Uno',
  acronym: 'CU',
  state: true,
  date_created: '2004-08-20T00:00:00.000Z',
  director: { person: { ...person, name: 'ANA', lastname: 'PEREZ' }, orcid: '0000-0002-1825-0097' },
  municipality: { code: '08001', name: 'BARRANQUILLA', department: { name: 'ATLÁNTICO' } },
};
const centersMock: Record<string, unknown[]> = {
  '/api/center': [centerRaw, { id: 0, code: 'N/A', name: 'N/A', director: { person: { name: 'N/A' } } }],
  '/api/center/investigator/1': [centerRaw],
  '/api/lineCenter/center/1': [{ id: 3, code: 'LC001', name: 'Emprendimiento', state: true }],
  '/api/ods/center/1': [
    { id: 1, number: '17', title: 'Alianzas' },
    { id: 2, number: '8', title: 'Trabajo' },
  ],
  '/api/resolutionCenter/center/1': [
    {
      id: 9,
      number: 'Resolucion 1',
      type: 'Reconocimiento',
      date: '2022-12-14T05:00:00.000Z',
      file: PDF.toString('base64'),
    },
  ],
};
const staff: Record<number, { cedula?: string; nombreCompleto: string; rol: string }[]> = {};
let mode: 'ok' | 'down' = 'ok';

async function metrik(url: string, init?: RequestInit) {
  if (mode === 'down') return Response.json({ message: 'caído' }, { status: 500 });
  const p = new URL(url).pathname;
  const m = /\/proyectos\/seleccionados\/(\d+)\/personal(?:\/(\d+))?$/.exec(p);
  if (m && init?.method && init.method !== 'GET') {
    const id = Number(m[1]);
    const body = init.body ? JSON.parse(String(init.body)) : null;
    if (body?.cedula === '9999999' || m[2] === '9999999')
      return Response.json({ message: 'rechazado' }, { status: 500 });
    const list = (staff[id] ??= []);
    if (init.method === 'PATCH') {
      const i = body.cedula ? list.findIndex((x) => x.cedula === body.cedula) : -1;
      if (i >= 0) list[i] = body;
      else list.push(body);
    } else staff[id] = list.filter((x) => x.cedula !== m[2]);
    return Response.json({ message: 'ok' });
  }
  const longTitle = 'Proyecto uno '.repeat(150); // > 1 KB: el JSON se comprime con compress:true
  const data =
    p === '/api/investigator/seleccionados'
      ? [
          {
            id: 1,
            authorsIds: [
              { authorId: '57000000007', indice_h: '7' },
              { authorId: '57000000012', indice_h: '12' },
            ],
            produccion: {
              totales: { publicacionesScopus: 1, total: 2 },
              publicacionesScopus: [
                {
                  id: 5,
                  title: 'Paper',
                  year: 2024,
                  citedBy: 3,
                  link: 'https://www.scopus.com/x',
                  doi: '10.1000/xyz',
                  eid: '2-s2.0-85000000005',
                },
              ],
              trabajosDeFormacion: [],
              desarrollosTecnologicos: [],
            },
          },
        ]
      : p === '/api/investigator'
        ? [
            inv(1, 'PEREZ, ANA', { lastCategory: 'Sénior (IS)' }),
            inv(2, 'GOMEZ, LUIS', { person: { ...person, documentNumber: '22.222.222' } }),
            inv(3, 'RETIRADO, JUAN', {
              state_gruplac: false,
              person: { ...person, documentNumber: '33333333' },
            }),
          ]
        : p === '/api/investigator/group/14'
          ? [inv(1, 'PEREZ, ANA')]
          : p.startsWith('/api/group/investigator/')
            ? p.endsWith('/1')
              ? [groupRaw]
              : []
            : p === '/api/group'
              ? [groupRaw, interRaw]
              : p.startsWith('/api/lineGroup/') || p.startsWith('/api/group/categories/')
                ? []
                : p.startsWith('/api/ods/group/')
                  ? p.endsWith('/14')
                    ? [
                        { id: 17, number: '17', title: 'Alianzas', description: 'x' },
                        { id: 3, number: '3', title: 'Salud', description: 'x' },
                      ]
                    : []
                  : p === '/api/proyectos/seleccionados'
                    ? [
                        {
                          id: 1,
                          codigo: 'P-1',
                          titulo: longTitle,
                          centros: ['CENTRO UNO'],
                          lideres: [{ nombre: 'Ana', cedula: '11111111' }],
                          personal: staff[1] ?? [],
                        },
                        { id: 2, codigo: 'P-2', titulo: 'Proyecto de otro centro', centros: ['Otro'] },
                      ]
                    : (centersMock[p] ?? null);
  return data ? Response.json({ data, message: 'ok' }) : Response.json({ message: 'x' }, { status: 404 });
}

async function collab(url: string) {
  if (mode === 'down') return Response.json({}, { status: 500 });
  const u = new URL(url);
  if (u.pathname.endsWith('/affiliations/publications'))
    return Response.json({
      by_iso3: {
        ESP: {
          iso2: 'ES',
          iso3: 'ESP',
          iso_numeric: '724',
          country: 'Spain',
          collaboration_type: 'internacional',
          total_publications: 9,
          total_citations: 40,
        },
        COL: {
          iso2: 'CO',
          iso3: 'COL',
          iso_numeric: '170',
          country: 'Colombia',
          collaboration_type: 'nacional',
          total_publications: 30,
          total_citations: 90,
        },
      },
    });
  if (u.pathname.endsWith('/publications') && u.pathname.includes('/affiliations/'))
    return Response.json({
      publications: [
        { eid: 'e1', title: 'Colaboración', year: 2023, citations: 2, partner_institutions: ['U1'] },
      ],
    });
  if (u.pathname.endsWith('/institution/publications'))
    return Response.json({
      publicaciones: [
        { anio: 2022, tipo: 'Article', paises_externos: ['Spain'] },
        { anio: 2023, tipo: 'Review', paises_externos: [] },
      ],
    });
  return Response.json({}, { status: 404 });
}

async function orcid(url: string) {
  if (mode === 'down') return Response.json({}, { status: 500 });
  const u = new URL(url);
  if (u.pathname.includes('/expanded-search'))
    return Response.json({
      'expanded-result': [
        {
          'orcid-id': '0000-0002-1825-0097',
          'given-names': 'Ana',
          'family-names': 'Pérez',
          'institution-name': ['Unisimón'],
          email: ['no@sale.co'],
        },
      ],
    });
  if (u.pathname.endsWith('/0000-0002-1825-0097/record'))
    return Response.json({
      person: { name: { 'given-names': { value: 'Ana' }, 'family-name': { value: 'Pérez' } } },
      'activities-summary': {},
    });
  return Response.json({}, { status: 404 });
}

const realFetch = globalThis.fetch;
const stubbedFetch = (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith('http://metrik')) return metrik(url, init);
  if (url.startsWith('http://collab')) return collab(url);
  if (url.startsWith('http://orcid')) return orcid(url);
  return realFetch(input as string, init);
};

// ── Matriz de peticiones ─────────────────────────────────────────────────────────────────────────────
type Body = string | Uint8Array | object;
interface Case {
  m: string;
  p: string;
  h?: Record<string, string>;
  b?: Body;
}
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(8)]);
const T = { 'X-Admin-Token': TOKEN };
const BAD = { 'X-Admin-Token': 'otro' };
const PASS = 'clave-del-director';
const center = (pw = PASS, id = '1') => ({
  ...T,
  'X-Center-Id': id,
  'X-Center-Password': encodeURIComponent(pw),
});
const g = (p: string, h?: Record<string, string>): Case => ({ m: 'GET', p, h });
const row = (cc: string, name: string, rank: number, index: number, c: string | null = null) => ({
  cc,
  name,
  rank,
  index,
  center: c,
  centerRank: c ? 1 : null,
});
const pub = (rank: number, eid: string, over = {}) => ({
  rank,
  score: 90 - rank,
  eid,
  doi: null,
  title: `Paper ${rank}`,
  abstract: null,
  year: 2024,
  type: 'Article',
  journal: 'Journal',
  areas: ['Natural Sciences'],
  citations: 3,
  openAccess: false,
  international: false,
  countries: ['Colombia'],
  correspondence: false,
  authorsCount: 2,
  ...over,
});

const mainCases: Case[] = [
  // Públicas
  g('/api/investigators'),
  g('/api/investigators?q=perez'),
  g('/api/investigators?cat=senior'),
  g('/api/investigators?cat=nada'),
  g('/api/investigators?page=0&size=100000'),
  g('/api/investigators?page=abc&size=-4'),
  g('/api/investigators?group=14'),
  g('/api/investigators?center=1'),
  g('/api/investigators?tier=top12'),
  g('/api/investigators?tier=otro'),
  g('/api/investigators/stats'),
  g('/api/investigators/featured'),
  g('/api/investigators/1'),
  g('/api/investigators/2'),
  g('/api/investigators/3'),
  g('/api/investigators/999'),
  g('/api/investigators/abc'),
  g('/api/publications'),
  g('/api/publications?sort=cited&oa=1&type=Article&area=x&from=2020&to=2025&q=a&page=2&size=1'),
  g('/api/publications?sort=raro'),
  g('/api/publications/stats'),
  g('/api/groups'),
  g('/api/groups/staffing'),
  g('/api/groups/trajectory'),
  g('/api/groups/14'),
  g('/api/groups/15'),
  g('/api/groups/14/members'),
  g('/api/groups/15/members'),
  g('/api/groups/999'),
  g('/api/groups/14/otra'),
  g('/api/relations/by-year'),
  g('/api/relations/countries'),
  g('/api/relations/countries?year=2024'),
  g('/api/relations/countries?year=1900'),
  g('/api/relations/countries?year=abc'),
  g('/api/relations/countries?year=3000'),
  g('/api/relations/countries/ESP/publications'),
  g('/api/relations/countries/ESP/publications?year=2024'),
  g('/api/relations/countries/ZZZ/publications'),
  g('/api/relations/countries/ESP/publications?year=1900'),
  g('/api/relations/countries/es/publications'),
  g('/api/projects'),
  g('/api/projects/1'),
  g('/api/projects/2'),
  g('/api/projects/999'),
  g('/api/centers'),
  g('/api/centers/1'),
  g('/api/centers/0'),
  g('/api/centers/999'),
  g('/api/centers/1/resolutions/9'),
  { m: 'HEAD', p: '/api/centers/1/resolutions/9' },
  g('/api/centers/1/resolutions/99'),
  g('/api/centers/999/resolutions/9'),
  g('/api/orcid/search?q=ab'),
  g('/api/orcid/search?q=ana%20perez'),
  g('/api/orcid/search'),
  g('/api/orcid/0000-0002-1825-0097'),
  g('/api/orcid/0000-0001-5109-3700'),
  g('/api/orcid/no-valido'),
  g('/api/orcid/0000%2D0002%2D1825%2D0097'),
  g('/api/orcid/%E0%A4%A'),
  g('/api/authors'),
  g('/api/group'),
  g('/api/'),
  g('/api'),
  // Métodos no permitidos
  { m: 'POST', p: '/api/investigators' },
  { m: 'POST', p: '/api/groups' },
  { m: 'OPTIONS', p: '/api/groups' },
  { m: 'HEAD', p: '/api/groups/14' },
  { m: 'PUT', p: '/api/investigators' },
  { m: 'DELETE', p: '/api/groups' },
  { m: 'PUT', p: '/api/groups', h: T },
  { m: 'PATCH', p: '/api/centers/1/website', h: T },
  { m: 'POST', p: '/api/ranking', h: T },
  { m: 'DELETE', p: '/api/ranking/1', h: T },
  { m: 'POST', p: '/api/publications', h: T },
  { m: 'DELETE', p: '/api/centers/1/website', h: T },
  { m: 'DELETE', p: '/api/centers/1/password', h: T },
  { m: 'PUT', p: '/api/projects/1/personal', h: T },
  { m: 'PATCH', p: '/api/projects/1/personal/7434389', h: T },
  // Sesión de administración
  g('/api/admin/session'),
  { m: 'POST', p: '/api/admin/session', b: { token: 'otro' } },
  { m: 'POST', p: '/api/admin/session', b: 'no es json' },
  { m: 'POST', p: '/api/admin/session' },
  { m: 'POST', p: '/api/admin/session', b: { token: 5 } },
  { m: 'POST', p: '/api/admin/session', b: 'x'.repeat(2000) },
  { m: 'PUT', p: '/api/admin/session' },
  { m: 'PATCH', p: '/api/admin/session' },
  { m: 'POST', p: '/api/admin/session', b: { token: TOKEN } }, // fija $COOKIE
  g('/api/admin/session', { cookie: '$COOKIE' }),
  g('/api/admin/session', { cookie: 'cris_admin=1.abc' }),
  g('/api/admin/session', { cookie: 'cris_admin=zzz' }),
  { m: 'POST', p: '/api/admin/session', h: { 'x-forwarded-proto': 'https' }, b: { token: TOKEN } },
  { m: 'DELETE', p: '/api/admin/session', h: { cookie: '$COOKIE' } },
  // Fotos de investigadores
  { m: 'PUT', p: '/api/investigators/1/photo', b: WEBP },
  { m: 'PUT', p: '/api/investigators/1/photo', h: BAD, b: WEBP },
  { m: 'PUT', p: '/api/investigators/1/photo', h: { cookie: '$COOKIE' }, b: WEBP },
  { m: 'PUT', p: '/api/investigators/1/photo', h: { cookie: 'cris_admin=1.abc' }, b: WEBP },
  { m: 'PUT', p: '/api/investigators/1/photo', h: T, b: '<svg/>' },
  { m: 'PUT', p: '/api/investigators/2/photo', h: T, b: WEBP },
  { m: 'PUT', p: '/api/investigators/1/photo', h: T, b: Buffer.alloc(1024 * 1024 + 1) },
  { m: 'PUT', p: '/api/investigators/1/photo', h: T, b: WEBP },
  g('/api/investigators/1/photo'),
  g('/api/investigators/1/photo?v=1'),
  g('/api/investigators'),
  { m: 'DELETE', p: '/api/investigators/1/photo', h: T },
  { m: 'DELETE', p: '/api/investigators/2/photo', h: T },
  g('/api/investigators/1/photo'),
  // Logos y páginas oficiales de centros
  { m: 'PUT', p: '/api/centers/1/logo', h: BAD, b: WEBP },
  { m: 'PUT', p: '/api/centers/1/logo', h: T, b: '<svg/>' },
  { m: 'PUT', p: '/api/centers/0/logo', h: T, b: WEBP },
  { m: 'PUT', p: '/api/centers/1/logo', h: T, b: WEBP },
  g('/api/centers/1/logo?v=1'),
  g('/api/centers/1'),
  { m: 'DELETE', p: '/api/centers/1/logo', h: T },
  { m: 'DELETE', p: '/api/centers/0/logo', h: T },
  { m: 'PUT', p: '/api/centers/1/website', h: T, b: { website: 'javascript:alert(1)' } },
  { m: 'PUT', p: '/api/centers/1/website', h: T, b: { website: 'nada' } },
  { m: 'PUT', p: '/api/centers/1/website', h: T, b: 'no json' },
  { m: 'PUT', p: '/api/centers/1/website', h: T },
  { m: 'PUT', p: '/api/centers/1/website', h: T, b: {} },
  { m: 'PUT', p: '/api/centers/1/website', h: T, b: { website: 'www.cu.co' } },
  g('/api/centers/1'),
  { m: 'PUT', p: '/api/centers/1/website', h: T, b: { website: '' } },
  { m: 'PUT', p: '/api/centers/1/website', h: T, b: { website: null } },
  { m: 'PUT', p: '/api/centers/999/website', h: T, b: { website: null } },
  // Contraseña del centro, acceso y fotos de proyectos
  { m: 'PUT', p: '/api/centers/1/password', b: { password: PASS } },
  { m: 'PUT', p: '/api/centers/1/password', h: BAD, b: { password: PASS } },
  { m: 'PUT', p: '/api/centers/999/password', h: T, b: { password: PASS } },
  { m: 'PUT', p: '/api/centers/1/password', h: T, b: { password: 'corta' } },
  { m: 'PUT', p: '/api/centers/1/password', h: T, b: 'no json' },
  { m: 'PUT', p: '/api/centers/1/password', h: T, b: {} },
  { m: 'PUT', p: '/api/centers/1/password', h: T, b: { password: 5 } },
  g('/api/centers/1/access', center()),
  { m: 'PUT', p: '/api/projects/1/photos/0', h: center(), b: WEBP },
  { m: 'PUT', p: '/api/centers/1/password', h: T, b: { password: PASS } },
  g('/api/centers/1/access', center('otra')),
  g('/api/centers/1/access', center()),
  g('/api/centers/1/access', BAD),
  g('/api/centers/1/access', { ...T, 'X-Center-Id': '1', 'X-Center-Password': '%E0%A4%A' }),
  g('/api/centers/1/access', T),
  g('/api/centers/1/access'),
  g('/api/centers/999/access', center(PASS, '999')),
  { m: 'PUT', p: '/api/projects/1/photos/0', h: center(PASS, '1'), b: '<svg/>' },
  { m: 'PUT', p: '/api/projects/1/photos/0', h: center('otra'), b: WEBP },
  { m: 'PUT', p: '/api/projects/2/photos/0', h: center(), b: WEBP },
  { m: 'PUT', p: '/api/projects/1/photos/13', h: center(), b: WEBP },
  { m: 'PUT', p: '/api/projects/999/photos/0', h: center(), b: WEBP },
  { m: 'PUT', p: '/api/projects/1/photos/0', h: BAD, b: WEBP },
  { m: 'PUT', p: '/api/projects/1/photos/0', h: center(), b: WEBP },
  { m: 'PUT', p: '/api/projects/1/photos/2', h: center(), b: WEBP },
  g('/api/projects/1/photos/0?v=1'),
  g('/api/projects/1/photos/9'),
  g('/api/projects/1'),
  { m: 'DELETE', p: '/api/projects/1/photos/0', h: center() },
  { m: 'DELETE', p: '/api/projects/1/photos/2', h: center() },
  { m: 'DELETE', p: '/api/projects/1/photos/2', h: center() },
  // Equipo de proyectos
  g('/api/projects/1/personal', center()),
  g('/api/projects/1/personal', center('otra')),
  g('/api/projects/1/personal'),
  g('/api/projects/2/personal', center()),
  g('/api/projects/999/personal', center()),
  { m: 'PATCH', p: '/api/projects/1/personal', h: center(), b: { rol: 'Estudiante' } },
  { m: 'PATCH', p: '/api/projects/1/personal', h: center(), b: { nombreCompleto: 'X', cedula: 'abc' } },
  { m: 'PATCH', p: '/api/projects/1/personal', h: center(), b: 'no json' },
  { m: 'PATCH', p: '/api/projects/1/personal', h: center() },
  { m: 'PATCH', p: '/api/projects/1/personal', h: center(), b: { nombreCompleto: 'X'.repeat(201) } },
  { m: 'PATCH', p: '/api/projects/1/personal', h: center(), b: { nombreCompleto: 'X', rol: 'R'.repeat(81) } },
  { m: 'PATCH', p: '/api/projects/2/personal', h: center(), b: { nombreCompleto: 'X', rol: 'R' } },
  {
    m: 'PATCH',
    p: '/api/projects/1/personal',
    h: center(),
    b: { cedula: '7434389', nombreCompleto: 'ROBERTO', rol: 'Investigador' },
  },
  {
    m: 'PATCH',
    p: '/api/projects/1/personal',
    h: center(),
    b: { nombreCompleto: 'Luisa', rol: 'Semillerista' },
  },
  {
    m: 'PATCH',
    p: '/api/projects/1/personal',
    h: center(),
    b: { cedula: '9999999', nombreCompleto: 'Falla', rol: 'R' },
  },
  g('/api/projects/1'),
  g('/api/projects/1/personal', center()),
  { m: 'DELETE', p: '/api/projects/1/personal/abc', h: center() },
  { m: 'DELETE', p: '/api/projects/1/personal/7434389', h: center() },
  { m: 'DELETE', p: '/api/projects/1/personal/9999999', h: center() },
  { m: 'DELETE', p: '/api/projects/1/personal/%E0%A4%A', h: center() },
  { m: 'DELETE', p: '/api/projects/1/personal/7434389', h: center('otra') },
  // Ranking general, Top 12 / Top 60
  g('/api/ranking'),
  g('/api/ranking', T),
  g('/api/ranking', BAD),
  g('/api/ranking', { cookie: '$COOKIE' }),
  { m: 'PUT', p: '/api/ranking', h: BAD, b: { rows: [row('11111111', 'Ana', 1, 90)] } },
  { m: 'PUT', p: '/api/ranking', h: T, b: { rows: [] } },
  { m: 'PUT', p: '/api/ranking', h: T, b: 'no json' },
  { m: 'PUT', p: '/api/ranking', h: T },
  { m: 'PUT', p: '/api/ranking', h: T, b: { rows: 'x' } },
  { m: 'PUT', p: '/api/ranking', h: T, b: Buffer.alloc(1024 * 1024 + 1) },
  {
    m: 'PUT',
    p: '/api/ranking',
    h: T,
    b: {
      rows: [
        row('11111111', 'Ana', 3, 88.25, 'CU'),
        row('22222222', 'Luis', 1, 90),
        row('33333333', 'Juan', 2, 80),
        row('999', 'Nadie', 4, 70),
        row('22222222', 'Mal', 0, 50),
        { cc: '11111111', name: 5 },
      ],
    },
  },
  g('/api/ranking', T),
  g('/api/investigators?size=50'),
  g('/api/investigators?tier=top12'),
  { m: 'PUT', p: '/api/ranking/top12', h: T, b: { rows: [row('11111111', 'Ana', 1, 90)] } },
  { m: 'PUT', p: '/api/ranking/top60', h: T, b: { rows: [row('22222222', 'Luis', 1, 90)] } },
  g('/api/investigators?tier=top12'),
  g('/api/investigators?tier=top60'),
  { m: 'DELETE', p: '/api/ranking/top12', h: T },
  { m: 'DELETE', p: '/api/ranking/top12' },
  { m: 'GET', p: '/api/ranking/top12', h: T },
  { m: 'PUT', p: '/api/ranking/top99', h: T },
  { m: 'PUT', p: '/api/ranking/visibility', h: T, b: { ids: [1], visible: 'x' } },
  { m: 'PUT', p: '/api/ranking/visibility', h: T, b: { ids: 'x', visible: true } },
  { m: 'PUT', p: '/api/ranking/visibility', h: T, b: { ids: [1.5], visible: true } },
  { m: 'PUT', p: '/api/ranking/visibility', h: T, b: { ids: [0], visible: true } },
  { m: 'PUT', p: '/api/ranking/visibility', h: T, b: 'no json' },
  { m: 'PUT', p: '/api/ranking/visibility', h: T },
  {
    m: 'PUT',
    p: '/api/ranking/visibility',
    h: T,
    b: { ids: Array.from({ length: 10001 }, (_, i) => i + 1), visible: true },
  },
  { m: 'PUT', p: '/api/ranking/visibility', h: T, b: { ids: [1, 777], visible: false } },
  g('/api/ranking', T),
  g('/api/investigators'),
  { m: 'PUT', p: '/api/ranking/visibility', h: T, b: { ids: [1, 777], visible: true } },
  { m: 'PUT', p: '/api/ranking/777', h: T, b: { visible: false } },
  { m: 'PUT', p: '/api/ranking/1', h: T, b: { visible: 'x' } },
  { m: 'PUT', p: '/api/ranking/1', h: T, b: 'no json' },
  { m: 'PUT', p: '/api/ranking/1', h: T },
  { m: 'PUT', p: '/api/ranking/1', h: BAD, b: { visible: false } },
  { m: 'PUT', p: '/api/ranking/1', h: T, b: { visible: false } },
  g('/api/ranking', T),
  { m: 'PUT', p: '/api/ranking/1', h: T, b: { visible: true } },
  // Ranking de publicaciones
  { m: 'PUT', p: '/api/publications', b: { rows: [pub(1, '2-s2.0-1')] } },
  { m: 'PUT', p: '/api/publications', h: BAD, b: { rows: [pub(1, '2-s2.0-1')] } },
  { m: 'PUT', p: '/api/publications', h: T, b: { rows: [] } },
  { m: 'PUT', p: '/api/publications', h: T, b: 'no json' },
  { m: 'PUT', p: '/api/publications', h: T },
  { m: 'PUT', p: '/api/publications', h: T, b: Buffer.alloc(4 * 1024 * 1024 + 1) },
  {
    m: 'PUT',
    p: '/api/publications',
    h: T,
    b: {
      rows: [
        pub(1, '2-s2.0-1000001', { quartile: 'Q1', openAccess: true }),
        pub(2, '2-s2.0-85000000005', { doi: '10.1000/xyz' }),
        pub(5, '2-s2.0-85000000005'),
        pub(9, 'no-es-eid'),
        { rank: 7 },
      ],
    },
  },
  g('/api/publications'),
  g('/api/publications?q=paper%202&type=Article&from=2020&to=2024'),
  g('/api/publications?quartile=Q1'),
  g('/api/publications/stats'),
  { m: 'DELETE', p: '/api/publications' },
  { m: 'DELETE', p: '/api/publications', h: T },
  g('/api/publications'),
  // Rutas inexistentes con token (el orden 405 → 503 → 401 → resto)
  { m: 'DELETE', p: '/api/investigators/abc/photo', h: T },
  { m: 'DELETE', p: '/api/centers/1/resolutions/9', h: T },
  { m: 'DELETE', p: '/api/orcid/search', h: T },
  { m: 'PUT', p: '/api/relations/countries', h: T },
  // Particularidades actuales que el refactor debe conservar (aunque algunas sean discutibles):
  // PATCH en las rutas de subida las trata como PUT; HEAD no entra a las lecturas de admin; un cuerpo que
  // excede el tope llega como `null` y en algunas rutas equivale a «quitar» (website/password).
  { m: 'PATCH', p: '/api/investigators/1/photo', h: T, b: WEBP },
  { m: 'DELETE', p: '/api/investigators/1/photo', h: T },
  { m: 'PATCH', p: '/api/ranking', h: T, b: { rows: [row('11111111', 'Ana', 1, 90)] } },
  { m: 'PATCH', p: '/api/publications', h: T, b: { rows: [pub(1, '2-s2.0-1')] } },
  { m: 'PATCH', p: '/api/projects/1/photos/0', h: center(), b: WEBP },
  { m: 'DELETE', p: '/api/projects/1/photos/0', h: center() },
  { m: 'HEAD', p: '/api/ranking', h: T },
  { m: 'HEAD', p: '/api/centers/1/access', h: center() },
  { m: 'HEAD', p: '/api/projects/1/personal', h: center() },
  { m: 'PUT', p: '/api/centers/1/website', h: T, b: 'x'.repeat(2000) },
  { m: 'PUT', p: '/api/centers/1/website', h: T, b: 'null' },
  { m: 'PUT', p: '/api/centers/1/password', h: T, b: 'x'.repeat(2000) },
  { m: 'PUT', p: '/api/centers/1/password', h: T, b: 'null' },
  { m: 'PUT', p: '/api/ranking/1', h: T, b: 'x'.repeat(2000) },
  { m: 'PUT', p: '/api/ranking/visibility', h: T, b: Buffer.alloc(1024 * 1024 + 1) },
  { m: 'PUT', p: '/api/ranking/visibility', h: T, b: 'null' },
  { m: 'PATCH', p: '/api/projects/1/personal', h: center(), b: 'x'.repeat(2000) },
  { m: 'POST', p: '/api/admin/session', b: 'null' },
  { m: 'DELETE', p: '/api/ranking', h: T },
  { m: 'DELETE', p: '/api/publications', h: T },
];

// Sin token configurado: solo las rutas de escritura (503) y la sesión.
const noTokenCases: Case[] = [
  g('/api/admin/session'),
  { m: 'POST', p: '/api/admin/session', b: { token: TOKEN } },
  { m: 'DELETE', p: '/api/admin/session' },
  { m: 'PUT', p: '/api/investigators/1/photo', h: T, b: WEBP },
  { m: 'PUT', p: '/api/centers/1/website', h: T, b: { website: null } },
  g('/api/ranking', T),
  g('/api/centers/1/access', center()),
  { m: 'PUT', p: '/api/groups', h: T },
  g('/api/groups/14'),
];

const gzipCases: Case[] = [
  g('/api/projects/1', { 'Accept-Encoding': 'gzip' }),
  g('/api/projects/1', { 'Accept-Encoding': 'identity' }),
  g('/api/projects/1'),
  g('/api/groups/14', { 'Accept-Encoding': 'gzip' }),
  g('/api/projects', { 'Accept-Encoding': 'br, gzip;q=0.5' }),
  g('/api/centers/1/access', { ...center(), 'Accept-Encoding': 'gzip' }),
  { m: 'HEAD', p: '/api/projects/1', h: { 'Accept-Encoding': 'gzip' } },
];

const downCases: Case[] = [
  g('/api/groups'),
  g('/api/groups/14'),
  g('/api/groups/staffing'),
  g('/api/investigators'),
  g('/api/investigators/1'),
  g('/api/investigators/stats'),
  g('/api/centers'),
  g('/api/centers/1'),
  g('/api/projects'),
  g('/api/projects/1'),
  g('/api/publications'),
  g('/api/relations/countries'),
  g('/api/relations/by-year'),
  g('/api/relations/countries/ESP/publications'),
  g('/api/orcid/0000-0002-1825-0097'),
  g('/api/orcid/search?q=ana%20perez'),
  g('/api/centers/1/resolutions/9'),
  { m: 'PUT', p: '/api/centers/1/website', h: T, b: { website: null } },
  { m: 'PUT', p: '/api/centers/1/password', h: T, b: { password: PASS } },
  g('/api/centers/1/access', center()),
  { m: 'PUT', p: '/api/investigators/1/photo', h: T, b: WEBP },
  { m: 'PUT', p: '/api/projects/1/photos/0', h: center(), b: WEBP },
  g('/api/projects/1/personal', center()),
  { m: 'PATCH', p: '/api/projects/1/personal', h: center(), b: { nombreCompleto: 'X', rol: 'R' } },
  g('/api/ranking', T),
  { m: 'PUT', p: '/api/ranking', h: T, b: { rows: [row('11111111', 'Ana', 1, 90)] } },
  { m: 'PUT', p: '/api/publications', h: T, b: { rows: [pub(1, '2-s2.0-1')] } },
  g('/api/health'),
];

// Almacenes sin poder escribir: cada ruta con persistencia responde 500 con su propio mensaje.
const badStoreCases: Case[] = [
  { m: 'PUT', p: '/api/centers/1/password', h: T, b: { password: PASS } },
  { m: 'PUT', p: '/api/centers/1/website', h: T, b: { website: 'https://a.co' } },
  { m: 'PUT', p: '/api/ranking', h: T, b: { rows: [row('11111111', 'Ana', 1, 90)] } },
  { m: 'PUT', p: '/api/ranking/top12', h: T, b: { rows: [row('11111111', 'Ana', 1, 90)] } },
  { m: 'PUT', p: '/api/ranking/visibility', h: T, b: { ids: [1], visible: false } },
  { m: 'PUT', p: '/api/ranking/1', h: T, b: { visible: false } },
  { m: 'PUT', p: '/api/publications', h: T, b: { rows: [pub(1, '2-s2.0-1')] } },
  { m: 'PUT', p: '/api/investigators/1/photo', h: T, b: WEBP },
  { m: 'PUT', p: '/api/centers/1/logo', h: T, b: WEBP },
];

// ── Ejecución ────────────────────────────────────────────────────────────────────────────────────────
const dirs: string[] = [];
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cris-golden-'));
  dirs.push(d);
  return d;
};
const sha = (b: Buffer) => crypto.createHash('sha1').update(b).digest('hex');

async function run(opts: Parameters<typeof createPublicApi>[0], cases: Case[], withNext = false) {
  const handler = createPublicApi({
    metrikUrl: 'http://metrik/api',
    collabUrl: 'http://collab',
    orcidUrl: 'http://orcid/v3',
    ...opts,
  });
  const server = http.createServer(
    (req, res) =>
      void handler(
        req,
        res,
        withNext
          ? () => {
              res.statusCode = 299;
              res.end('NEXT');
            }
          : undefined,
      ),
  );
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const out: Record<string, unknown> = {};
  let cookie = '';
  try {
    for (const [i, c] of cases.entries()) {
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(c.h ?? {})) headers[k] = v.replace('$COOKIE', cookie);
      let body: BodyInit | undefined;
      if (c.b instanceof Uint8Array) body = new Uint8Array(c.b);
      else if (typeof c.b === 'string') body = c.b;
      else if (c.b !== undefined) {
        body = JSON.stringify(c.b);
        headers['Content-Type'] = 'application/json';
      }
      const key = `${String(i).padStart(3, '0')} ${c.m} ${c.p}${c.b instanceof Uint8Array ? ` [${c.b.length}B]` : ''}${Object.keys(c.h ?? {}).length ? ` {${Object.keys(c.h!).join(',')}}` : ''}`;
      try {
        const res = await fetch(base + c.p, { method: c.m, headers, body });
        const buf = Buffer.from(await res.arrayBuffer());
        const sc = res.headers.get('set-cookie');
        if (sc && /^cris_admin=\d+\./.test(sc) && !/Max-Age=0/.test(sc) && !cookie)
          cookie = sc.split(';')[0]!;
        const ct = res.headers.get('content-type') ?? '';
        let text: string | null = null;
        let hash: string | null = null;
        if (/json|text/.test(ct)) text = buf.toString('utf8');
        else hash = `${buf.length}B ${sha(buf)}`;
        const detailFix = (s: string) =>
          s
            .replace(/\?v=\d+/g, '?v=N')
            .replace(/(No se pudo[^"]*?:) [^"]*"/g, '$1 <error>"')
            // Mensajes del sistema de archivos (dependen del SO y de la ruta temporal).
            .replace(/(EEXIST|ENOTDIR|ENOENT|EPERM|EACCES)[^"]*"/g, '<fs-error>"');
        out[key] = {
          status: res.status,
          headers: Object.fromEntries(
            [
              'content-type',
              'cache-control',
              'content-encoding',
              'vary',
              'set-cookie',
              'content-disposition',
              'x-content-type-options',
            ]
              .map((h) => [h, res.headers.get(h)] as const)
              .filter(([, v]) => v !== null)
              .map(([h, v]) => [
                h,
                h === 'set-cookie'
                  ? v!.replace(/cris_admin=[^;]*/, (m) =>
                      m === 'cris_admin=' ? m : 'cris_admin=<exp>.<sig>',
                    )
                  : v,
              ]),
          ),
          body: text === null ? hash : detailFix(text),
        };
      } catch (err) {
        out[key] = { transportError: (err as Error).name };
      }
    }
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
  return out;
}

const scenarios: Record<string, () => Promise<Record<string, unknown>>> = {
  main: async () => {
    mode = 'ok';
    const d = tmp();
    return run(
      {
        photosDir: path.join(d, 'photos'),
        logosDir: path.join(d, 'logos'),
        projectPhotosDir: path.join(d, 'project-photos'),
        centerPasswordsFile: path.join(d, 'center-passwords.json'),
        sitesFile: path.join(d, 'center-sites.json'),
        rankingFile: path.join(d, 'ranking.json'),
        rankingHiddenFile: path.join(d, 'ranking-hidden.json'),
        publicationsFile: path.join(d, 'publications.json'),
        adminToken: TOKEN,
      },
      mainCases,
    );
  },
  gzip: async () => {
    mode = 'ok';
    const d = tmp();
    return run({ ...storeIn(d), adminToken: TOKEN, compress: true }, gzipCases);
  },
  noToken: async () => {
    mode = 'ok';
    return run({ ...storeIn(tmp()) }, noTokenCases);
  },
  down: async () => {
    mode = 'down';
    return run({ ...storeIn(tmp()), adminToken: TOKEN }, downCases);
  },
  badStore: async () => {
    mode = 'ok';
    const d = tmp();
    const blocker = path.join(d, 'blocker');
    fs.writeFileSync(blocker, 'x'); // un archivo donde debería haber un directorio: guardar falla
    return run(
      {
        photosDir: path.join(blocker, 'photos'),
        logosDir: path.join(blocker, 'logos'),
        projectPhotosDir: path.join(blocker, 'pp'),
        centerPasswordsFile: path.join(blocker, 'cp.json'),
        sitesFile: path.join(blocker, 'sites.json'),
        rankingFile: path.join(blocker, 'ranking.json'),
        rankingHiddenFile: path.join(blocker, 'hidden.json'),
        publicationsFile: path.join(blocker, 'pubs.json'),
        adminToken: TOKEN,
      },
      badStoreCases,
    );
  },
  badHidden: async () => {
    // Solo falla el almacén de ocultos: el ranking sí se guarda y las rutas de visibilidad llegan a su rama 500.
    mode = 'ok';
    const d = tmp();
    const blocker = path.join(d, 'blocker');
    fs.writeFileSync(blocker, 'x');
    return run({ ...storeIn(d), rankingHiddenFile: path.join(blocker, 'hidden.json'), adminToken: TOKEN }, [
      { m: 'PUT', p: '/api/ranking', h: T, b: { rows: [row('11111111', 'Ana', 1, 90)] } },
      { m: 'PUT', p: '/api/ranking/1', h: T, b: { visible: false } },
      { m: 'PUT', p: '/api/ranking/visibility', h: T, b: { ids: [1], visible: false } },
      g('/api/ranking', T),
    ]);
  },
  next: async () => {
    mode = 'ok';
    return run(
      { ...storeIn(tmp()), adminToken: TOKEN },
      [g('/'), g('/investigadores'), g('/assets/x.js'), g('/api/groups/14'), { m: 'POST', p: '/otra' }],
      true,
    );
  },
  noNext: async () => {
    mode = 'ok';
    return run({ ...storeIn(tmp()), adminToken: TOKEN }, [
      g('/'),
      g('/investigadores'),
      { m: 'POST', p: '/otra' },
    ]);
  },
};
function storeIn(d: string) {
  return {
    photosDir: path.join(d, 'photos'),
    logosDir: path.join(d, 'logos'),
    projectPhotosDir: path.join(d, 'project-photos'),
    centerPasswordsFile: path.join(d, 'center-passwords.json'),
    sitesFile: path.join(d, 'center-sites.json'),
    rankingFile: path.join(d, 'ranking.json'),
    rankingHiddenFile: path.join(d, 'ranking-hidden.json'),
    publicationsFile: path.join(d, 'publications.json'),
  };
}

beforeAll(() => void vi.stubGlobal('fetch', stubbedFetch));
afterAll(() => {
  vi.unstubAllGlobals();
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

test(
  'contrato HTTP de createPublicApi idéntico al registrado (estado, encabezados y cuerpo por ruta)',
  { timeout: 120_000 },
  async () => {
    const actual: Record<string, Record<string, unknown>> = {};
    for (const [name, scenario] of Object.entries(scenarios)) actual[name] = await scenario();
    if (UPDATE) {
      fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
      fs.writeFileSync(GOLDEN, JSON.stringify(actual, null, 2) + '\n');
      return;
    }
    const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8')) as typeof actual;
    const diffs: string[] = [];
    for (const name of new Set([...Object.keys(golden), ...Object.keys(actual)])) {
      for (const key of new Set([...Object.keys(golden[name] ?? {}), ...Object.keys(actual[name] ?? {})])) {
        const a = JSON.stringify(actual[name]?.[key]);
        const e = JSON.stringify(golden[name]?.[key]);
        if (a !== e) diffs.push(`[${name}] ${key}\n  esperado: ${e}\n  obtenido: ${a}`);
      }
    }
    expect(diffs).toEqual([]);
  },
);

// Corrección de seguridad e integridad de datos (cambio funcional deliberado, no parte de la refactorización):
// un cuerpo que excede el tope ya no se lee como `null` —que en estas rutas significa «quitar»—, responde 413 y
// no ejecuta ninguna escritura. Ausente, inválido y `null` explícito se distinguen.
test(
  'centros: un cuerpo excesivo responde 413 y deja intactas la contraseña y la página oficial',
  { timeout: 60_000 },
  async () => {
    mode = 'ok';
    const pad = 'x'.repeat(2000);
    const cases: Case[] = [
      { m: 'PUT', p: '/api/centers/1/password', h: T, b: { password: PASS } },
      g('/api/centers/1/access', center()),
      // Excesivos: ni texto suelto ni un JSON que traiga la orden de borrar entre el relleno.
      { m: 'PUT', p: '/api/centers/1/password', h: T, b: pad },
      { m: 'PUT', p: '/api/centers/1/password', h: T, b: JSON.stringify({ password: null, pad }) },
      g('/api/centers/1/access', center()), // la contraseña sigue siendo la misma
      { m: 'PUT', p: '/api/centers/1/password', h: T, b: {} }, // ausente → 400
      { m: 'PUT', p: '/api/centers/1/password', h: T, b: 'no json' }, // inválido → 400
      { m: 'PUT', p: '/api/centers/1/password', h: T, b: 'null' }, // JSON que no es un objeto → 400
      g('/api/centers/1/access', center()), // y los 400 tampoco la tocaron
      { m: 'PUT', p: '/api/centers/1/website', h: T, b: { website: 'www.cu.co' } },
      { m: 'PUT', p: '/api/centers/1/website', h: T, b: pad },
      { m: 'PUT', p: '/api/centers/1/website', h: T, b: JSON.stringify({ website: null, pad }) },
      g('/api/centers/1'), // la página oficial sigue ahí
      { m: 'PUT', p: '/api/centers/1/website', h: T, b: {} },
      { m: 'PUT', p: '/api/centers/1/website', h: T, b: 'no json' },
      g('/api/centers/1'),
      { m: 'PUT', p: '/api/centers/1/website', h: T, b: { website: null } }, // `null` explícito sí quita
      g('/api/centers/1'),
      { m: 'PUT', p: '/api/centers/1/password', h: T, b: { password: null } },
      g('/api/centers/1/access', center()),
    ];
    const out = Object.values(await run({ ...storeIn(tmp()), adminToken: TOKEN }, cases)) as {
      status: number;
      body: string;
    }[];
    const status = out.map((r) => r.status);
    expect(status).toEqual([
      200, 200, 413, 413, 200, 400, 400, 400, 200, 200, 413, 413, 200, 400, 400, 200, 200, 200, 200, 403,
    ]);
    expect(JSON.parse(out[2]!.body)).toEqual({ detail: 'La solicitud supera 1 KB' });
    expect(JSON.parse(out[12]!.body).website).toBe('https://www.cu.co/');
    expect(JSON.parse(out[15]!.body).website).toBe('https://www.cu.co/');
    expect(JSON.parse(out[17]!.body).website).toBeNull();
  },
);
