import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/presentation/components/ui/Icon';
import { Trajectory } from '@/presentation/components/ui/Trajectory';
import { withBase } from '@/shared/base';
import { GLOBAL_URL, IRAKA_URL } from '@/shared/contact';

export const HOME_AREAS_ID = 'areas';

const action =
  'inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-body-sm font-semibold transition-colors';
// Botón fantasma de la guía web: borde blanco al 28 %, 60 % en hover.
const ghost = 'text-on-primary ring-1 ring-on-primary/30 hover:ring-on-primary/60';

export function HomeHero() {
  const { t } = useTranslation(['home', 'common']);
  return (
    <section
      aria-labelledby="home-title"
      className="relative w-full overflow-hidden bg-primary pt-14 pb-20 lg:pt-16 lg:pb-24"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <img
          src={withBase('/assets/home/hero.jpg')}
          alt=""
          width={900}
          height={600}
          decoding="async"
          fetchPriority="high"
          className="h-full w-full object-cover object-top"
        />
        {/* Guía web: degradado forest de 55 % a 95 % y brillo jasmine arriba a la derecha. */}
        <div className="absolute inset-0 bg-linear-to-b from-primary/55 to-primary/95" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,--alpha(var(--color-secondary-fixed)/22%),transparent_45%)]" />
        <Trajectory
          variant="horizon"
          preserveAspectRatio="xMidYMax slice"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] w-full"
        />
      </div>
      <div className="relative z-10 container-page grid grid-cols-1 items-center gap-10 lg:min-h-[520px] lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <p className="inline-flex items-center gap-2 text-label-sm font-bold tracking-[0.16em] text-primary-fixed uppercase">
            <span className="h-2 w-2 rounded-full bg-secondary-fixed" />
            {t('hero.eyebrow')}
          </p>
          <h1
            id="home-title"
            className="max-w-2xl text-display-hero-mobile font-bold text-on-primary md:text-display-hero"
          >
            {t('hero.title')}
          </h1>
          <p className="max-w-xl text-body-lg text-primary-fixed">{t('hero.lead')}</p>
          <div className="flex flex-col flex-wrap gap-3 pt-2 sm:max-w-xl sm:flex-row [&_:focus-visible]:outline-secondary-fixed">
            <a
              href={IRAKA_URL}
              target="_blank"
              rel="noopener"
              className={`${action} bg-secondary text-on-primary hover:bg-secondary-fixed hover:text-primary`}
            >
              {t('hero.iraka')} <Icon name="open_in_new" className="text-[18px]" />
              <span className="sr-only">{t('common:newTab')}</span>
            </a>
            <a href={`#${HOME_AREAS_ID}`} className={`${action} ${ghost}`}>
              {t('hero.explore')} <Icon name="arrow_forward" className="text-[18px]" />
            </a>
            <Link to="/investigadores" className={`${action} ${ghost}`}>
              {t('hero.researchers')}
            </Link>
            <a href={GLOBAL_URL} target="_blank" rel="noopener" className={`${action} ${ghost}`}>
              Unisimon Global <Icon name="open_in_new" className="text-[18px]" />
              <span className="sr-only">{t('common:newTab')}</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
