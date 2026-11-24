// «Qué sigue» del editor de noticias: etapa y texto según el estado y los permisos (funciones puras).
import type { News } from '@/infrastructure/news/news-api';
import { fmtDate } from '../ui';

// Mismo criterio que el backend: tras la revisión solo se curan estos campos (con news.curate).
export const EDITABLE_STATUSES = new Set(['draft', 'rejected']);

export type Stage = 'draft' | 'in_review' | 'approved' | 'live' | 'archived';

/** Etapa del flujo: una noticia nueva o rechazada vuelve a ser borrador; programada y publicada comparten etapa. */
export function stageOf(news: News | undefined): Stage {
  const status = news?.status ?? 'draft';
  if (!news || status === 'draft' || status === 'rejected') return 'draft';
  if (status === 'in_review') return 'in_review';
  if (status === 'approved') return 'approved';
  if (status === 'scheduled' || status === 'published') return 'live';
  return 'archived';
}

/** Falta algo para guardar y la noticia aún se puede editar. */
export const isBlocked = (todo: string[], news: News | undefined) =>
  todo.length > 0 && (!news || EDITABLE_STATUSES.has(news.status));

/** Vencida: tiene fecha de fin y ya pasó (ya no se muestra en el portal). */
export const isExpired = (news: Pick<News, 'end_at'>, now = new Date()) =>
  !!news.end_at && new Date(news.end_at) < now;

type Can = (code: string) => boolean;

/** La frase que explica qué puede pasar ahora con la noticia. */
export function stageText(news: News | undefined, can: Can, now = new Date()): string {
  switch (stageOf(news)) {
    case 'draft':
      return news
        ? 'Cuando esté lista, envíala a revisión. Puedes guardar el borrador las veces que quieras.'
        : 'Escribe la noticia y guárdala como borrador. Después podrás enviarla a revisión.';
    case 'in_review':
      return can('news.approve') || can('news.review')
        ? 'Revisa el contenido: apruébala si está lista o pide cambios explicando qué corregir.'
        : 'Esperando que un revisor la apruebe o pida cambios.';
    case 'approved':
      return can('news.publish')
        ? 'Está aprobada. Publícala ahora o programa la fecha en que debe aparecer.'
        : 'Aprobada: esperando publicación.';
    case 'live':
      return liveText(news!, now);
    case 'archived':
      return 'Archivada: no aparece en el portal. Se conserva con su historial.';
  }
}

function liveText(news: News, now: Date) {
  if (news.status === 'scheduled') return `Se publicará automáticamente el ${fmtDate(news.start_at)}.`;
  if (isExpired(news, now)) return `Vencida el ${fmtDate(news.end_at)}: ya no se muestra en el portal.`;
  const until = news.end_at ? ` hasta ${fmtDate(news.end_at)}` : '';
  return `Visible en el portal desde ${fmtDate(news.published_at)}${until}.`;
}
