import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { authorSlug, displayName } from '@/domain/authors/author';
import type { Center } from '@/domain/centers/center';
import { odsOf, type OdsId } from '@/domain/ods/ods';
import { Icon } from '@/presentation/components/ui/Icon';

export const centerPath = (c: Pick<Center, 'id' | 'name'>) => `/centros/${authorSlug(c)}`;

/** Estado del centro: punto verde "Activo" o pausa "Inactivo" (registro histórico). */
export function CenterStatus({ active }: { active: boolean }) {
  const { t } = useTranslation('centers');
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-badge-sage-bg px-2.5 py-0.5 text-label-sm font-semibold text-badge-sage-text">
      <span className="h-1.5 w-1.5 rounded-full bg-secondary" /> {t('active')}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-error-container px-2.5 py-0.5 text-label-sm font-semibold text-[#93000a]">
      <Icon name="pause_circle" className="text-[13px]" /> {t('inactive')}
    </span>
  );
}

/** Chips de ODS con el color oficial de cada objetivo; los que no caben se resumen en "+N". */
export function OdsChips({ ods, max = 3 }: { ods: OdsId[]; max?: number }) {
  const { t } = useTranslation(['centers', 'groups']);
  if (!ods.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {ods.slice(0, max).map((id) => (
        <li
          key={id}
          title={t(`groups:ods.names.goal${id}.name`)}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#E7E2D6] bg-white px-2 py-0.5 text-label-sm text-neutral-muted"
        >
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: odsOf(id).color }}
          />
          <span className="font-semibold text-on-surface">
            {t('groups:ods.prefix')} {id}
          </span>
          {t(`groups:ods.names.goal${id}.short`)}
        </li>
      ))}
      {ods.length > max ? (
        <li className="inline-flex items-center rounded-full bg-surface-cream-alt px-2 py-0.5 text-label-sm font-semibold text-on-surface-variant">
          {t('card.moreOds', { count: ods.length - max })}
        </li>
      ) : null}
    </ul>
  );
}

/** Tarjeta del directorio: misma anatomía que GroupCard (la sigla ocupa el lugar de la categoría). */
export function CenterCard({ center: c }: { center: Center }) {
  const { t } = useTranslation('centers');
  const metrics = [
    { icon: 'link', label: t('card.lines'), value: c.linesCount || '—' },
    { icon: 'event', label: t('card.founded'), value: c.foundedYear ?? '—' },
    { icon: 'location_on', label: t('card.city'), value: c.city ? displayName(c.city) : '—' },
  ];

  return (
    <article className="group relative flex flex-col justify-between rounded-[24px] bg-surface-container-lowest p-4 shadow-[0_4px_20px_-2px_rgba(21,71,52,0.06),0_2px_6px_-1px_rgba(0,0,0,0.03)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_28px_-4px_rgba(21,71,52,0.12)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex flex-col">
        <div
          className={`relative overflow-hidden rounded-[20px] p-5 text-on-primary ${
            c.active ? 'bg-surface-dark-forest' : 'bg-[#3d4a44]'
          }`}
        >
          <svg
            aria-hidden="true"
            className="absolute inset-0 h-full w-full text-secondary-fixed/45"
            fill="none"
            viewBox="0 0 400 160"
            preserveAspectRatio="none"
          >
            <path
              d="M-20 120C80 70 170 150 260 100C350 50 380 110 440 80"
              stroke="currentColor"
              strokeWidth="2.5"
              className="wave-drift"
            />
            <path
              d="M-20 40C90 90 200 10 300 60C360 90 400 40 440 30"
              stroke="currentColor"
              strokeDasharray="6 6"
              strokeWidth="2"
              className="wave-dash"
            />
          </svg>
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <span className="text-label-sm tracking-wider text-primary-fixed-dim uppercase">
                {t('card.label')}
              </span>
              <span
                className={`mt-2 truncate leading-[30px] font-bold tracking-tight text-secondary-fixed ${
                  (c.acronym ?? c.code).length > 8 ? 'text-[24px]' : 'text-[30px]'
                }`}
              >
                {c.acronym ?? c.code}
              </span>
            </div>
            <Icon name="domain" className="text-[40px] text-tertiary-fixed/80" />
          </div>
          <div className="relative mt-4 flex items-center justify-between gap-2">
            <p className="inline-flex rounded-full bg-primary-container/90 px-3 py-1 text-label-sm font-semibold tracking-wide">
              {c.code}
            </p>
            <CenterStatus active={c.active} />
          </div>
        </div>

        <div className="pt-4 pb-2">
          <h3 className="text-headline-sm font-bold tracking-tight text-[#0F241A] transition-colors group-hover:text-primary">
            {/* El enlace del título cubre toda la tarjeta. */}
            <Link
              to={centerPath(c)}
              className="after:absolute after:inset-0 after:rounded-[24px] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-secondary"
            >
              {c.name}
            </Link>
          </h3>
          {c.director ? (
            <p className="mt-2 flex items-center gap-1.5 text-body-sm text-neutral-muted">
              <Icon name="person" className="text-[18px] text-primary" />
              <span>
                {t('card.director')}:{' '}
                <span className="font-semibold text-on-surface">{displayName(c.director.name)}</span>
              </span>
            </p>
          ) : null}
          <div className="mt-3">
            <OdsChips ods={c.ods} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <dl className="grid grid-cols-3 gap-2 rounded-[14px] bg-metric-bg p-3">
          {metrics.map((m, i) => (
            <div
              key={m.label}
              className={`flex min-w-0 flex-col ${i ? 'border-l border-surface-container pl-3' : ''}`}
            >
              <dt className="flex items-center gap-1 text-[10px] font-semibold tracking-wider text-neutral-muted uppercase">
                <Icon name={m.icon} className="text-[14px] text-secondary" /> {m.label}
              </dt>
              <dd className="mt-0.5 text-[15px] leading-tight font-bold text-on-surface">{m.value}</dd>
            </div>
          ))}
        </dl>
        <span
          aria-hidden="true"
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-label-md font-semibold text-surface-container-lowest transition-colors group-hover:bg-secondary"
        >
          {t('card.view')} <Icon name="arrow_forward" className="text-[16px]" />
        </span>
      </div>
    </article>
  );
}

