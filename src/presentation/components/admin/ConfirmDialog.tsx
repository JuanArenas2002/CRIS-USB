import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/presentation/components/ui/Icon';

interface Request {
  message: ReactNode;
  confirmLabel: string;
  resolve: (ok: boolean) => void;
}

/**
 * Confirmación propia (nunca `window.confirm`): `const [confirm, confirmDialog] = useConfirm()`,
 * `if (await confirm('¿Quitar…?')) …` y `{confirmDialog}` dentro del componente. Va sobre
 * `<dialog>`, así queda encima de todo, incluso de un panel lateral abierto.
 */
export function useConfirm() {
  const [request, setRequest] = useState<Request | null>(null);
  const confirm = (message: ReactNode, confirmLabel = 'Quitar') =>
    new Promise<boolean>((resolve) => setRequest({ message, confirmLabel, resolve }));
  const close = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };
  const dialog = <ConfirmDialog request={request} onClose={close} />;
  return [confirm, dialog] as const;
}

function ConfirmDialog({ request, onClose }: { request: Request | null; onClose: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (request && !d.open) d.showModal?.();
    if (!request && d.open) d.close?.();
  }, [request]);

  return (
    <dialog
      ref={ref}
      // Esc o clic fuera = cancelar.
      onCancel={(e) => {
        e.preventDefault();
        onClose(false);
      }}
      onClick={(e) => e.target === e.currentTarget && onClose(false)}
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-surface-container-lowest p-0 shadow-2xl backdrop:bg-surface-dark-forest/50 backdrop:backdrop-blur-[2px] motion-safe:open:animate-[toast-in_150ms_ease-out]"
    >
      {request ? (
        <div className="flex flex-col gap-5 p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-error-container/50 text-error">
              <Icon name="error" className="text-[24px]" />
            </span>
            <div className="min-w-0 pt-1">
              <h2 id={titleId} className="text-headline-sm font-semibold text-primary">
                ¿Confirmas esta acción?
              </h2>
              <p className="mt-1 text-body-sm text-on-surface-variant">{request.message}</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              autoFocus
              onClick={() => onClose(false)}
              className="h-10 rounded-lg px-4 text-label-md font-semibold text-on-surface-variant ring-1 ring-border-subtle hover:bg-surface-cream-alt"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onClose(true)}
              className="h-10 rounded-lg bg-error px-4 text-label-md font-semibold text-on-primary shadow-sm hover:opacity-90"
            >
              {request.confirmLabel}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
