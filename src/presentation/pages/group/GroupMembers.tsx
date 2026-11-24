import { withBaseUrl } from '@/shared/base';
import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { authorSlug, categoryOf, displayName, externalProfiles, initials } from '@/domain/authors/author';
import type { GroupDetail, GroupMember } from '@/domain/groups/group';
import { Icon } from '@/presentation/components/ui/Icon';
import { useLabels } from '@/presentation/hooks/use-labels';
import { filterMembers, isGroupLeader, sortMembers } from './group-model';
import { card } from './styles';

interface Props {
  members: GroupMember[] | undefined;
  leader: GroupDetail['leader'];
}

/** Integrantes del grupo: el líder primero, por categoría después, con búsqueda por nombre o categoría. */
export function GroupMembers({ members, leader }: Props) {
  const { t, i18n } = useTranslation(['groups', 'common', 'authors']);
  const labels = useLabels();
  const [term, setTerm] = useState('');
  if (!members)
    return (
      <div aria-busy="true" aria-label={t('members.loading')} className={`${card} h-48 animate-pulse`} />
    );

  const visible = filterMembers(sortMembers(members, leader, i18n.resolvedLanguage), term, labels.category);
  return (
    <section className={`${card} flex flex-col gap-5 p-5 md:p-6`}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-headline-md font-semibold text-primary">{t('members.title')}</h2>
          <p className="text-body-sm text-on-surface-variant">
            {t('members.lead', { count: members.length })}
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Icon
            name="search"
            className="pointer-events-none absolute top-2.5 left-3 text-[20px] text-on-surface-variant"
          />
          <label htmlFor="member-search" className="sr-only">
            {t('members.search')}
          </label>
          <input
            id="member-search"
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t('members.searchPlaceholder')}
            className="h-10 w-full rounded-lg bg-canvas-cream pr-3 pl-10 text-body-sm focus:ring-2 focus:ring-secondary focus:outline-none"
          />
        </div>
      </div>

      {visible.length ? (
        <ul className="grid grid-cols-1 gap-gutter md:grid-cols-2 xl:grid-cols-3">
          {visible.map((m) => (
            <MemberCard key={m.id} member={m} leader={isGroupLeader(m, leader)} />
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-body-md text-neutral-muted">{t('members.none')}</p>
      )}
    </section>
  );
}

function MemberCard({ member: m, leader }: { member: GroupMember; leader: boolean }) {
  const name = displayName(m.name);
  const cat = categoryOf(m.category);
  const profiles = externalProfiles(m);
  const cvlac = profiles.find((p) => p.label === 'CvLAC');
  const { t } = useTranslation(['groups', 'common', 'authors']);
  const labels = useLabels();
  return (
    <li className="flex flex-col justify-between rounded-xl bg-canvas-cream p-5 transition-all hover:shadow-md">
      <div>
        <div className="flex items-center gap-4">
          <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-dark-forest text-headline-sm font-bold text-secondary-fixed shadow-sm">
            {m.photoUrl ? (
              <img
                src={withBaseUrl(m.photoUrl)}
                alt=""
                width={64}
                height={64}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              initials(name)
            )}
          </span>
          <div className="min-w-0">
            <span className="rounded-full bg-badge-sage-bg px-2 py-0.5 text-label-sm font-bold text-badge-sage-text">
              {leader ? t('members.leader') : cat ? labels.researcher(cat.id) : t('members.member')}
            </span>
            <h3 className="mt-1 text-headline-sm leading-snug font-semibold text-primary">{name}</h3>
            {m.degree ? <p className="text-[12px] text-neutral-muted">{labels.domain(m.degree)}</p> : null}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-surface-container-lowest p-2 text-[12px]">
          {m.metrics ? (
            <>
              <span>
                <strong className="font-bold text-primary">{m.metrics.scopusPublications}</strong>{' '}
                {t('members.pubs')}
              </span>
              <span className="text-neutral-muted">|</span>
              <span>
                {t('members.hIndex')}{' '}
                <strong className="font-bold text-secondary">{m.metrics.hIndex ?? '—'}</strong>
              </span>
            </>
          ) : (
            <>
              <span>
                {t('members.category')} <strong className="font-bold text-primary">{cat?.code ?? '—'}</strong>
              </span>
              <span className="text-neutral-muted">|</span>
              <span>
                {t('members.profiles')}{' '}
                <strong className="font-bold text-secondary">{profiles.length}</strong>
              </span>
            </>
          )}
          <span className="text-neutral-muted">|</span>
          <span>Unisimón</span>
        </div>
      </div>
      {m.profilePublished ? (
        <Link
          to={`/investigadores/${authorSlug(m)}`}
          className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-lg bg-primary text-label-sm font-semibold text-on-primary transition-colors hover:bg-secondary"
        >
          {t('members.viewProfile')}
        </Link>
      ) : cvlac ? (
        <a
          href={cvlac.url}
          target="_blank"
          rel="noopener"
          className="mt-4 inline-flex h-9 w-full items-center justify-center gap-1 rounded-lg border border-border-subtle text-label-sm font-semibold text-primary transition-colors hover:bg-surface-container-lowest"
        >
          {t('members.viewCvlac')} <Icon name="open_in_new" className="text-[14px]" />
          <span className="sr-only">{t('common:newTab')}</span>
        </a>
      ) : null}
    </li>
  );
}
