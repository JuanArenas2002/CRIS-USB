import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { authorSlug, displayName } from '@/domain/authors/author';
import { hasPublicDetail, isInterinstitutional, type Group } from '@/domain/groups/group';
import { categoryTone } from './category-tone';
import { GroupTypeIcon } from './GroupTypeIcon';
import { Icon } from '@/presentation/components/ui/Icon';
import { useLabels } from '@/presentation/hooks/use-labels';

/** Fila de la vista en lista: densa y escaneable; toda la fila enlaza al detalle (si es público). */
export function GroupRow({ group }: { group: Group }) {
  const { t } = useTranslation('groups');
  const labels = useLabels();
  const linked = hasPublicDetail(group);
  return (
    <li className="group relative grid grid-cols-[3.25rem_1fr_auto] items-center gap-4 px-4 py-4 transition-colors hover:bg-surface-cream-alt/60 lg:grid-cols-[3.25rem_minmax(0,1fr)_14rem_5rem_5rem_9rem_1.5rem] xl:grid-cols-[3.25rem_minmax(0,1fr)_14rem_9.5rem_5rem_5rem_9rem_1.5rem] lg:px-5">
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-xl text-label-md font-bold ${categoryTone(group.category)}`}
      >
        {group.category ?? '—'}
      </span>

      <div className="min-w-0">
        <h3
          className={`text-body-md font-semibold text-[#0F241A] ${linked ? 'group-hover:text-primary' : ''}`}
        >
          {linked ? (
            <Link
              to={`/grupos/${authorSlug(group)}`}
              className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-secondary"
            >
              {group.name}
            </Link>
          ) : (
            group.name
          )}
        </h3>
        <p className="mt-0.5 text-label-sm text-neutral-muted">
          {group.code}
          {/* En móvil y tableta, los datos de las columnas van en esta línea. */}
          <span className="lg:hidden">
            {group.leader ? ` · ${displayName(group.leader.name)}` : ''}
            {` · ${t('card.linesCount', { count: group.lines.length })}`}
          </span>
          {/* Interinstitucional: hasta escritorio grande va aquí; luego tiene su columna. */}
          {isInterinstitutional(group) ? (
            <span className="xl:hidden">{` · ${labels.domain(group.type!)}`}</span>
          ) : null}
        </p>
      </div>

      <p className="hidden truncate text-body-sm text-on-surface-variant lg:block">
        {group.leader ? displayName(group.leader.name) : '—'}
      </p>
      <p className="hidden xl:block">
        {group.type ? (
          <GroupTypeIcon group={group} />
        ) : (
          <span className="text-body-sm text-neutral-muted">—</span>
        )}
      </p>
      <p className="hidden text-body-sm text-on-surface lg:block">
        <span className="font-semibold">{group.lines.length}</span>
      </p>
      <p className="hidden text-body-sm text-on-surface lg:block">{group.foundedYear ?? '—'}</p>
      <p className="hidden truncate text-body-sm text-on-surface-variant lg:block">
        {group.city ? displayName(group.city) : '—'}
      </p>
      {linked ? (
        <Icon name="chevron_right" className="text-[20px] text-neutral-muted group-hover:text-primary" />
      ) : (
        <span />
      )}
    </li>
  );
}

/** Encabezado de columnas (solo escritorio), alineado con la grilla de GroupRow. */
export function GroupRowHeader() {
  const { t } = useTranslation('groups');
  return (
    <div
      aria-hidden="true"
      className="hidden grid-cols-[3.25rem_minmax(0,1fr)_14rem_5rem_5rem_9rem_1.5rem] xl:grid-cols-[3.25rem_minmax(0,1fr)_14rem_9.5rem_5rem_5rem_9rem_1.5rem] gap-4 border-b border-border-subtle px-5 py-3 text-[10px] font-semibold tracking-wider text-neutral-muted uppercase lg:grid"
    >
      <span>{t('card.colCategory')}</span>
      <span>{t('card.colGroup')}</span>
      <span>{t('card.leader')}</span>
      <span className="hidden xl:block">{t('card.colInter')}</span>
      <span>{t('card.lines')}</span>
      <span>{t('card.founded')}</span>
      <span>{t('card.city')}</span>
      <span />
    </div>
  );
}
