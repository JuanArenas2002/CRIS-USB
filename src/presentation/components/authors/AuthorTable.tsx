import { useId } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { authorSlug, categoryOf, displayName, initials, type Author } from '@/domain/authors/author';
import { withBaseUrl } from '@/shared/base';
import { useLabels } from '@/presentation/hooks/use-labels';

const th = 'px-4 py-3 font-semibold';
const td = 'px-4 py-3 align-middle';

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;
// Etiqueta (clave i18n), descripción (directory.colHelp.*) y alineación de cada columna.
const COLUMNS = [
  { label: 'directory.colResearcher', help: 'researcher', align: 'left' },
  { label: 'directory.colGroup', help: 'group', align: 'left' },
  { label: 'mincienciasCategory', help: 'category', align: 'center' },
  { label: 'card.usbIndex', help: 'usb', align: 'right' },
  { label: 'directory.colRank', help: 'rank', align: 'right' },
  { label: 'card.publications', help: 'publications', align: 'right' },
  { label: 'card.hIndexShort', help: 'hIndex', align: 'right' },
  { label: 'card.products', help: 'products', align: 'right' },
] as const;

/**
 * Encabezado con la descripción de la columna: tarjeta forest que se abre con el cursor o con el foco del
 * teclado (la «i» es un botón). Se ancla al borde del texto para no desbordar la tabla.
 */
function ColumnHead({ label, help, align }: { label: string; help: string; align: keyof typeof ALIGN }) {
  const id = useId();
  return (
    <th scope="col" className={`${th} ${ALIGN[align]}`}>
      <span className="group relative inline-flex items-center gap-1.5">
        {label}
        <button
          type="button"
          aria-describedby={id}
          aria-label={label}
          className="flex h-4 w-4 cursor-help items-center justify-center rounded-full text-[10px] leading-none font-bold normal-case ring-1 ring-current transition-colors hover:bg-primary hover:text-on-primary hover:ring-primary focus-visible:bg-primary focus-visible:text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        >
          i
        </button>
        <span
          id={id}
          role="tooltip"
          className={`pointer-events-none invisible absolute top-full z-30 mt-2 w-64 rounded-xl bg-surface-dark-forest p-3.5 text-left text-label-sm leading-snug font-normal tracking-normal text-on-primary normal-case opacity-0 shadow-xl transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <span className="mb-1 block font-bold tracking-wider text-secondary-fixed uppercase">{label}</span>
          {help}
        </span>
      </span>
    </th>
  );
}

/**
 * Vista general del directorio ("Investigadores Unisimón"): una fila por investigador con lo que
 * se compara de un vistazo. Los Top siguen en tarjetas. En móvil la tabla se desplaza dentro de su
 * caja (la página no).
 */
export function AuthorTable({ authors }: { authors: Author[] }) {
  const { t } = useTranslation('authors');
  const labels = useLabels();
  const num = (v: number | null | undefined) => (v == null ? '—' : labels.number(v));
  return (
    <div className="overflow-x-auto rounded-2xl bg-surface-container-lowest shadow-sm ring-1 ring-border-subtle">
      <table className="w-full min-w-[760px] border-collapse text-left text-body-sm">
        <thead>
          <tr className="bg-surface-cream-alt text-label-sm tracking-wider text-on-surface-variant uppercase">
            {COLUMNS.map(({ label, help, align }) => (
              <ColumnHead key={help} label={t(label)} help={t(`directory.colHelp.${help}`)} align={align} />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-cream-alt">
          {authors.map((a) => {
            const name = displayName(a.name);
            return (
              <tr key={a.id} className="transition-colors hover:bg-surface-cream-alt/40">
                <th scope="row" className={`${td} font-normal`}>
                  <div className="flex items-center gap-3">
                    {a.photoUrl ? (
                      <img
                        src={withBaseUrl(a.photoUrl)}
                        alt=""
                        width={40}
                        height={40}
                        loading="lazy"
                        decoding="async"
                        className="h-10 w-10 shrink-0 rounded-full object-cover object-top"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-dark-forest text-label-md font-bold text-secondary-fixed"
                      >
                        {initials(name)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <Link
                        to={`/investigadores/${authorSlug(a)}`}
                        className="font-bold text-primary-container hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-secondary"
                      >
                        {name}
                      </Link>
                      <p className="text-label-sm text-secondary">{labels.researcher(a.category)}</p>
                    </div>
                  </div>
                </th>
                <td className={`${td} max-w-64 text-on-surface-variant`}>
                  <span className="line-clamp-2" title={a.mainGroup?.name}>
                    {a.mainGroup?.name ?? '—'}
                  </span>
                </td>
                <td className={`${td} text-center font-semibold`}>{categoryOf(a.category)?.code ?? '—'}</td>
                <td className={`${td} text-right font-bold text-primary tabular-nums`}>
                  {num(a.ranking?.index)}
                </td>
                <td className={`${td} text-right tabular-nums`}>{a.ranking ? `#${a.ranking.rank}` : '—'}</td>
                <td className={`${td} text-right tabular-nums`}>{num(a.metrics?.scopusPublications)}</td>
                <td className={`${td} text-right tabular-nums`}>{num(a.metrics?.hIndex)}</td>
                <td className={`${td} text-right tabular-nums`}>{num(a.metrics?.products)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
