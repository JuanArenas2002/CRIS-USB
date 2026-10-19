import { isInterinstitutional, type Group } from '@/domain/groups/group';
import { Icon } from '@/presentation/components/ui/Icon';
import { useLabels } from '@/presentation/hooks/use-labels';

/**
 * Tipo de grupo como icono: edificio = institucional, apretón de manos = interinstitucional.
 * El texto va en un tooltip (hover y foco) y para lectores de pantalla. `relative z-10` lo deja por
 * encima del enlace que cubre filas y tarjetas, para que el tooltip responda al mouse.
 */
export function GroupTypeIcon({ group }: { group: Pick<Group, 'type'> }) {
  const labels = useLabels();
  if (!group.type) return null;
  const inter = isInterinstitutional(group);
  const label = labels.domain(group.type);
  return (
    <span className="group/type relative z-10 inline-flex">
      <span
        tabIndex={0}
        className={`flex h-9 w-9 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-secondary ${
          inter ? 'bg-badge-sage-bg text-secondary' : 'bg-surface-cream-alt text-on-surface-variant'
        }`}
      >
        <Icon name={inter ? 'handshake' : 'account_balance'} className="text-[20px]" />
        <span className="sr-only">{label}</span>
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-md bg-surface-dark-forest px-2.5 py-1 text-label-sm font-semibold whitespace-nowrap text-on-primary opacity-0 shadow-md ring-1 ring-white/20 transition-opacity group-focus-within/type:opacity-100 group-hover/type:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
