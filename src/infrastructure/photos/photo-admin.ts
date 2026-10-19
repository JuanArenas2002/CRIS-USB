// Administración de fotos (vista oculta /admin/fotos). El navegador recorta y convierte la imagen
// con canvas (sin dependencias); el BFF valida y la guarda.
import { ApiError } from '@/infrastructure/http/api-client';

const SIDE = 512;

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
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen'))),
      'image/webp',
      0.85,
    ),
  );
}

async function call(
  method: 'PUT' | 'DELETE',
  id: number,
  token: string,
  body?: Blob,
): Promise<string | null> {
  const res = await fetch(`/api/investigators/${id}/photo`, {
    method,
    headers: { 'X-Admin-Token': token, ...(body ? { 'Content-Type': 'image/webp' } : {}) },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as { photoUrl?: string | null; detail?: string };
  if (!res.ok) throw new ApiError(res.status, data.detail ?? `Error ${res.status}`);
  return data.photoUrl ?? null;
}

export const uploadPhoto = (id: number, photo: Blob, token: string) => call('PUT', id, token, photo);
export const deletePhoto = (id: number, token: string) => call('DELETE', id, token);
