// Asignación de ODS a grupos (vista oculta /admin/ods). El BFF valida y guarda; Metri-K aún no los tiene.
import { normalizeOds, type OdsId } from '@/domain/ods/ods';
import { ApiError } from '@/infrastructure/http/api-client';

export async function saveGroupOds(groupId: number, ods: OdsId[], token: string): Promise<OdsId[]> {
  const res = await fetch(`/api/groups/${groupId}/ods`, {
    method: 'PUT',
    headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ods }),
  });
  const data = (await res.json().catch(() => ({}))) as { ods?: unknown; detail?: string };
  if (!res.ok) throw new ApiError(res.status, data.detail ?? `Error ${res.status}`);
  return normalizeOds(data.ods);
}
