// Tarjeta principal del perfil: foto, nombre, datos clave, índice USB, grupos y centros.
import { withBaseUrl } from '@/shared/base';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { authorSlug, categoryOf, initials, type AuthorProfile, type GroupRef } from '@/domain/authors/author';
import { hasPublicDetail } from '@/domain/groups/group';
import { medalFor } from '@/presentation/components/authors/AuthorCard';
import { centerPath } from '@/presentation/components/centers/CenterCard';
import { Icon } from '@/presentation/components/ui/Icon';
import { useLabels } from '@/presentation/hooks/use-labels';
import { card, eyebrow } from './styles';

interface Props {
  author: AuthorProfile;
  name: string;
  groups: GroupRef[];
  centers: AuthorProfile['centers'];
  /** Hay perfiles académicos u ODS: la tarjeta cede las 3 columnas de la derecha al aside. */
  hasAside: boolean;
}

export function ProfileHero({ author, name, groups, centers, hasAside }: Props) {
  const { t } = useTranslation(['authors', 'common']);
  const labels = useLabels();
  const cat = categoryOf(author.category);
  return (
    <section
      className={`${card} relative overflow-hidden p-4 md:p-6 ${hasAside ? 'xl:col-span-9' : 'xl:col-span-12'}`}
    >
      <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-secondary-fixed/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-primary-fixed/20 blur-3xl" />
      <div className="relative z-10 grid grid-cols-1 items-start gap-6 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center sm:items-start">
          <Photo author={author} name={name} />
        </div>

        <div className="flex h-full min-w-0 flex-col justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-headline-lg-mobile font-bold tracking-tight text-primary-container md:text-headline-lg">
              {name}
            </h1>
            <CenterMedal ranking={author.ranking} />
          </div>

          <dl className="grid grid-cols-1 gap-4 rounded-xl bg-surface-cream-alt/60 p-4 sm:grid-cols-3">
            <Fact
              icon="school"
              label={t('profile.degree')}
              value={author.degree ? labels.domain(author.degree) : '—'}
            />
            <Fact
              icon="apartment"
              label={t('profile.mainGroup')}
              value={author.mainGroup?.name ?? '—'}
              hint={author.mainGroup?.code}
            />
            <Fact
              icon="workspace_premium"
              label={t('mincienciasCategory')}
              value={cat ? `${labels.category(cat.id)} (${cat.code})` : t('profile.noCategory')}
            />
          </dl>

          {author.ranking ? <UsbIndex ranking={author.ranking} /> : null}
          {groups.length ? <GroupChips groups={groups} /> : null}
          {centers.length ? <CenterChips centers={centers} /> : null}
        </div>
      </div>
    </section>
  );
}

/** Foto asignada en /admin/fotos; si no hay, monograma en el mismo marco de la plantilla. */
function Photo({ author, name }: { author: AuthorProfile; name: string }) {
  const { t } = useTranslation(['authors', 'common']);
  return (
    <div
      aria-hidden="true"
      className="relative flex h-52 w-44 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-badge-sage-bg shadow-md sm:h-64 sm:w-52"
    >
      {author.photoUrl ? (
        <img
          src={withBaseUrl(author.photoUrl)}
          alt=""
          width={512}
          height={512}
          className="absolute inset-0 h-full w-full rounded-xl object-cover object-top"
        />
      ) : (
        <span className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-surface-dark-forest text-[34px] font-bold text-secondary-fixed ring-8 ring-white/55">
          {initials(name)}
        </span>
      )}
      <span className="absolute right-2 bottom-2 left-2 truncate rounded bg-primary-container/85 px-2.5 py-1 text-center text-label-sm text-on-primary backdrop-blur-md">
        {t('profile.badge')}
      </span>
    </div>
  );
}

