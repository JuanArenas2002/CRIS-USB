import { useTranslation } from 'react-i18next';
import type { CenterDetail } from '@/domain/centers/center';
import { AutoTranslateNote, TextSkeleton, sourceLang } from '@/presentation/components/ui/AutoTranslate';
import { OdsLinked } from '@/presentation/components/groups/OdsIcons';
import { Icon } from '@/presentation/components/ui/Icon';
import { useAutoTranslate } from '@/presentation/hooks/use-auto-translate';
import { card } from './styles';

/** Líneas de investigación (textos libres de Metri-K, traducidos en el navegador) + ODS vinculados. */
export function CenterLinesAndOds({ center: c }: { center: CenterDetail }) {
  const { t } = useTranslation(['centers', 'common']);
  const linesTr = useAutoTranslate(c.lines.map((l) => l.name));
  return (
    <section
      className={`${card} flex flex-col items-stretch gap-6 p-5 md:p-6 lg:flex-row`}
      aria-label={t('detail.linesAndOds')}
    >
      <div className="flex-1 border-border-subtle/60 pb-6 max-lg:border-b lg:border-r lg:pr-6 lg:pb-0">
        <h2 className="mb-3.5 flex items-center gap-2 text-headline-sm font-bold tracking-tight text-primary">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-badge-sage-bg text-secondary">
            <Icon name="checklist_rtl" className="text-[20px]" />
          </span>
          {t('detail.lines')}
        </h2>
        {c.lines.length ? <AutoTranslateNote status={linesTr.status} onRetry={linesTr.retry} /> : null}
        {c.lines.length ? (
          <ul
            lang={sourceLang(linesTr.status)}
            aria-busy={linesTr.status === 'pending'}
            className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
          >
            {c.lines.map((l, i) => (
              <li
                key={l.id}
                className="flex items-center gap-2.5 rounded-xl border border-border-subtle/80 bg-canvas-cream p-3"
              >
                <Icon name="check_circle" className="text-[18px] text-secondary" />
                {linesTr.status === 'pending' ? (
                  <span className="flex-1">
                    <TextSkeleton lines={1} />
                  </span>
                ) : (
                  <span className="text-body-sm leading-tight font-medium text-on-surface">
                    {linesTr.texts[i]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-neutral-muted">{t('detail.noLines')}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col lg:w-[22rem] xl:w-[26rem]">
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2.5 text-headline-sm font-bold tracking-tight text-primary">
            <Icon name="public" className="text-[24px] text-secondary" /> {t('detail.ods')}
          </h2>
          <span className="rounded-full bg-surface-cream-alt px-3 py-1 text-[12px] font-medium text-on-surface-variant">
            {t('detail.agenda')}
          </span>
        </div>
        <OdsLinked ods={c.ods} empty={t('detail.noOds')} />
      </div>
    </section>
  );
}
