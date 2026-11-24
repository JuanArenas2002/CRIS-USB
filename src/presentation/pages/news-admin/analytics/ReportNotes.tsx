import type { Overview } from '@/infrastructure/news/analytics-api';
import { fmtRange } from './format';

export function Definitions({ minViews }: { minViews: number }) {
  return (
    <details className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 text-body-sm text-on-surface-variant print:hidden">
      <summary className="cursor-pointer font-semibold text-on-surface">Metodología: ¿cómo se mide?</summary>
      <ul className="mt-3 list-disc space-y-1 pl-5">
        <li>
          <b>Visualización</b> (dato registrado): una noticia abierta en una sesión. Recargar no suma. Se
          excluyen bots, noticias no publicadas y lectores que no autorizaron la analítica.
        </li>
        <li>
          <b>Sesión</b>: una pestaña del navegador mientras está abierta (identificador aleatorio, sin
          cookies).
        </li>
        <li>
          <b>Visitantes únicos</b> (estimado): seudónimo diario que no identifica a nadie; en varios días es
          la suma de los únicos de cada día.
        </li>
        <li>
          <b>Lectura</b> (calculado): tiempo con actividad real y la pestaña visible, medido por el servidor
          cada 15 s. Comprometida = 30 s o más.
        </li>
        <li>
          <b>Compartidos</b>: clics en las opciones de compartir; no es posible saber si se publicaron.
        </li>
        <li>
          Los promedios por noticia se ordenan con al menos {minViews} visualizaciones. Las variaciones
          comparan con el periodo anterior de igual duración.
        </li>
      </ul>
    </details>
  );
}

/** Pie del informe impreso: cuándo se generó y con qué periodo (solo en papel/PDF). */
export function PrintFooter({ data }: { data: Overview }) {
  return (
    <p className="hidden text-label-sm text-neutral-muted print:block">
      Informe generado el {new Date().toLocaleString('es-CO')} · Periodo{' '}
      {fmtRange(data.period.start, data.period.end)} · Portal de investigación, Universidad Simón Bolívar.
    </p>
  );
}
