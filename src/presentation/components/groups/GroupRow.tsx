import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { authorSlug, displayName } from '@/domain/authors/author';
import type { Group } from '@/domain/groups/group';
import { categoryTone } from './category-tone';
import { Icon } from '@/presentation/components/ui/Icon';
import { useLabels } from '@/presentation/hooks/use-labels';

/** Metri-K: `type` = "Institucional" | "Interinstitucional" (o vacío). */
const isInter = (g: Group) => /^interinstitucional$/i.test(g.type?.trim() ?? '');

/** Fila de la vista en lista: densa y escaneable; toda la fila enlaza al detalle. */
export function GroupRow({ group }: { group: Group }) {
  const { t } = useTranslation('groups');
  const labels = useLabels();
  return (
    <li className="group relative grid grid-cols-[3.25rem_1fr_auto] items-center gap-4 px-4 py-4 transition-colors hover:bg-surface-cream-alt/60 md:grid-cols-[3.25rem_minmax(0,1fr)_14rem_5rem_5rem_9rem_1.5rem] lg:grid-cols-[3.25rem_minmax(0,1fr)_14rem_9.5rem_5rem_5rem_9rem_1.5rem] md:px-5">
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-xl text-label-md font-bold ${categoryTone(group.category)}`}
      >
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
            {` · ${t('card.linesCount', { count: group.lines.length })}`}
          </span>
          {/* Interinstitucional: en móvil y tableta va aquí; en escritorio tiene su columna. */}
          {isInter(group) ? <span className="lg:hidden">{` · ${labels.domain(group.type!)}`}</span> : null}
        </p>
      </div>

      <p className="hidden truncate text-body-sm text-on-surface-variant md:block">
        {group.leader ? displayName(group.leader.name) : '—'}
      </p>
      <p className="hidden lg:block">
        {group.type ? (
          // Solo icono; el texto va en el tooltip y para lectores de pantalla. z-10: por encima del
          // enlace que cubre la fila, para que el tooltip aparezca al pasar el mouse.
          <span className="group/type relative z-10 inline-flex">
            <span
              tabIndex={0}
              className={`flex h-9 w-9 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-secondary ${
                isInter(group)
                  ? 'bg-badge-sage-bg text-secondary'
                  : 'bg-surface-cream-alt text-on-surface-variant'
              }`}
            >
              <Icon name={isInter(group) ? 'handshake' : 'account_balance'} className="text-[20px]" />
              <span className="sr-only">{labels.domain(group.type)}</span>
            </span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-md bg-surface-dark-forest px-2.5 py-1 text-label-sm font-semibold whitespace-nowrap text-on-primary opacity-0 shadow-md transition-opacity group-hover/type:opacity-100 group-focus-within/type:opacity-100"
            >
              {labels.domain(group.type)}
            </span>
          </span>
        ) : (
          <span className="text-body-sm text-neutral-muted">—</span>
        )}
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
  const { t } = useTranslation('groups');
  return (
    <div
      aria-hidden="true"
      className="hidden grid-cols-[3.25rem_minmax(0,1fr)_14rem_5rem_5rem_9rem_1.5rem] lg:grid-cols-[3.25rem_minmax(0,1fr)_14rem_9.5rem_5rem_5rem_9rem_1.5rem] gap-4 border-b border-border-subtle px-5 py-3 text-[10px] font-semibold tracking-wider text-neutral-muted uppercase md:grid"
    >
      <span>{t('card.colCategory')}</span>
      <span>{t('card.colGroup')}</span>
      <span>{t('card.leader')}</span>
      <span className="hidden lg:block">{t('card.colInter')}</span>
      <span>{t('card.lines')}</span>
      <span>{t('card.founded')}</span>
      <span>{t('card.city')}</span>
      <span />
    </div>
  );
}
