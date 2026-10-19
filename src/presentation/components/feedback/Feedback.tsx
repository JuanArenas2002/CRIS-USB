import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/infrastructure/http/api-client';
import { Icon } from '@/presentation/components/ui/Icon';

const buttonClass =
  'mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary-container px-4 py-2 text-label-md font-semibold text-on-primary hover:bg-secondary';

/** `message` fija el texto; si no, se traduce el código de `error` (ApiError) al idioma activo. */
export function ErrorState({
  error,
  message,
  onRetry,
}: {
  error?: unknown;
  message?: string;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const text = message ?? t(`errors.${error instanceof ApiError ? error.code : 'unexpected'}`);
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-3xl bg-error-container/40 px-6 py-12 text-center"
    >
      <Icon name="error" className="mb-2 text-[44px] text-error" />
      <h2 className="text-headline-sm font-semibold text-primary">{t('feedback.errorTitle')}</h2>
      <p className="mt-1 max-w-md text-body-md text-on-surface-variant">{text}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className={buttonClass}>
          <Icon name="refresh" className="text-[18px]" /> {t('feedback.retry')}
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div role="status" className="flex flex-col items-center px-6 py-16 text-center">
      <Icon name="person_search" className="mb-2 text-[48px] text-neutral-muted" />
      <h2 className="text-headline-sm font-semibold text-primary">{title}</h2>
      <p className="mt-1 max-w-md text-body-md text-neutral-muted">{children}</p>
      {action}
    </div>
  );
}

export { buttonClass as feedbackButtonClass };
