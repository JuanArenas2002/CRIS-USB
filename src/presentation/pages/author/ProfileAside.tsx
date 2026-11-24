// Columna derecha del perfil: perfiles académicos externos y ODS que hereda de sus grupos.
import { useTranslation } from 'react-i18next';
import type { ExternalProfile } from '@/domain/authors/author';
import type { inheritOds } from '@/domain/ods/ods';
import { OdsIcon } from '@/presentation/components/groups/OdsIcons';
import { IdLogo } from '@/presentation/components/ui/IdLogo';
import { Icon } from '@/presentation/components/ui/Icon';
import { useLabels } from '@/presentation/hooks/use-labels';
import { card } from './styles';

interface Props {
  profiles: ExternalProfile[];
  ods: ReturnType<typeof inheritOds>;
}

export function ProfileAside({ profiles, ods }: Props) {
  return (
    <aside
      className={`grid content-start gap-gutter xl:col-span-3 xl:flex xl:flex-col ${
        profiles.length && ods.length ? 'md:grid-cols-2' : ''
      }`}
    >
      {profiles.length ? <AcademicProfiles profiles={profiles} /> : null}
      {ods.length ? <LinkedOds ods={ods} /> : null}
    </aside>
  );
}

function AcademicProfiles({ profiles }: { profiles: ExternalProfile[] }) {
  const { t } = useTranslation(['authors', 'common']);
  const labels = useLabels();
  return (
    <section aria-labelledby="perfiles-academicos" className={`${card} p-5`}>
      <h2
        id="perfiles-academicos"
        className="flex items-center gap-1.5 text-label-md font-semibold text-on-surface-variant"
      >
        <Icon name="fingerprint" className="text-[18px] text-primary-container" />
        {t('profile.academicProfiles')}
      </h2>
      <ul className="mt-2 divide-y divide-surface-container">
        {profiles.map((p) => (
          <li key={p.label}>
            <a
              href={p.url}
              target="_blank"
              rel="noopener"
              className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-cream-alt/60 focus-visible:outline-2 focus-visible:outline-primary-container"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-white">
                <IdLogo label={p.label} size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body-sm font-semibold text-on-surface group-hover:text-primary-container">
                  {p.label}
                </span>
                <span className="block truncate text-label-sm text-neutral-muted">
                  {labels.domain(p.value)}
                </span>
              </span>
              <Icon
                name="open_in_new"
                className="text-[16px] text-neutral-muted group-hover:text-primary-container"
              />
              <span className="sr-only">{t('common:newTab')}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LinkedOds({ ods }: { ods: ReturnType<typeof inheritOds> }) {
  const { t } = useTranslation(['authors', 'common']);
  return (
    <section aria-labelledby="ods-vinculados" className={`${card} p-5 xl:flex-1`}>
      <h2
        id="ods-vinculados"
        className="flex items-center gap-1.5 text-label-md font-semibold text-on-surface-variant"
      >
        <Icon name="public" className="text-[18px] text-primary-container" />
        {t('profile.odsLinked')}
      </h2>
      {/* Heredados de los grupos del investigador; el tooltip dice de cuál viene cada uno. */}
      <ul className="mt-3 flex flex-wrap gap-2">
        {ods.map((o) => (
          <li key={o.id}>
            <OdsIcon id={o.id} size={40} note={t('profile.odsVia', { groups: o.groups.join(', ') })} />
          </li>
        ))}
      </ul>
    </section>
  );
}
