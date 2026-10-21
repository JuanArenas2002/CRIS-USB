import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '@/presentation/components/ui/Icon';

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** [valor, texto]; el primero con valor '' es «todos». */
  options: [string, string][];
  className?: string;
}

/**
 * Desplegable de los buscadores flotantes. Propio y no `<select>`: la lista nativa la pinta el sistema
 * y no sigue el diseño. Patrón combobox de solo selección (WAI-ARIA APG): el foco se queda en el botón.
 */
export function FilterSelect({ label, value, onChange, options, className = 'lg:w-56' }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const selected = Math.max(
    0,
    options.findIndex(([v]) => v === value),
  );

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active]);

  const show = () => {
    setActive(selected);
    setOpen(true);
  };
  const pick = (i: number) => {
    onChange(options[i]![0]);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const last = options.length - 1;
    const move: Record<string, () => void> = {
      ArrowDown: () => (open ? setActive((i) => Math.min(last, i + 1)) : show()),
      ArrowUp: () => (open ? setActive((i) => Math.max(0, i - 1)) : show()),
      Home: () => open && setActive(0),
      End: () => open && setActive(last),
      Enter: () => (open ? pick(active) : show()),
      ' ': () => (open ? pick(active) : show()),
      Escape: () => setOpen(false),
      Tab: () => setOpen(false),
    };
    if (!move[e.key]) return;
    if (e.key !== 'Tab') e.preventDefault();
    move[e.key]!();
  };

  const isSet = value !== '';
  return (
    <div ref={root} className={`relative w-full ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={`flex h-11 w-full cursor-pointer items-center gap-2 rounded-xl px-3 text-left text-label-md font-semibold transition-all focus:ring-2 focus:ring-secondary focus:outline-none ${
          isSet
            ? 'bg-badge-sage-bg text-badge-sage-text'
            : 'bg-canvas-cream text-on-surface hover:bg-surface-cream-alt'
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{options[selected]?.[1]}</span>
        <Icon
          name="expand_more"
          className={`text-[18px] text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          className="absolute top-full right-0 left-0 z-40 mt-1.5 max-h-72 min-w-full overflow-y-auto rounded-xl bg-surface-container-lowest p-1 shadow-xl ring-1 ring-border-subtle lg:min-w-64"
        >
          {options.map(([v, text], i) => (
            <li
              key={v}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === selected}
              onPointerEnter={() => setActive(i)}
              onClick={() => pick(i)}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-body-sm ${
                i === active ? 'bg-surface-cream-alt' : ''
              } ${i === selected ? 'font-semibold text-primary' : 'text-on-surface'}`}
            >
              <span className="min-w-0 flex-1">{text}</span>
              {i === selected ? <Icon name="check" className="text-[18px] text-secondary" /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Botón «Restablecer filtros» de los buscadores flotantes; solo aparece con algún filtro puesto. */
export function ClearFilters({
  show,
  label,
  onClick,
}: {
  show: boolean;
  label: string;
  onClick: () => void;
}) {
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-label-md font-semibold text-secondary transition-colors hover:bg-surface-cream-alt"
    >
      <Icon name="filter_alt_off" className="text-[18px]" /> {label}
    </button>
  );
}
