import { withBase } from '@/shared/base';
// Administración de fotos y logos (vistas ocultas /admin/fotos y /admin/centros). El navegador
// recorta y convierte la imagen con canvas (sin dependencias); el BFF valida y la guarda.
import { ApiError } from '@/infrastructure/http/api-client';

const SIDE = 512;

const toWebp = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen'))),
      'image/webp',
      0.85,
    ),
  );

/** Cuadrado de 512 px en WebP. En retratos verticales se sesga hacia arriba para no cortar la cara. */
export async function toSquareWebp(file: Blob): Promise<Blob> {
  const img = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) * 0.2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIDE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; // PNG con transparencia → fondo blanco
  ctx.fillRect(0, 0, SIDE, SIDE);
  ctx.drawImage(img, sx, sy, side, side, 0, 0, SIDE, SIDE);
  img.close();
  return toWebp(canvas);
}

/** Logo: sin recortar y con su transparencia, a lo sumo `side` px por lado (512 por defecto). */
export async function toLogoWebp(file: Blob, side = SIDE): Promise<Blob> {
  const img = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, side / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close();
  return toWebp(canvas);
}

/** Centro elegido en /admin/proyectos/fotos y su contraseña (la del director). */
export interface CenterKey {
  id: number;
  password: string;
}
// encodeURIComponent: una cabecera HTTP no admite tildes ni ñ tal cual.
const centerHeaders = (c: CenterKey) => ({
  'X-Center-Id': String(c.id),
  'X-Center-Password': encodeURIComponent(c.password),
});

async function call(
  method: 'PUT' | 'DELETE',
  path: string,
  token: string,
  body?: Blob,
  center?: CenterKey,
): Promise<string | null> {
  const res = await fetch(path, {
    method,
    headers: {
      'X-Admin-Token': token,
      ...(body ? { 'Content-Type': 'image/webp' } : {}),
      ...(center ? centerHeaders(center) : {}),
    },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as {
    photoUrl?: string | null;
    logoUrl?: string | null;
    detail?: string;
  };
  if (!res.ok) throw new ApiError(res.status, data.detail ?? `Error ${res.status}`);
  return data.photoUrl ?? data.logoUrl ?? null;
}

const photoPath = (id: number) => withBase(`/api/investigators/${id}/photo`);
const logoPath = (id: number) => withBase(`/api/centers/${id}/logo`);
export const uploadPhoto = (id: number, photo: Blob, token: string) =>
  call('PUT', photoPath(id), token, photo);
export const deletePhoto = (id: number, token: string) => call('DELETE', photoPath(id), token);
export const uploadLogo = (id: number, logo: Blob, token: string) => call('PUT', logoPath(id), token, logo);
export const deleteLogo = (id: number, token: string) => call('DELETE', logoPath(id), token);

/** Fotos de proyecto sin recortar: 1280 px por lado deja una foto nítida por debajo de 1 MB. */
export const toProjectPhotoWebp = (file: Blob) => toLogoWebp(file, 1280);
/** `slot` 0 = foto principal; 1…12 = galería. */
const projectPhotoPath = (id: number, slot: number) => withBase(`/api/projects/${id}/photos/${slot}`);
export const uploadProjectPhoto = (id: number, slot: number, photo: Blob, token: string, center: CenterKey) =>
  call('PUT', projectPhotoPath(id, slot), token, photo, center);
export const deleteProjectPhoto = (id: number, slot: number, token: string, center: CenterKey) =>
  call('DELETE', projectPhotoPath(id, slot), token, undefined, center);

/** true si la contraseña es la del centro (401 = token inválido, se propaga). */
export async function checkCenterAccess(center: CenterKey, token: string) {
  const res = await fetch(withBase(`/api/centers/${center.id}/access`), {
    headers: { 'X-Admin-Token': token, ...centerHeaders(center) },
  });
  if (res.status === 401) throw new ApiError(401, 'Token de administración inválido');
  return res.ok;
}

/** Contraseña de fotos de proyectos del centro; null la quita (nadie podrá subir fotos). */
export async function saveCenterPassword(id: number, password: string | null, token: string) {
  const res = await fetch(withBase(`/api/centers/${id}/password`), {
    method: 'PUT',
    headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = (await res.json().catch(() => ({}))) as { detail?: string };
  if (!res.ok) throw new ApiError(res.status, data.detail ?? `Error ${res.status}`);
}

/** Página oficial del centro; null o "" la quitan. Devuelve la URL normalizada por el BFF. */
export async function saveCenterWebsite(id: number, website: string | null, token: string) {
  const res = await fetch(withBase(`/api/centers/${id}/website`), {
    method: 'PUT',
    headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ website }),
  });
  const data = (await res.json().catch(() => ({}))) as { website?: string | null; detail?: string };
  if (!res.ok) throw new ApiError(res.status, data.detail ?? `Error ${res.status}`);
  return data.website ?? null;
}

/** Integrante del equipo tal como lo guarda Metri-K (con cédula: solo el admin del centro la ve). */
export interface ProjectStaff {
  cedula: string | null;
  nombreCompleto: string;
  rol: string | null;
}

async function staffCall(path: string, token: string, center: CenterKey, init: RequestInit = {}) {
  const res = await fetch(withBase(path), {
    ...init,
    headers: {
      'X-Admin-Token': token,
      ...centerHeaders(center),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as ProjectStaff[] & { detail?: string };
  if (!res.ok) throw new ApiError(res.status, data.detail ?? `Error ${res.status}`);
  return data as ProjectStaff[];
}

/** Equipo del proyecto en Metri-K (lectura en vivo, con cédulas). */
export const listStaff = (projectId: number, token: string, center: CenterKey) =>
  staffCall(`/api/projects/${projectId}/personal`, token, center);
/** Agrega una persona (la cédula es opcional); devuelve el equipo actualizado. */
export const addStaff = (projectId: number, person: ProjectStaff, token: string, center: CenterKey) =>
  staffCall(`/api/projects/${projectId}/personal`, token, center, {
    method: 'PATCH',
    body: JSON.stringify(person),
  });
/** Quita a una persona por cédula; devuelve el equipo actualizado. */
export const removeStaff = (projectId: number, cedula: string, token: string, center: CenterKey) =>
  staffCall(`/api/projects/${projectId}/personal/${encodeURIComponent(cedula)}`, token, center, {
    method: 'DELETE',
  });