const COLS =
  'md:grid-cols-[6.5rem_minmax(0,1fr)_13rem_5rem_5rem_8rem_1.5rem] lg:grid-cols-[6.5rem_minmax(0,1fr)_14rem_5rem_5rem_9rem_7rem_1.5rem]';

/** Fila de la vista en lista: misma anatomía que GroupRow; toda la fila enlaza a la ficha. */
export function CenterRow({ center: c }: { center: Center }) {
  const { t } = useTranslation('centers');
  return (
    <li
      className={`group relative grid grid-cols-[6.5rem_1fr_auto] items-center gap-4 px-4 py-4 transition-colors hover:bg-surface-cream-alt/60 md:px-5 ${COLS}`}
    >
      <span
        className={`flex h-12 items-center justify-center truncate rounded-xl px-2 text-label-md font-bold ${
          c.active ? 'bg-surface-dark-forest text-secondary-fixed' : 'bg-[#3d4a44] text-surface-cream-alt'
        }`}
        title={c.acronym ?? c.code}
      >
        {c.acronym ?? c.code}
      </span>

      <div className="min-w-0">
        <h3 className="text-body-md font-semibold text-[#0F241A] group-hover:text-primary">
          <Link
            to={centerPath(c)}
            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-secondary"
          >
            {c.name}
          </Link>
        </h3>
        <p className="mt-0.5 text-label-sm text-neutral-muted">
          {c.code}
          {/* En móvil, los datos de las columnas van en esta línea. */}
          <span className="md:hidden">
            {c.director ? ` · ${displayName(c.director.name)}` : ''}
            {` · ${t('card.linesCount', { count: c.linesCount })}`}
          </span>
          {!c.active ? <span className="lg:hidden">{` · ${t('inactive')}`}</span> : null}
        </p>
      </div>

      <p className="hidden truncate text-body-sm text-on-surface-variant md:block">
        {c.director ? displayName(c.director.name) : '—'}
      </p>
      <p className="hidden text-body-sm text-on-surface md:block">
        <span className="font-semibold">{c.linesCount}</span>
      </p>
      <p className="hidden text-body-sm text-on-surface md:block">{c.foundedYear ?? '—'}</p>
      <p className="hidden truncate text-body-sm text-on-surface-variant md:block">
        {c.city ? displayName(c.city) : '—'}
      </p>
      <p className="hidden lg:block">
        <CenterStatus active={c.active} />
      </p>
      <Icon name="chevron_right" className="text-[20px] text-neutral-muted group-hover:text-primary" />
    </li>
  );
}

/** Encabezado de columnas (solo escritorio), alineado con la grilla de CenterRow. */
export function CenterRowHeader() {
  const { t } = useTranslation('centers');
  return (
    <div
      aria-hidden="true"
      className={`hidden grid-cols-[6.5rem_minmax(0,1fr)_13rem_5rem_5rem_8rem_1.5rem] gap-4 border-b border-border-subtle px-5 py-3 text-[10px] font-semibold tracking-wider text-neutral-muted uppercase md:grid ${COLS}`}
    >
      <span>{t('card.colCode')}</span>
      <span>{t('card.colCenter')}</span>
      <span>{t('card.director')}</span>
      <span>{t('card.lines')}</span>
      <span>{t('card.founded')}</span>
      <span>{t('card.city')}</span>
      <span className="hidden lg:block">{t('card.colStatus')}</span>
      <span />
    </div>
  );
}