/** Top 3 de su centro en el ranking USB. */
function CenterMedal({ ranking }: { ranking: AuthorProfile['ranking'] }) {
  const { t } = useTranslation(['authors', 'common']);
  const medal = medalFor(ranking?.center ? ranking.centerRank : null);
  if (!medal) return null;
  return (
    <p
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-label-md font-bold shadow-sm ring-2 ${medal}`}
    >
      <Icon name="emoji_events" className="text-[20px]" />
      {t('card.topCenter', { rank: ranking!.centerRank, center: ranking!.center })}
    </p>
  );
}

/** Índice de productividad USB: valor y barra en una línea; los puestos, como texto. */
function UsbIndex({ ranking }: { ranking: NonNullable<AuthorProfile['ranking']> }) {
  const { t } = useTranslation(['authors', 'common']);
  const labels = useLabels();
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-container-lowest px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className={`flex items-center gap-1.5 ${eyebrow}`}>
          <Icon name="trending_up" className="text-[16px] text-primary-container" />
          {t('profile.usbIndex')}
        </p>
        <p className="text-label-md text-neutral-muted">
          {t('profile.generalRank', { rank: ranking.rank })}
          {ranking.center && ranking.centerRank ? (
            <>
              {' · '}
              <span className="font-semibold text-primary-container">
                {t('profile.centerRank', { rank: ranking.centerRank, center: ranking.center })}
              </span>
            </>
          ) : null}
        </p>
      </div>
      <div className="mt-2 flex items-center gap-4">
        <p className="shrink-0 leading-none text-primary-container">
          <span className="text-headline-sm font-bold tabular-nums">{labels.number(ranking.index)}</span>
          <span className="text-label-sm text-neutral-muted"> / 100</span>
        </p>
        <div
          role="meter"
          aria-label={t('profile.usbIndex')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={ranking.index}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary/15"
        >
          <div
            className="h-full rounded-full bg-secondary"
            style={{ width: `${Math.min(100, Math.max(0, ranking.index))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

const chipBox =
  'inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-container-lowest px-3 py-1.5 text-body-sm text-on-surface';

function GroupChips({ groups }: { groups: GroupRef[] }) {
  const { t } = useTranslation(['authors', 'common']);
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-1.5 text-label-md font-semibold text-on-surface-variant">
        <Icon name="groups" className="text-[18px] text-primary-container" /> {t('profile.groups')}
      </span>
      <div className="flex flex-wrap gap-2">
        {groups.map((g) => {
          const chip = (
            <>
              <Icon name="science" className="text-[16px] text-secondary" />
              <span className="font-semibold">{g.name}</span>
            </>
          );
          // Interinstitucionales: sin ficha pública, el grupo se nombra sin enlace.
          return hasPublicDetail(g) ? (
            <Link
              key={g.id}
              to={`/grupos/${authorSlug(g)}`}
              className={`group ${chipBox} transition-colors hover:border-primary-container hover:text-primary-container`}
            >
              {chip}
              <Icon
                name="arrow_forward"
                className="text-[14px] text-neutral-muted transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          ) : (
            <span key={g.id} className={chipBox}>
              {chip}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function CenterChips({ centers }: { centers: AuthorProfile['centers'] }) {
  const { t } = useTranslation(['authors', 'common']);
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-1.5 text-label-md font-semibold text-on-surface-variant">
        <Icon name="domain" className="text-[18px] text-primary-container" /> {t('profile.centers')}
      </span>
      <div className="flex flex-wrap gap-2">
        {centers.map((c) => (
          // Solo logo y sigla; el nombre completo va en el tooltip y para lectores de pantalla.
          <Link
            key={c.id}
            to={centerPath(c)}
            title={c.name}
            className="group inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-container-lowest px-2.5 py-1.5 text-body-sm text-on-surface transition-colors hover:border-primary-container hover:text-primary-container"
          >
            {c.logoUrl ? (
              <img
                src={withBaseUrl(c.logoUrl)}
                alt=""
                loading="lazy"
                className="h-7 w-auto max-w-16 object-contain"
              />
            ) : (
              <Icon name="domain" className="text-[18px] text-secondary" />
            )}
            <span className="font-semibold">{c.acronym ?? c.code}</span>
            <span className="sr-only">{c.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Fact({ icon, label, value, hint }: { icon: string; label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className={`flex items-center gap-1.5 ${eyebrow}`}>
        <Icon name={icon} className="text-[16px] text-primary-container" /> {label}
      </dt>
      <dd className="text-body-sm font-semibold text-on-surface">
        {value}
        {hint ? <span className="block text-label-sm font-normal text-neutral-muted">{hint}</span> : null}
      </dd>
    </div>
  );
}
