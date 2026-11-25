import { useId, useRef, type ReactNode } from 'react';
import { Icon } from '@/presentation/components/ui/Icon';

interface Props {
  /** Texto del botón que abre el modal. */
  trigger: string;
  title: string;
  lead: string;
  closeLabel: string;
  /** Pie del modal (p. ej. el total). */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Botón «i» + modal informativo. Usa <dialog> nativo: foco atrapado, Esc cierra y el resto de la página queda
 * inerte. Un clic en el fondo también cierra.
 */
export function InfoDialog({ trigger, title, lead, closeLabel, footer, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const open = () => {
    dialog.current?.showModal();
    document.documentElement.style.overflow = 'hidden'; // la página de fondo no se desplaza
  };
  const restoreScroll = () => void (document.documentElement.style.overflow = '');

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        className="inline-flex h-9 items-center gap-2 rounded-full bg-surface-container-lowest pr-4 pl-1.5 text-label-md font-semibold text-primary shadow-sm ring-1 ring-border-subtle transition-colors hover:bg-surface-cream-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
      >
        <span
          aria-hidden="true"
          className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-label-sm font-bold text-on-primary"
        >
          i
        </span>
        {trigger}
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClose={restoreScroll}
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100vw-2rem))] overflow-hidden rounded-3xl bg-surface-container-lowest p-0 text-on-surface shadow-2xl backdrop:bg-primary/60 backdrop:backdrop-blur-sm open:flex open:flex-col"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border-subtle px-6 pt-6 pb-4">
          <div>
            <h2 id={titleId} className="text-headline-sm font-bold text-primary">
              {title}
            </h2>
            <p className="mt-1 text-body-sm text-neutral-muted">{lead}</p>
          </div>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label={closeLabel}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-cream-alt focus-visible:outline-2 focus-visible:outline-secondary"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </header>

        <div className="flex flex-col gap-6 overflow-y-auto px-6 py-5">{children}</div>

        {footer ? (
          <footer className="flex items-center justify-between gap-4 border-t border-border-subtle bg-surface-cream-alt px-6 py-3 text-body-sm font-semibold text-primary">
            {footer}
          </footer>
        ) : null}
      </dialog>
    </>
  );
}
