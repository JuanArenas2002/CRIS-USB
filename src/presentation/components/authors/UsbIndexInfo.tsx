import { useTranslation } from 'react-i18next';
import { InfoDialog } from '@/presentation/components/ui/InfoDialog';
import { USB_INDEX_GROUPS, USB_INDEX_MAX_WEIGHT, groupWeight } from './usb-index';

/** Botón + modal que explica cómo se calcula el índice Unisimón. */
export function UsbIndexInfo() {
  const { t, i18n } = useTranslation('authors');
  const num = (n: number) => n.toLocaleString(i18n.language);

  return (
    <InfoDialog
      trigger={t('usbInfo.button')}
      title={t('usbInfo.title')}
      lead={t('usbInfo.lead')}
      closeLabel={t('usbInfo.close')}
      footer={
        <>
          <span>{t('usbInfo.total')}</span>
          <span className="text-label-md font-bold tabular-nums">100</span>
        </>
      }
    >
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
    </InfoDialog>
  );
}
