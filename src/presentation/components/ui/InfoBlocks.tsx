import type { ReactNode } from 'react';
import { Icon } from './Icon';

/** Bloques de "Información institucional" de las fichas de grupo y de centro. */
export function SectionHead({ icon, id, children }: { icon: string; id?: string; children: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg bg-surface-cream-alt/40 p-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-badge-sage-bg text-badge-sage-text">
        <Icon name={icon} className="text-[20px]" />
      </span>
      <h2 id={id} className="text-headline-md font-semibold text-primary">
        {children}
      </h2>
    </div>
  );
}

export function InfoColumn({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 pb-1 text-label-md tracking-wider text-secondary uppercase">
        <Icon name={icon} className="text-[16px]" /> {title}
      </h3>
      <dl className="flex flex-col gap-2.5 text-body-sm">{children}</dl>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="block text-label-sm text-neutral-muted">{label}</dt>
      <dd className="font-semibold text-on-surface">{children}</dd>
    </div>
  );
}
