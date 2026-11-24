import { withBase } from '@/shared/base';
import { useTranslation } from 'react-i18next';
import { resolutionFileUrl, type CenterDetail } from '@/domain/centers/center';
import { AutoTranslateNote, TextSkeleton, sourceLang } from '@/presentation/components/ui/AutoTranslate';
import { Icon } from '@/presentation/components/ui/Icon';
import { SectionHead } from '@/presentation/components/ui/InfoBlocks';
import { useAutoTranslate } from '@/presentation/hooks/use-auto-translate';
import { useLabels } from '@/presentation/hooks/use-labels';
import { card } from './styles';

type Resolution = CenterDetail['resolutions'][number];

/** Resoluciones del centro (con su PDF si existe); sin resoluciones, la sección no se muestra. */
export function CenterResolutions({ center: c }: { center: CenterDetail }) {
  const { t } = useTranslation(['centers', 'common']);
  // Descripciones libres de Metri-K: se traducen en el navegador (no son nombres propios).
  const descTr = useAutoTranslate(c.resolutions.map((r) => r.description ?? ''));
  if (!c.resolutions.length) return null;
  return (
    <section className={`${card} p-5 md:p-6`}>
      <SectionHead icon="gavel">{t('detail.resolutions')}</SectionHead>
      <p className="-mt-2 mb-4 text-body-sm text-on-surface-variant">{t('detail.resolutionsLead')}</p>
      {c.resolutions.some((r) => r.description) ? (
        <AutoTranslateNote status={descTr.status} onRetry={descTr.retry} />
      ) : null}
      <ul className="flex flex-col gap-3">
        {c.resolutions.map((r, i) => (
          <ResolutionItem
            key={r.id}
            centerId={c.id}
            resolution={r}
            description={descTr.texts[i]}
            status={descTr.status}
          />
        ))}
      </ul>
    </section>
  );
}

function ResolutionItem({
  centerId,
  resolution: r,
  description,
  status,
}: {
  centerId: number;
  resolution: Resolution;
  description: string | undefined;
  status: ReturnType<typeof useAutoTranslate>['status'];
}) {
  const { t } = useTranslation(['centers', 'common']);
  const labels = useLabels();
  return (
    <li className="flex flex-col items-start justify-between gap-4 rounded-xl bg-canvas-cream p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-start gap-3.5">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-lowest text-secondary">
          <Icon name="description" className="text-[18px]" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="flex flex-wrap items-center gap-2">
            {r.type ? (
              <span className="rounded-full bg-badge-sage-bg px-2 py-0.5 text-label-sm font-bold text-badge-sage-text">
                {labels.domain(r.type)}
              </span>
            ) : null}
            {r.date ? <span className="text-[12px] text-neutral-muted">{labels.date(r.date)}</span> : null}
          </p>
          <h3 className="text-headline-sm font-semibold text-primary">{r.number ?? '—'}</h3>
          {r.description ? (
            status === 'pending' ? (
              <TextSkeleton lines={3} />
            ) : (
              <p lang={sourceLang(status)} className="text-body-sm text-on-surface-variant">
                {description}
              </p>
            )
          ) : null}
        </div>
      </div>
      {r.hasFile ? (
        <a
          href={withBase(resolutionFileUrl(centerId, r.id))}
          target="_blank"
          rel="noopener"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-label-md font-semibold text-on-primary transition-colors hover:bg-secondary"
        >
          <Icon name="picture_as_pdf" className="text-[18px]" /> {t('detail.viewPdf')}
          <span className="sr-only">{t('common:newTab')}</span>
        </a>
      ) : null}
    </li>
  );
}
