import type { ReactNode } from 'react';
import { Icon } from './Icon';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon: string;
  /** Contador opcional (p. ej. "24" o "148 productos"). */
  badge?: ReactNode;
}

/**
 * Pestañas de las plantillas de perfil y de grupo (patrón ARIA tabs: flechas, Inicio y Fin).
 * Cada panel usa `id="panel-{id}"` y `aria-labelledby="tab-{id}"`.
 */
export function TabBar<T extends string>({
  tabs,
  active,
  onSelect,
  label,
}: {
  tabs: TabItem<T>[];
  active: T;
  onSelect: (t: T) => void;
  label: string;
}) {
  const move = (from: number, key: string) => {
    const i =
      key === 'ArrowRight'
        ? (from + 1) % tabs.length
        : key === 'ArrowLeft'
          ? (from - 1 + tabs.length) % tabs.length
          : key === 'Home'
            ? 0
            : key === 'End'
              ? tabs.length - 1
              : -1;
    if (i < 0) return false;
    onSelect(tabs[i]!.id);
    document.getElementById(`tab-${tabs[i]!.id}`)?.focus();
    return true;
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-2 overflow-x-auto rounded-xl bg-surface-container-lowest p-1.5 shadow-sm"
    >
      {tabs.map((t, i) => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(t.id)}
            onKeyDown={(e) => {
              if (move(i, e.key)) e.preventDefault();
            }}
            className={`flex shrink-0 items-center gap-2.5 rounded-lg px-6 py-2.5 text-headline-sm font-semibold transition-all ${
              selected
                ? 'bg-primary-container text-on-primary shadow-sm'
                : 'text-neutral-muted hover:bg-surface-cream-alt hover:text-on-surface'
            }`}
          >
            <Icon name={t.icon} className="text-[20px]" />
            {t.label}
            {t.badge !== undefined && t.badge !== null ? (
              <span
                className={`ml-1 rounded-full px-2.5 py-0.5 text-label-sm font-bold ${
                  selected ? 'bg-secondary-fixed text-primary' : 'bg-badge-sage-bg text-badge-sage-text'
                }`}
              >
                {t.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
