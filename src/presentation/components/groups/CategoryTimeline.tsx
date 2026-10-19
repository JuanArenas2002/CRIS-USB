import { Trans, useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { CATEGORY_LEVEL, type CategoryRecord } from '@/domain/groups/group';
import { TrendChart } from '@/presentation/components/charts/TrendChart';
import { useLabels } from '@/presentation/hooks/use-labels';

/** Escala oficial de grupos Minciencias, de la más baja a la más alta. */
const scale = (t: TFunction<'groups'>) => [
  { value: CATEGORY_LEVEL.RECONOCIDO!, label: t('timeline.recognized') },
  ...(['D', 'C', 'B', 'A', 'A1'] as const).map((c) => ({
    value: CATEGORY_LEVEL[c]!,
    label: t('timeline.cat', { category: c }),
  })),
];

const level = (category: string) => CATEGORY_LEVEL[category.toUpperCase()] ?? CATEGORY_LEVEL.RECONOCIDO!;
/** "Convocatoria 833 de 2018" → "833". */
const convNumber = (name: string) => /(\d{3,4})\s+de/.exec(name)?.[1];

/** Evolución de la categoría Minciencias del grupo, convocatoria por convocatoria. */
export function CategoryTimeline({ history }: { history: CategoryRecord[] }) {
  const { t } = useTranslation('groups');
  const labels = useLabels();
  if (!history.length) return <p className="text-body-sm text-neutral-muted">{t('timeline.empty')}</p>;

  const pill = (category: string) =>
    category.toUpperCase() === 'RECONOCIDO' ? t('timeline.recognizedShort') : t('timeline.cat', { category });

  const first = history[0]!;
  const last = history[history.length - 1]!;
  return (
    <TrendChart
      ariaLabel={t('timeline.aria', {
        first: labels.domain(first.category),
        firstYear: first.year ?? '—',
        last: labels.domain(last.category),
        lastYear: last.year ?? '—',
      })}
      yTicks={scale(t)}
      points={history.map((h, i) => ({
        key: `${h.convocation}-${i}`,
        value: level(h.category),
        xLabel: String(h.year ?? '—'),
        xSubLabel: convNumber(h.convocation) && t('timeline.conv', { number: convNumber(h.convocation) }),
        pill: pill(h.category),
        title: t('timeline.point', {
          convocation: labels.convocation(h.convocation),
          category: labels.domain(h.category),
        }),
      }))}
      caption={
        <>
          <span className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-secondary" />
            <span>
              <Trans t={t} i18nKey="timeline.scale" components={{ b: <strong className="text-primary" /> }} />
            </span>
          </span>
          <span>{t('timeline.source')}</span>
        </>
      }
    />
  );
}
