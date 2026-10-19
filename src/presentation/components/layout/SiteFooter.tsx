import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CONTACT_EMAIL } from '@/shared/contact';
import { NAV_ITEMS } from '@/shared/navigation';

export function SiteFooter() {
  const { t } = useTranslation();
  return (
    <footer className="w-full bg-surface-dark-forest py-16 text-on-primary">
      <div className="container-page">
        <div className="mb-10 grid grid-cols-1 gap-gutter md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <img
              src="/assets/unisimon-logo.png"
              alt="Universidad Simón Bolívar"
              width={172}
              height={28}
              loading="lazy"
              className="h-7 w-auto self-start brightness-0 invert"
            />
            <span className="mt-1 text-headline-sm font-semibold tracking-tight">UNISIMÓN RESEARCH</span>
            <p className="text-body-sm text-primary-fixed-dim">{t('footer.tagline')}</p>
          </div>
          <nav aria-label={t('footer.nav')} className="flex flex-col gap-2">
            <span className="text-label-md tracking-wider text-tertiary-fixed uppercase">
              {t('footer.navTitle')}
            </span>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-body-sm text-primary-fixed-dim hover:text-on-primary"
              >
                {t(`nav.items.${item.key}.label`)}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-2 text-body-sm text-primary-fixed-dim">
            <span className="text-label-md tracking-wider text-tertiary-fixed uppercase">
              {t('footer.contactTitle')}
            </span>
            <p>{t('footer.location')}</p>
            <p>{t('footer.office')}</p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="underline-offset-2 hover:text-on-primary hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>
        <p className="border-t border-primary-container pt-6 text-label-sm text-primary-fixed-dim">
          {t('footer.rights')}
        </p>
      </div>
    </footer>
  );
}
