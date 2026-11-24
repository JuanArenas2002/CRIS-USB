// Equipo, grupos y centros: el equipo a un lado y grupos + centros apilados al otro.
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { authorSlug } from '@/domain/authors/author';
import type { Project } from '@/domain/projects/project';
import { centerPath } from '@/presentation/components/centers/CenterCard';
import { Icon } from '@/presentation/components/ui/Icon';
import { useCenters } from '@/presentation/hooks/use-centers';
import { useGroups } from '@/presentation/hooks/use-groups';
import { findByName } from './project-model';
import { SectionTitle, TeamList, card } from './ProjectParts';

export function ProjectTeam({ project: p }: { project: Project }) {
  const { t } = useTranslation(['projects', 'common', 'groups']);
  // Metri-K da los grupos y centros por nombre: se enlazan a su ficha si coinciden.
  const groups = useGroups().data ?? [];
  const centers = useCenters().data ?? [];
  const hasTeam = p.team.length > 0 || Boolean(p.allies);
  return (
    <section>
      <SectionTitle>{t('detail.team')}</SectionTitle>
      <div className={`grid grid-cols-1 items-start gap-6 ${hasTeam ? 'lg:grid-cols-2' : ''}`}>
        {hasTeam ? (
          <div className="flex flex-col gap-3">
            <h3 className="text-headline-sm font-semibold text-primary">{t('detail.leaders')}</h3>
            <div className={`${card} flex flex-col gap-4 p-4 text-body-sm`}>
              {p.team.length ? <TeamList team={p.team} /> : null}
              {p.allies ? (
                <dl className={p.team.length ? 'border-t border-surface-cream-alt pt-3' : undefined}>
                  <dt className="flex items-center gap-1 text-label-sm tracking-wider text-neutral-muted uppercase">
                    <Icon name="handshake" className="text-[16px]" /> {t('detail.allies')}
                  </dt>
                  <dd className="mt-1 font-semibold text-on-surface">{p.allies}</dd>
                </dl>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h3 className="text-headline-sm font-semibold text-primary">{t('detail.groups')}</h3>
            <ul className={`grid grid-cols-1 gap-3 ${hasTeam ? '' : 'sm:grid-cols-2'}`}>
              {p.groups.map((name) => (
                <RelatedItem
                  key={name}
                  icon="hub"
                  name={name}
                  to={(g) => `/grupos/${authorSlug(g)}`}
                  match={findByName(groups, name)}
                  linkLabel={t('detail.viewGroup')}
                />
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-headline-sm font-semibold text-primary">{t('detail.centers')}</h3>
            <ul className="grid grid-cols-1 gap-3">
              {p.centers.map((name) => (
                <RelatedItem
                  key={name}
                  icon="domain"
                  name={name}
                  to={centerPath}
                  match={findByName(centers, name)}
                  linkLabel={t('detail.viewCenter')}
                />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Un grupo o centro del proyecto: su nombre y, si coincide con uno publicado, el enlace a su ficha. */
function RelatedItem<T>({
  icon,
  name,
  match,
  to,
  linkLabel,
}: {
  icon: string;
  name: string;
  match: T | undefined;
  to: (item: T) => string;
  linkLabel: string;
}) {
  return (
    <li className={`${card} flex flex-col justify-between gap-3 p-4`}>
      <p className="flex items-start gap-2 font-semibold text-primary">
        <Icon name={icon} className="mt-0.5 text-[18px] text-secondary" /> {name}
      </p>
      {match ? (
        <Link
          to={to(match)}
          className="inline-flex items-center gap-1 border-t border-surface-cream-alt pt-2 text-label-md font-semibold text-secondary hover:underline"
        >
          {linkLabel} <Icon name="arrow_forward" className="text-[16px]" />
        </Link>
      ) : null}
    </li>
  );
}
