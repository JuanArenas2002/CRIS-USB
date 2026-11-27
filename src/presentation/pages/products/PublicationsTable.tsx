import { useTranslation } from 'react-i18next';
import { publicationUrl, type ListedPublication } from '@/domain/publications/publication';
import { useLabels } from '@/presentation/hooks/use-labels';
import { activeLocale } from '@/i18n';
import { Icon } from '@/presentation/components/ui/Icon';
import { languageName } from './products-model';

type Col =
  | 'title'
  | 'year'
  | 'type'
  | 'journal'
  | 'citations'
  | 'language'
  | 'openAccess'
  | 'international'
  | 'correspondence'
  | 'link';

type Align = 'left' | 'center' | 'right';

/** Alineación solo en pantalla ancha: en tarjeta (móvil) cada valor va a la derecha de su etiqueta. */
const ALIGN: Record<Align, string> = { left: '', center: 'xl:text-center', right: 'xl:text-right' };

/**
 * Ancho de cada columna en pantalla ancha (suman 100 %): la tabla usa todo el ancho y el texto se parte en
 * varias líneas, así nunca hay desplazamiento lateral. Por debajo de `xl` cada fila es una tarjeta.
 */
const COLUMNS: readonly { key: Col; width: string; align: Align }[] = [
  { key: 'title', width: 'xl:w-[26%]', align: 'left' },
  { key: 'year', width: 'xl:w-[5%]', align: 'center' },
  { key: 'type', width: 'xl:w-[10%]', align: 'left' },
  { key: 'journal', width: 'xl:w-[15%]', align: 'left' },
  { key: 'citations', width: 'xl:w-[6%]', align: 'right' },
  { key: 'language', width: 'xl:w-[7%]', align: 'left' },
  { key: 'openAccess', width: 'xl:w-[6%]', align: 'center' },
  { key: 'international', width: 'xl:w-[8%]', align: 'center' },
  { key: 'correspondence', width: 'xl:w-[9%]', align: 'center' },
  { key: 'link', width: 'xl:w-[8%]', align: 'center' },
];
const ALIGN_OF = Object.fromEntries(COLUMNS.map((c) => [c.key, c.align])) as Record<Col, Align>;

// Celda: texto que se parte donde haga falta. En tarjeta: «etiqueta … valor» (la etiqueta sale de data-label).
const cell =
  'px-2 py-3 align-top [overflow-wrap:anywhere] before:block before:shrink-0 before:text-left before:font-semibold before:text-on-surface-variant before:content-[attr(data-label)] xl:before:hidden max-xl:flex max-xl:items-baseline max-xl:justify-between max-xl:gap-4 max-xl:px-0 max-xl:py-1.5 max-xl:text-right';

/** Tabla del ranking en pantalla ancha y tarjetas en pantallas estrechas; nunca se desplaza de lado. */
export function PublicationsTable({ items }: { items: ListedPublication[] }) {
  const { t } = useTranslation(['publications', 'common']);
  const labels = useLabels();
  const yesNo = (v: boolean) => (v ? t('table.yes') : t('table.no'));
  const label = (c: Col) => (c === 'type' ? t('type') : t(`table.${c}`));
  const td = (c: Col, extra = '') => ({
    role: 'cell' as const,
    'data-label': label(c),
    className: `${cell} ${ALIGN[ALIGN_OF[c]]} ${extra}`,
  });
  return (
    <table
      role="table"
      className="w-full border-collapse text-left text-body-sm max-xl:block xl:table-fixed xl:text-label-md"
    >
      <caption className="sr-only">{t('table.caption')}</caption>
      <colgroup>
        {COLUMNS.map((c) => (
          <col key={c.key} className={c.width} />
        ))}
      </colgroup>
      <thead role="rowgroup" className="max-xl:sr-only">
        <tr role="row" className="bg-surface-cream-alt text-label-sm leading-tight text-on-surface-variant">
          {COLUMNS.map((c) => (
            <th
              key={c.key}
              role="columnheader"
              scope="col"
              className={`px-2 py-3 font-semibold [overflow-wrap:anywhere] ${ALIGN[c.align]}`}
            >
              {label(c.key)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody
        role="rowgroup"
        className="divide-y divide-surface-cream-alt max-xl:flex max-xl:flex-col max-xl:gap-3 max-xl:divide-y-0"
      >
        {items.map((p) => (
          <tr
            key={p.eid}
            role="row"
            className="transition-colors hover:bg-surface-cream-alt/40 max-xl:block max-xl:rounded-xl max-xl:bg-surface-container-lowest max-xl:p-4 max-xl:shadow-sm max-xl:ring-1 max-xl:ring-border-subtle"
          >
            <td {...td('title')}>
              <a
                href={publicationUrl(p)}
                target="_blank"
                rel="noopener"
                className="font-semibold text-primary-container hover:text-primary hover:underline"
              >
                {p.title}
                <span className="sr-only"> {t('common:newTab')}</span>
              </a>
            </td>
            <td {...td('year', 'tabular-nums')}>{p.year ?? '—'}</td>
            <td {...td('type')}>{p.type ? labels.domain(p.type) : '—'}</td>
            <td {...td('journal')}>{p.journal ?? '—'}</td>
            <td {...td('citations', 'tabular-nums')}>{labels.number(p.citations)}</td>
            <td {...td('language')}>{p.language ? languageName(p.language, activeLocale()) : '—'}</td>
            <td {...td('openAccess')}>{yesNo(p.openAccess)}</td>
            <td {...td('international')}>{yesNo(p.international)}</td>
            <td {...td('correspondence')}>{yesNo(p.correspondence)}</td>
            <td {...td('link')}>
              {p.doi ? (
                <a
                  href={`https://doi.org/${p.doi}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1 text-primary-container hover:text-primary hover:underline"
                >
                  {t('table.view')}
                  <Icon name="open_in_new" className="text-[14px]" />
                  <span className="sr-only"> {t('common:newTab')}</span>
                </a>
              ) : (
                '—'
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
