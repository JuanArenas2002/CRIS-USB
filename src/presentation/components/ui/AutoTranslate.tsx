import { useTranslation } from 'react-i18next';
import type { AutoTranslateStatus } from '@/presentation/hooks/use-auto-translate';
import { Icon } from './Icon';

/** `lang` del texto libre: sin traducir en una interfaz en otro idioma, es español (lectores de pantalla). */
export const sourceLang = (status: AutoTranslateStatus) =>
  status === 'original' || status === 'translated' ? undefined : 'es';

/** Aviso de la traducción automática (o de que el texto sigue en español), con botón para reintentar. */
export function AutoTranslateNote({
  status,
  onRetry,
  className = 'mb-3',
}: {
  status: AutoTranslateStatus;
  onRetry: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  if (status === 'original') return null;
  return (
    <p
      aria-live="polite"
      className={`flex flex-wrap items-center gap-1.5 text-label-sm text-neutral-muted ${className}`}
    >
      <Icon name="translate" className="text-[16px] text-secondary" />
      {t(`autoTranslate.${status}`)}
      {status === 'needs-gesture' ? (
        <button
          type="button"
          onClick={onRetry}
          className="ml-1 rounded-md bg-badge-sage-bg px-2 py-0.5 font-semibold text-badge-sage-text transition-colors hover:bg-secondary hover:text-on-primary focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
        >
          {t('autoTranslate.action')}
        </button>
      ) : null}
    </p>
  );
}

/** Líneas de texto en carga, mientras se traduce (no se ve el español antes de tiempo). */
export function TextSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <span aria-hidden="true" className="flex flex-col gap-1.5 py-0.5">
      {Array.from({ length: lines }, (_, i) => (
        <span
          key={i}
          className="h-3 animate-pulse rounded bg-surface-cream-alt motion-reduce:animate-none"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </span>
  );
}
