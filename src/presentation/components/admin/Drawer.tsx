import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from '@/presentation/components/ui/Icon';

/**
 * Panel lateral (derecha) sobre `<dialog>` nativo: el navegador ya da fondo modal, foco atrapado
 * y cierre con Esc. El contenido solo se monta mientras está abierto.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close?.();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // Clic en el fondo (fuera del panel) cierra.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-labelledby={titleId}
      className="fixed inset-y-0 right-0 left-auto m-0 h-full max-h-none w-full max-w-lg bg-surface-container-lowest p-0 shadow-2xl backdrop:bg-surface-dark-forest/40 backdrop:backdrop-blur-[2px] open:flex open:flex-col"
    >
      {open ? (
        <>
          <header className="flex items-start justify-between gap-4 border-b border-border-subtle px-6 py-5">
            <div className="min-w-0">
              <h2 id={titleId} className="text-headline-sm font-semibold text-primary">
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-0.5 line-clamp-2 text-body-sm text-neutral-muted">{subtitle}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-cream-alt"
            >
              <Icon name="close" className="text-[20px]" />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        </>
      ) : null}
    </dialog>
  );
}
