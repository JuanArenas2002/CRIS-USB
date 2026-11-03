import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ProjectSpotlight } from '@/presentation/components/home/ProjectSpotlight';
import { Icon } from '@/presentation/components/ui/Icon';
import { withBase } from '@/shared/base';
import { IRAKA_URL } from '@/shared/contact';

export const HOME_AREAS_ID = 'areas';

const action =
  'inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-body-sm font-semibold transition-colors';
const secondary =
  'bg-surface-container-lowest/80 text-primary-container ring-1 ring-primary-container/30 hover:bg-badge-sage-bg';

export function HomeHero() {
  const { t } = useTranslation(['home', 'common']);
  return (
    <section
      aria-labelledby="home-title"
      className="relative w-full overflow-hidden bg-surface-container-lowest pt-10 pb-16 lg:pt-12 lg:pb-20"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-full min-[1360px]:w-3/5"
      >
        <img
          src={withBase('/assets/home/hero.jpg')}
          alt=""
          width={900}
          height={600}
          decoding="async"
          fetchPriority="high"
          className="h-full w-full object-cover object-top opacity-30 min-[1360px]:opacity-100"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-surface-container-lowest via-surface-container-lowest/80 to-transparent min-[1360px]:from-10% min-[1360px]:via-surface-container-lowest/10 min-[1360px]:via-30%" />
      </div>
      <div className="relative z-10 container-page grid grid-cols-1 items-center gap-8 lg:min-h-[520px] lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <p className="inline-flex items-center gap-2 text-label-md font-bold tracking-wider text-primary-container uppercase">
            <span className="h-0.5 w-6 bg-primary-container" />
            {t('hero.eyebrow')}
          </p>
          <h1
            id="home-title"
            className="max-w-2xl text-display-hero-mobile font-bold tracking-tight text-primary-container md:text-display-hero"
          >
            {t('hero.title')}
          </h1>
          <p className="max-w-xl text-body-lg text-on-surface-variant">{t('hero.lead')}</p>
          <div className="flex flex-col flex-wrap gap-3 pt-2 sm:max-w-xl sm:flex-row">
            <a
              href={IRAKA_URL}
              target="_blank"
              rel="noopener"
              className={`${action} bg-primary-container text-on-primary shadow-lg shadow-primary-container/20 hover:bg-primary`}
            >
              {t('hero.iraka')} <Icon name="open_in_new" className="text-[18px]" />
              <span className="sr-only">{t('common:newTab')}</span>
            </a>
            <a href={`#${HOME_AREAS_ID}`} className={`${action} ${secondary}`}>
              {t('hero.explore')} <Icon name="arrow_forward" className="text-[18px]" />
            </a>
            <Link to="/investigadores" className={`${action} ${secondary}`}>
              {t('hero.researchers')}
            </Link>
          </div>
        </div>
        <div className="flex justify-end lg:col-span-5 min-[1360px]:self-end min-[1360px]:pt-40">
          <ProjectSpotlight />
        </div>
      </div>
    </section>
  );
}
