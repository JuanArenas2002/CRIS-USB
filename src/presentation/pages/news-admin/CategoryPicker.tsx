import { useId, useRef, useState } from 'react';
import { Icon } from '@/presentation/components/ui/Icon';

type Category = { id: number; name: string };
export const MAX_CATEGORIES = 5; // mismo límite que el backend (principal incluida)
const SHOWN = 8; // coincidencias visibles: con cientos de categorías se busca, no se recorre una lista

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Categorías de la noticia con buscador (escala a cientos): se escribe, se elige entre las coincidencias y
 * quedan como etiquetas. La primera es la PRINCIPAL (sección, antetítulo y migas); cualquier otra puede pasar
 * a serlo. Teclado: ↑/↓ para moverse, Enter para agregar, Esc para cerrar, Retroceso con el buscador vacío
 * quita la última.
 */
export function CategoryPicker({
  categories,
  principal,
  extras,
  disabledPrincipal,
  onChange,
}: {
  categories: Category[];
  principal: number;
  extras: number[];
  /** Tras la revisión la principal ya no se cambia (las adicionales sí). */
  disabledPrincipal?: boolean;
  onChange: (principal: number, extras: number[]) => void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const selected = [principal, ...extras].filter((x) => byId.has(x));
  const full = selected.length >= MAX_CATEGORIES;
  const q = fold(term.trim());
  const matches = categories.filter((c) => !selected.includes(c.id) && (!q || fold(c.name).includes(q)));
  // Las que empiezan por lo escrito, primero.
  matches.sort((a, b) => Number(fold(b.name).startsWith(q)) - Number(fold(a.name).startsWith(q)));
  const options = matches.slice(0, SHOWN);
  const showList = open && !full && options.length > 0;
  const optionId = (i: number) => `${id}-opt-${i}`;

  const set = (list: number[]) => onChange(list[0] ?? 0, list.slice(1));
  const add = (c: Category) => {
    set(selected.length ? [...selected, c.id] : [c.id]);
    setTerm('');
    setActive(0);
    inputRef.current?.focus();
  };
  const remove = (cid: number) => {
    if (cid === principal && disabledPrincipal) return;
    set(selected.filter((x) => x !== cid));
  };
  const makePrincipal = (cid: number) => set([cid, ...selected.filter((x) => x !== cid)]);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${id}-input`} className="text-label-md font-semibold text-on-surface">
        Categorías *
      </label>
      {selected.length > 0 && (
        <ul aria-label="Categorías elegidas" className="flex flex-wrap gap-1.5">
          {selected.map((cid, i) => {
            const c = byId.get(cid)!;
            const isPrincipal = i === 0;
            return (
              <li
                key={cid}
                className={`inline-flex max-w-full items-center gap-1 rounded-full py-1 pr-1 pl-3 text-label-sm font-semibold ${
                  isPrincipal
                    ? 'bg-primary-container text-on-primary'
                    : 'bg-badge-sage-bg text-badge-sage-text'
                }`}
              >
                <span className="truncate">{c.name}</span>
                {isPrincipal ? (
                  <span className="rounded-full bg-white/15 px-1.5 text-[10px] tracking-wide uppercase">
                    Principal
                  </span>
                ) : (
                  !disabledPrincipal && (
                    <button
                      type="button"
                      onClick={() => makePrincipal(cid)}
                      title="Hacer principal"
                      aria-label={`Hacer principal: ${c.name}`}
                      className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-black/10"
                    >
                      <Icon name="flag" className="text-[16px]" />
                    </button>
                  )
                )}
                {!(isPrincipal && disabledPrincipal) && (
                  <button
                    type="button"
                    onClick={() => remove(cid)}
                    aria-label={`Quitar ${c.name}`}
                    className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-black/10"
                  >
                    <Icon name="close" className="text-[16px]" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="relative">
        <Icon
          name="search"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[18px] text-neutral-muted"
        />
        <input
          ref={inputRef}
          id={`${id}-input`}
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={showList && options[active] ? optionId(active) : undefined}
          aria-describedby={`${id}-hint`}
          autoComplete="off"
          disabled={full}
          value={term}
          placeholder={
            full ? 'Máximo alcanzado' : selected.length ? 'Agregar otra categoría…' : 'Busca una categoría…'
          }
          onChange={(e) => {
            setTerm(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, options.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter') {
              if (showList && options[active]) {
                e.preventDefault();
                add(options[active]);
              }
            } else if (e.key === 'Escape') {
              setOpen(false);
            } else if (e.key === 'Backspace' && !term && selected.length) {
              remove(selected[selected.length - 1]!);
            }
          }}
          className="h-10 w-full rounded-lg border border-border-subtle bg-surface-container-lowest pr-3 pl-9 text-body-sm focus:ring-2 focus:ring-secondary focus:outline-none disabled:bg-surface-cream-alt"
        />
        {showList && (
          <ul
            id={`${id}-list`}
            role="listbox"
            aria-label="Categorías encontradas"
            className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-border-subtle bg-surface-container-lowest py-1 shadow-xl"
          >
            {options.map((c, i) => (
              <li
                key={c.id}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(c)}
                className={`cursor-pointer px-3 py-2 text-body-sm text-on-surface ${i === active ? 'bg-surface-cream-alt' : ''}`}
              >
                {c.name}
              </li>
            ))}
            {matches.length > SHOWN && (
              <li role="presentation" className="px-3 pt-1 pb-2 text-label-sm text-neutral-muted">
                {matches.length - SHOWN} más: sigue escribiendo para afinar.
              </li>
            )}
          </ul>
        )}
        {open && !full && q && !matches.length && (
          <p
            role="status"
            className="absolute z-20 mt-1 w-full rounded-xl border border-border-subtle bg-surface-container-lowest px-3 py-2 text-label-sm text-neutral-muted shadow-xl"
          >
            Ninguna categoría coincide con «{term.trim()}».
          </p>
        )}
      </div>
      <span id={`${id}-hint`} className="text-label-sm text-neutral-muted">
        La primera es la principal (sección de la noticia). Hasta {MAX_CATEGORIES} en total.
      </span>
    </div>
  );
}
