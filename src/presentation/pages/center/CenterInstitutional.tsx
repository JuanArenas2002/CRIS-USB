import { useTranslation } from 'react-i18next';
import { displayName, externalProfiles } from '@/domain/authors/author';
import type { CenterDetail } from '@/domain/centers/center';
import { CenterStatus } from '@/presentation/components/centers/CenterCard';
import { Icon } from '@/presentation/components/ui/Icon';
import { IdLogo } from '@/presentation/components/ui/IdLogo';
import { Field, InfoColumn, SectionHead } from '@/presentation/components/ui/InfoBlocks';
import { useLabels } from '@/presentation/hooks/use-labels';
import { yearsSince } from '@/shared/years';
import { createdAtLabel } from './center-model';
import { card } from './styles';

/** Información institucional: identificación, ubicación y director. */
export function CenterInstitutional({ center: c }: { center: CenterDetail }) {
  const { t } = useTranslation(['centers', 'common']);
  return (
    <section className={`${card} p-5 md:p-6`}>
      <SectionHead icon="corporate_fare">{t('detail.institutional')}</SectionHead>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        <Identification center={c} />
        <InfoColumn icon="location_on" title={t('detail.location')}>
          <Field label={t('detail.campus')}>{c.city ? displayName(c.city) : '—'}</Field>
          <Field label={t('detail.department')}>{c.department ? displayName(c.department) : '—'}</Field>
          <Field label={t('detail.dane')}>
            <span className="font-mono">{c.daneCode ?? '—'}</span>
          </Field>
        </InfoColumn>
        <Director director={c.director} />
      </div>
    </section>
  );
}

function Identification({ center: c }: { center: CenterDetail }) {
  const { t } = useTranslation(['centers', 'common']);
  const labels = useLabels();
  return (
    <InfoColumn icon="badge" title={t('detail.identification')}>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t('detail.code')}>
          <span className="font-mono text-primary">{c.code}</span>
        </Field>
        <Field label={t('detail.acronym')}>{c.acronym ?? '—'}</Field>
      </div>
      <Field label={t('detail.createdAt')}>
        {createdAtLabel(t, labels.date, c.createdAt, yearsSince(c.foundedYear))}
      </Field>
      <Field label={t('detail.status')}>
        <CenterStatus size="sm" />
      </Field>
      {c.website ? (
        <a
          href={c.website}
          target="_blank"
          rel="noopener"
          className="mt-1 inline-flex items-center justify-center gap-2 self-start rounded-lg bg-secondary px-4 py-2.5 text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        >
          <Icon name="language" className="text-[18px]" /> {t('detail.website')}
          <Icon name="open_in_new" className="text-[16px]" />
          <span className="sr-only">{t('common:newTab')}</span>
        </a>
      ) : null}
    </InfoColumn>
  );
}

function Director({ director }: { director: CenterDetail['director'] }) {
  const { t } = useTranslation(['centers', 'common']);
  const labels = useLabels();
  const profiles = director ? externalProfiles(director) : [];
  return (
    <InfoColumn icon="verified_user" title={t('detail.directorTitle')}>
      {director ? (
        <>
          <Field label={t('detail.directorName')}>{displayName(director.name)}</Field>
          {profiles.length ? (
            <Field label={t('detail.profiles')}>
              <ul className="mt-1 flex flex-wrap gap-2">
                {profiles.map((p) => (
                  <li key={p.label}>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener"
                      title={`${p.label}: ${labels.domain(p.value)}`}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-surface-container-lowest transition-colors hover:border-primary-container focus-visible:outline-2 focus-visible:outline-primary-container"
                    >
                      <IdLogo label={p.label} size={24} />
                      <span className="sr-only">
                        {`${p.label}: ${labels.domain(p.value)} ${t('common:newTab')}`}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </Field>
          ) : null}
        </>
      ) : (
        <p className="text-body-sm text-neutral-muted">{t('detail.noDirector')}</p>
      )}
    </InfoColumn>
  );
}
