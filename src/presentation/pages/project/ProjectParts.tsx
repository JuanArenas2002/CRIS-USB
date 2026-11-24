// Piezas de la ficha de proyecto compartidas por sus secciones.
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { displayName } from '@/domain/authors/author';
import type { Project } from '@/domain/projects/project';
import { Icon } from '@/presentation/components/ui/Icon';
import { TEAM_PREVIEW, splitUrls } from './project-model';

export const card = 'rounded-2xl border border-border-subtle/70 bg-surface-container-lowest shadow-sm';

export function SectionTitle({
  children,
  lead,
  aside,
}: {
  children: ReactNode;
  lead?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col justify-between gap-2 border-b border-border-subtle/80 pb-2 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <span className="h-6 w-1.5 shrink-0 rounded-full bg-secondary" />
        <div>
          <h2 className="text-headline-md font-semibold text-primary">{children}</h2>
          {lead ? <p className="text-body-sm text-on-surface-variant">{lead}</p> : null}
        </div>
      </div>
      {aside}
    </div>
  );
}

export function InfoCard({
  icon,
  label,
  value,
  children,
}: {
  icon: string;
  label: string;
  value: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={`${card} flex flex-col justify-between p-5`}>
      <div className="flex flex-col gap-1.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-badge-sage-bg bg-badge-sage-bg text-badge-sage-text">
          <Icon name={icon} className="text-[24px]" />
        </span>
        <span className="pt-1 text-label-sm tracking-wider text-neutral-muted uppercase">{label}</span>
        <p className="text-headline-sm font-semibold text-primary">{value}</p>
      </div>
      {children ? (
        <div className="mt-4 border-t border-surface-cream-alt pt-3 text-label-sm">{children}</div>
      ) : null}
    </div>
  );
}

/** Texto libre de Metri-K con las URLs convertidas en enlaces. */
export function Linkified({ text }: { text: string }) {
  return (
    <>
      {splitUrls(text).map((part, i) =>
        i % 2 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener"
            className="break-all text-secondary underline hover:text-primary"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function TeamList({ team }: { team: Project['team'] }) {
  const { t } = useTranslation('projects');
  const [showAll, setShowAll] = useState(false);
  const hidden = team.length - TEAM_PREVIEW;
  const visible = showAll || hidden <= 0 ? team : team.slice(0, TEAM_PREVIEW);
  return (
    <div>
      <ul id="project-team" className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {visible.map((m) => (
          <li key={m.name} className="flex items-start gap-2">
            <Icon name="person" className="mt-0.5 text-[16px] text-secondary" />
            <span>
              <span className="font-semibold text-on-surface">{displayName(m.name)}</span>
              {m.role ? <span className="block text-label-sm text-neutral-muted">{m.role}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      {hidden > 0 ? (
        <button
          type="button"
          aria-expanded={showAll}
          aria-controls="project-team"
          onClick={() => setShowAll((v) => !v)}
          className="mt-1 -mb-2 -ml-3 inline-flex items-center gap-1 rounded-lg px-3 py-2 text-label-md font-semibold text-secondary transition-colors hover:bg-surface-cream-alt"
        >
          {showAll ? t('detail.lessTeam') : t('detail.moreTeam', { count: hidden })}
          <Icon
            name="expand_more"
            className={`text-[18px] transition-transform ${showAll ? 'rotate-180' : ''}`}
          />
        </button>
      ) : null}
    </div>
  );
}
