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

/** Logo: sin recortar y con su transparencia, a lo sumo 512 px por lado. */
export async function toLogoWebp(file: Blob): Promise<Blob> {
  const img = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close();
  return toWebp(canvas);
}

async function call(
  method: 'PUT' | 'DELETE',
  path: string,
  token: string,
  body?: Blob,
): Promise<string | null> {
  const res = await fetch(path, {
    method,
    headers: { 'X-Admin-Token': token, ...(body ? { 'Content-Type': 'image/webp' } : {}) },
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

const photoPath = (id: number) => `/api/investigators/${id}/photo`;
const logoPath = (id: number) => `/api/centers/${id}/logo`;
export const uploadPhoto = (id: number, photo: Blob, token: string) =>
  call('PUT', photoPath(id), token, photo);
export const deletePhoto = (id: number, token: string) => call('DELETE', photoPath(id), token);
export const uploadLogo = (id: number, logo: Blob, token: string) => call('PUT', logoPath(id), token, logo);
export const deleteLogo = (id: number, token: string) => call('DELETE', logoPath(id), token);

/** Página oficial del centro; null o "" la quitan. Devuelve la URL normalizada por el BFF. */
export async function saveCenterWebsite(id: number, website: string | null, token: string) {
  const res = await fetch(`/api/centers/${id}/website`, {
    method: 'PUT',
    headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ website }),
  });
  const data = (await res.json().catch(() => ({}))) as { website?: string | null; detail?: string };
  if (!res.ok) throw new ApiError(res.status, data.detail ?? `Error ${res.status}`);
  return data.website ?? null;
}
