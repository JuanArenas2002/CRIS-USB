import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/presentation/components/ui/Icon';
import { withBase } from '@/shared/base';

export function TerritoryBanner() {
  const { t } = useTranslation('home');
  return (
    <section
      aria-labelledby="territory-title"
      className="relative w-full overflow-hidden py-20 text-on-primary"
    >
      <div aria-hidden="true" className="absolute inset-0">
        <img
          src={withBase('/assets/home/territory.jpg')}
          alt=""
          width={1408}
          height={768}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-surface-dark-forest/95 via-primary-container/80 to-surface-dark-forest/90" />
      </div>
      <div className="relative z-10 container-page">
        <div className="flex max-w-2xl flex-col gap-5">
          <p className="inline-flex items-center gap-2 text-label-md font-bold tracking-widest text-secondary-fixed uppercase">
            <span className="h-0.5 w-6 bg-secondary-fixed" />
            {t('territory.eyebrow')}
          </p>
          <h2
            id="territory-title"
            className="text-headline-lg-mobile font-bold tracking-tight md:text-headline-lg"
          >
            {t('territory.title')}
          </h2>
          <p className="text-body-lg text-primary-fixed">{t('territory.lead')}</p>
          <Link
            to="/proyectos"
            className="inline-flex h-12 items-center gap-2.5 self-start rounded-full bg-surface-dark-forest px-6 text-body-sm font-semibold ring-1 ring-secondary-fixed/40 transition-colors hover:bg-primary"
          >
            {t('territory.action')} <Icon name="arrow_forward" className="text-[18px]" />
          </Link>
        </div>
      </div>
    </section>
  );
}
