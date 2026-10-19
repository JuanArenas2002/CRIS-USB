import { Link } from 'react-router';
import { authorSlug, displayName } from '@/domain/authors/author';
import type { Group } from '@/domain/groups/group';
import { Icon } from '@/presentation/components/ui/Icon';

/** Fila de la vista en lista: densa y escaneable; toda la fila enlaza al detalle. */
export function GroupRow({ group }: { group: Group }) {
  return (
    <li className="group relative grid grid-cols-[3.25rem_1fr_auto] items-center gap-4 px-4 py-4 transition-colors hover:bg-surface-cream-alt/60 md:grid-cols-[3.25rem_minmax(0,1fr)_14rem_5rem_5rem_9rem_1.5rem] md:px-5">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-dark-forest text-label-md font-bold text-secondary-fixed">
        {group.category ?? '—'}
      </span>

      <div className="min-w-0">
        <h3 className="text-body-md font-semibold text-[#0F241A] group-hover:text-primary">
          <Link
            to={`/grupos/${authorSlug(group)}`}
            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-secondary"
          >
            {group.name}
          </Link>
        </h3>
        <p className="mt-0.5 text-label-sm text-neutral-muted">
          {group.code}
          {/* En móvil, los datos de las columnas van en esta línea. */}
          <span className="md:hidden">
            {group.leader ? ` · ${displayName(group.leader.name)}` : ''}
            {` · ${group.lines.length} líneas`}
          </span>
        </p>
      </div>

      <p className="hidden truncate text-body-sm text-on-surface-variant md:block">
        {group.leader ? displayName(group.leader.name) : '—'}
      </p>
      <p className="hidden text-body-sm text-on-surface md:block">
        <span className="font-semibold">{group.lines.length}</span>
      </p>
      <p className="hidden text-body-sm text-on-surface md:block">{group.foundedYear ?? '—'}</p>
      <p className="hidden truncate text-body-sm text-on-surface-variant md:block">
        {group.city ? displayName(group.city) : '—'}
      </p>
      <Icon name="chevron_right" className="text-[20px] text-neutral-muted group-hover:text-primary" />
    </li>
  );
}

/** Encabezado de columnas (solo escritorio), alineado con la grilla de GroupRow. */
export function GroupRowHeader() {
  return (
    <div
      aria-hidden="true"
      className="hidden grid-cols-[3.25rem_minmax(0,1fr)_14rem_5rem_5rem_9rem_1.5rem] gap-4 border-b border-border-subtle px-5 py-3 text-[10px] font-semibold tracking-wider text-neutral-muted uppercase md:grid"
    >
      <span>Cat.</span>
      <span>Grupo</span>
      <span>Líder</span>
      <span>Líneas</span>
      <span>Fundado</span>
      <span>Sede</span>
      <span />
    </div>
  );
}
