import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GroupLine } from '@/domain/groups/group';
import { AutoTranslateNote, sourceLang } from '@/presentation/components/ui/AutoTranslate';
import { Icon } from '@/presentation/components/ui/Icon';
import { useAutoTranslate } from '@/presentation/hooks/use-auto-translate';

const LINE_FIELDS = [
  { key: 'objective', label: 'detail.lineObjective', icon: 'flag' },
  { key: 'achievements', label: 'detail.lineAchievements', icon: 'emoji_events' },
  { key: 'impact', label: 'detail.lineImpact', icon: 'bolt' },
] as const;

/** Metri-K trae algunos nombres en minúscula ("frontera y derechos humanos"). */
const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

/** Más de 6 líneas: se muestran 6 y el resto con «Ver más líneas». */
const LINES_PREVIEW = 6;

/** Los campos de texto que tiene una línea (los vacíos no se muestran). */
const filledFields = (line: GroupLine) => LINE_FIELDS.filter((f) => line[f.key]);

/** Nombre y textos de cada línea: libres, del backend; se traducen en el navegador (no son nombres propios). */
export function ResearchLines({ lines }: { lines: GroupLine[] }) {
  const { t } = useTranslation(['groups', 'common']);
  const stride = 1 + LINE_FIELDS.length;
  const tr = useAutoTranslate(lines.flatMap((l) => [l.name, ...LINE_FIELDS.map((f) => l[f.key] ?? '')]));
  const text = (line: number, field: number) => tr.texts[line * stride + field];
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? lines : lines.slice(0, LINES_PREVIEW);
  const hidden = lines.length - LINES_PREVIEW;
  return (
    <div className="flex-1 border-border-subtle/60 pb-6 lg:border-r lg:pr-6 lg:pb-0 max-lg:border-b">
      <h3 className="mb-3.5 flex items-center gap-2 text-headline-sm font-bold tracking-tight text-primary">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-badge-sage-bg text-secondary">
          <Icon name="checklist_rtl" className="text-[20px]" />
        </span>
        {t('detail.lines')}
      </h3>
      <AutoTranslateNote status={tr.status} onRetry={tr.retry} />
      {tr.status === 'pending' && lines.length ? (
        <LinesSkeleton lines={shown} label={t('common:autoTranslate.pending')} />
      ) : lines.length ? (
        // Sin traducir en una interfaz en otro idioma, el texto se marca como español (lectores de pantalla).
        <div lang={sourceLang(tr.status)} className="grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2">
          {shown.map((line, i) => (
            <LineItem key={line.id} line={line} text={(field) => text(i, field)} />
          ))}
          {hidden > 0 ? (
            <button
              type="button"
              aria-expanded={showAll}
              onClick={() => setShowAll((v) => !v)}
              className="inline-flex items-center justify-center gap-1 justify-self-start rounded-lg px-3 py-2 text-label-md font-semibold text-secondary transition-colors hover:bg-surface-cream-alt sm:col-span-2"
            >
              {showAll ? t('detail.lessLines') : t('detail.moreLines', { count: hidden })}
              <Icon
                name="expand_more"
                className={`text-[18px] transition-transform ${showAll ? 'rotate-180' : ''}`}
              />
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-body-sm text-neutral-muted">{t('detail.noLines')}</p>
      )}
    </div>
  );
}

/** Esqueleto con la misma forma que las líneas: no se ve el español antes de la traducción. */
function LinesSkeleton({ lines, label }: { lines: GroupLine[]; label: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2">
      {lines.map((line, i) => (
        <div
          key={line.id}
          className="flex items-center gap-2.5 rounded-xl border border-border-subtle/80 bg-canvas-cream p-3"
        >
          <span className="h-[18px] w-[18px] shrink-0 animate-pulse rounded-full bg-surface-cream-alt motion-reduce:animate-none" />
          <span
            className="h-3.5 animate-pulse rounded bg-surface-cream-alt motion-reduce:animate-none"
            style={{ width: `${55 + ((i * 17) % 35)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

/** Una línea: nombre y, si tiene objetivo, logros o impacto, un detalle desplegable. */
function LineItem({ line, text }: { line: GroupLine; text: (field: number) => string | undefined }) {
  const { t } = useTranslation(['groups', 'common']);
  const fields = filledFields(line);
  return (
    <details className="group/line rounded-xl border border-border-subtle/80 bg-canvas-cream transition-colors open:bg-surface-container-lowest hover:bg-surface-cream-alt">
      <summary
        className={`flex list-none items-center gap-2.5 p-3 [&::-webkit-details-marker]:hidden ${
          fields.length ? 'cursor-pointer' : 'cursor-default'
        }`}
        onClick={(e) => {
          if (!fields.length) e.preventDefault();
        }}
      >
        <Icon name="check_circle" className="text-[18px] text-secondary" />
        <span className="flex-1 text-body-sm leading-tight font-medium text-on-surface">
          {capitalize(text(0)!)}
        </span>
        {fields.length ? (
          <Icon
            name="expand_more"
            className="text-[18px] text-neutral-muted transition-transform group-open/line:rotate-180"
          />
        ) : null}
      </summary>
      {fields.length ? (
        <dl className="flex flex-col gap-3 border-t border-surface-cream-alt px-4 pt-3 pb-4">
          {fields.map((f) => (
            <div key={f.key}>
              <dt className="flex items-center gap-1.5 text-label-md font-semibold text-secondary">
                <Icon name={f.icon} className="text-[16px]" /> {t(f.label)}
              </dt>
              <dd className="mt-1 text-body-sm whitespace-pre-line text-on-surface-variant">
                {text(1 + LINE_FIELDS.indexOf(f))}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </details>
  );
}
