import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/presentation/components/ui/Icon';
import { USB_INDEX_GROUPS, USB_INDEX_MAX_WEIGHT, groupWeight } from './usb-index';

/**
 * Botón + modal que explica cómo se calcula el índice USB. Usa <dialog> nativo: foco atrapado, Esc cierra y
 * el resto de la página queda inerte. Un clic en el fondo también cierra.
 */
export function UsbIndexInfo() {
  const { t, i18n } = useTranslation('authors');
  const dialog = useRef<HTMLDialogElement>(null);
  const num = (n: number) => n.toLocaleString(i18n.language);

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
        {t('usbInfo.button')}
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="usb-index-title"
        onClose={restoreScroll}
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100vw-2rem))] overflow-hidden rounded-3xl bg-surface-container-lowest p-0 text-on-surface shadow-2xl backdrop:bg-primary/60 backdrop:backdrop-blur-sm open:flex open:flex-col"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border-subtle px-6 pt-6 pb-4">
          <div>
            <h2 id="usb-index-title" className="text-headline-sm font-bold text-primary">
              {t('usbInfo.title')}
            </h2>
            <p className="mt-1 text-body-sm text-neutral-muted">{t('usbInfo.lead')}</p>
          </div>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label={t('usbInfo.close')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-cream-alt focus-visible:outline-2 focus-visible:outline-secondary"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </header>

        <div className="flex flex-col gap-6 overflow-y-auto px-6 py-5">
          {USB_INDEX_GROUPS.map(({ key, vars }) => (
            <section key={key} aria-labelledby={`usb-group-${key}`}>
              <h3
                id={`usb-group-${key}`}
                className="flex items-baseline justify-between text-label-md font-bold tracking-wider text-secondary uppercase"
              >
                {t(`usbInfo.groups.${key}`)}
                <span className="text-primary tabular-nums">{num(groupWeight(vars))}</span>
              </h3>
              <ul className="mt-2 flex flex-col gap-2.5">
                {vars.map(([name, weight]) => (
                  <li key={name}>
                    <div className="flex items-baseline justify-between gap-4 text-body-sm">
                      <span>{t(`usbInfo.vars.${name}`)}</span>
                      <span className="font-semibold text-primary tabular-nums">{num(weight)}</span>
                    </div>
                    <div aria-hidden="true" className="mt-1 h-1.5 rounded-full bg-surface-cream-alt">
                      <div
                        className="h-full rounded-full bg-secondary"
                        style={{ width: `${(weight / USB_INDEX_MAX_WEIGHT) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="flex items-center justify-between gap-4 border-t border-border-subtle bg-surface-cream-alt px-6 py-3 text-body-sm">
          <span className="font-semibold text-primary">{t('usbInfo.total')}</span>
          <span className="text-label-md font-bold text-primary tabular-nums">100</span>
        </footer>
      </dialog>
    </>
  );
}
