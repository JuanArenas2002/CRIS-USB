import { Link } from 'react-router';
import { authorSlug, displayName } from '@/domain/authors/author';
import type { Group } from '@/domain/groups/group';
import { Icon } from '@/presentation/components/ui/Icon';

/** Tarjeta resumida: lo esencial para elegir un grupo; el detalle vive en /grupos/:slug. */
export function GroupCard({ group }: { group: Group }) {
  const metrics = [
    { icon: 'link', label: 'Líneas', value: group.lines.length || '—' },
    { icon: 'event', label: 'Fundado', value: group.foundedYear ?? '—' },
    { icon: 'location_on', label: 'Sede', value: group.city ? displayName(group.city) : '—' },
  ];

  return (
    <article className="group relative flex flex-col justify-between rounded-[24px] bg-surface-container-lowest p-4 shadow-[0_4px_20px_-2px_rgba(21,71,52,0.06),0_2px_6px_-1px_rgba(0,0,0,0.03)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_28px_-4px_rgba(21,71,52,0.12)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex flex-col">
        <div className="relative overflow-hidden rounded-[20px] bg-surface-dark-forest p-5 text-on-primary">
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
            <div className="flex flex-col">
              <span className="text-label-sm tracking-wider text-primary-fixed-dim uppercase">
                Categoría Minciencias
              </span>
              <span className="mt-1 text-[44px] leading-none font-bold tracking-tight text-secondary-fixed">
                {group.category ?? '—'}
              </span>
            </div>
            <Icon name="workspace_premium" className="text-[40px] text-tertiary-fixed/80" />
          </div>
          <p className="relative mt-4 inline-flex rounded-full bg-primary-container/90 px-3 py-1 text-label-sm font-semibold tracking-wide">
            {group.code}
          </p>
        </div>

        <div className="pt-4 pb-2">
          <h3 className="text-headline-sm font-bold tracking-tight text-[#0F241A] transition-colors group-hover:text-primary">
            {/* El enlace del título cubre toda la tarjeta. */}
            <Link
              to={`/grupos/${authorSlug(group)}`}
              className="after:absolute after:inset-0 after:rounded-[24px] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-secondary"
            >
              {group.name}
            </Link>
          </h3>
          {group.leader ? (
            <p className="mt-2 flex items-center gap-1.5 text-body-sm text-neutral-muted">
              <Icon name="person" className="text-[18px] text-primary" />
              <span>
                Líder: <span className="font-semibold text-on-surface">{displayName(group.leader.name)}</span>
              </span>
            </p>
          ) : null}
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
          Ver grupo <Icon name="arrow_forward" className="text-[16px]" />
        </span>
      </div>
    </article>
  );
}
