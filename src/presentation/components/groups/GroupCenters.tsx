import { withBaseUrl } from '@/shared/base';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { authorSlug } from '@/domain/authors/author';
import { Icon } from '@/presentation/components/ui/Icon';
import { useCenters } from '@/presentation/hooks/use-centers';

/**
 * Centros a los que pertenece un grupo: logo y sigla, enlazados a la ficha del centro.
 * Cruza `group.centerIds` con la lista de centros (ya cacheada en el portal). `except` oculta un
 * centro (en la ficha de ese mismo centro sobra). Por encima del enlace que cubre filas y tarjetas (z-10).
 */
export function GroupCenters({
  ids,
  except,
  className = '',
}: {
  ids: number[] | undefined;
  except?: number;
  className?: string;
}) {
  const { t } = useTranslation('groups');
  const { data } = useCenters();
  const centers = (data ?? []).filter((c) => c.active && c.id !== except && ids?.includes(c.id));
  if (!centers.length) return null;
  return (
    <ul aria-label={t('centers')} className={`flex flex-wrap gap-1.5 ${className}`}>
      {centers.map((c) => (
        <li key={c.id}>
          <Link
            to={`/centros/${authorSlug(c)}`}
            title={c.name}
            className="relative z-10 inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-subtle bg-white px-2 text-label-sm font-semibold text-on-surface-variant transition-colors hover:border-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-secondary"
          >
            {c.logoUrl ? (
              <img
                src={withBaseUrl(c.logoUrl)}
                alt=""
                loading="lazy"
                className="h-5 w-auto max-w-14 object-contain"
              />
            ) : (
              <Icon name="domain" className="text-[15px] text-secondary" />
            )}
            {c.acronym ?? c.code}
            <span className="sr-only">{c.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
