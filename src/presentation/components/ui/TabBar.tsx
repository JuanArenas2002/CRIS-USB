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
 * En móvil las pestañas se reparten el ancho (icono y contador arriba, texto debajo): nunca hay que
 * deslizar de lado para encontrar una.
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
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-surface-container-lowest p-1 shadow-sm sm:flex sm:gap-2 sm:p-1.5"
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
            className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-center text-label-md leading-tight font-semibold transition-all sm:shrink-0 sm:flex-row sm:gap-2.5 sm:px-6 sm:py-2.5 sm:text-headline-sm ${
              selected
                ? 'bg-primary-container text-on-primary shadow-sm'
                : 'text-neutral-muted hover:bg-surface-cream-alt hover:text-on-surface'
            }`}
          >
            <span className="flex items-center gap-1.5 sm:contents">
              <Icon name={t.icon} className="text-[20px]" />
              {t.badge !== undefined && t.badge !== null ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-label-sm font-bold sm:order-last sm:ml-1 sm:px-2.5 ${
                    selected ? 'bg-secondary-fixed text-primary' : 'bg-badge-sage-bg text-badge-sage-text'
                  }`}
                >
                  {t.badge}
                </span>
              ) : null}
            </span>
            <span className="break-words">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
