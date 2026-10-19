import { useTranslation } from 'react-i18next';
import { odsIcon, type OdsId } from '@/domain/ods/ods';

/**
 * Icono oficial de un ODS. El icono ya trae número y nombre; el texto alternativo lo repite para
 * lectores de pantalla y el tooltip lo muestra en hover y foco.
 */
export function OdsIcon({ id, size = 64, note }: { id: OdsId; size?: number; note?: string }) {
  const { t } = useTranslation('groups');
  const name = t(`ods.names.goal${id}.name`);
  const prefix = t('ods.prefix');
  return (
    <span className="group/ods relative inline-flex shrink-0">
      <img
        src={odsIcon(id)}
        alt={`${prefix} ${id}: ${name}${note ? ` (${note})` : ''}`}
        width={size}
        height={size}
        loading="lazy"
        tabIndex={0}
        className="rounded-md shadow-xs transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container"
        style={{ width: size, height: size }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded-md bg-surface-dark-forest px-2.5 py-1.5 text-center text-label-sm font-semibold whitespace-nowrap text-on-primary opacity-0 shadow-md transition-opacity group-focus-within/ods:opacity-100 group-hover/ods:opacity-100"
      >
        <span className="block">
          {prefix} {id} · {name}
        </span>
        {note ? <span className="block text-[10px] font-normal text-secondary-fixed">{note}</span> : null}
      </span>
    </span>
  );
}

/** Bloque "ODS vinculados" de la plantilla de grupo: icono oficial + etiqueta corta. */
export function OdsLinked({
  ods,
  empty,
}: {
  ods: OdsId[];
  /** Texto si no hay ODS (por defecto, el de grupos). */ empty?: string;
}) {
  const { t } = useTranslation('groups');
  if (!ods.length)
    return (
      <p className="rounded-lg bg-canvas-cream p-4 text-body-sm text-neutral-muted">
        {empty ?? t('ods.none')}
      </p>
    );
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-3">
      {ods.map((id) => (
        <li key={id} className="flex w-16 flex-col items-center gap-1.5">
          <OdsIcon id={id} />
          <span aria-hidden="true" className="text-center text-[12px] font-medium text-on-surface-variant">
            {t(`ods.names.goal${id}.short`)}
          </span>
        </li>
      ))}
    </ul>
  );
}
