import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { authorSlug, categoryOf, displayName, initials, type Author } from '@/domain/authors/author';
import { withBaseUrl } from '@/shared/base';
import { useLabels } from '@/presentation/hooks/use-labels';

const th = 'px-4 py-3 font-semibold';
const td = 'px-4 py-3 align-middle';

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
            <th scope="col" className={th}>
              {t('directory.colResearcher')}
            </th>
            <th scope="col" className={th}>
              {t('directory.colGroup')}
            </th>
            <th scope="col" className={`${th} text-center`}>
              {t('mincienciasCategory')}
            </th>
            <th scope="col" className={`${th} text-right`}>
              {t('card.usbIndex')}
            </th>
            <th scope="col" className={`${th} text-right`}>
              {t('directory.colRank')}
            </th>
            <th scope="col" className={`${th} text-right`}>
              {t('card.publications')}
            </th>
            <th scope="col" className={`${th} text-right`}>
              {t('card.hIndexShort')}
            </th>
            <th scope="col" className={`${th} text-right`}>
              {t('card.products')}
            </th>
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
