import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, activeLocale } from '@/i18n';
import { Icon } from '@/presentation/components/ui/Icon';
import { prepareTranslator } from '@/presentation/hooks/use-auto-translate';

type Lang = (typeof LANGUAGES)[number];

/** Nombre del idioma en el idioma de la interfaz ("inglés", "Spanish"…), vía Intl. */
const otherName = (code: string) => {
  const name = new Intl.DisplayNames([activeLocale()], { type: 'language' }).of(code) ?? code;
  return name.charAt(0).toLocaleUpperCase(activeLocale()) + name.slice(1);
};

function useChooser() {
  const { i18n } = useTranslation();
  const current = LANGUAGES.find((l) => l.code === i18n.resolvedLanguage) ?? LANGUAGES[0];
  const choose = (code: Lang['code']) => {
    prepareTranslator(code); // el clic es el gesto que permite descargar el traductor del navegador
    void i18n.changeLanguage(code);
  };
  return { current, choose };
}

/**
 * Selector de idioma. `dropdown`: chip (globo + código) que abre un panel con cada idioma en su
 * nombre nativo y en el de la interfaz. `inline`: control segmentado para el menú móvil.
 * Patrón disclosure con <details> (como el menú móvil): teclado y sin JavaScript de por medio.
 */
export function LanguageSelector({
  variant = 'dropdown',
  className = '',
}: {
  variant?: 'dropdown' | 'inline';
  className?: string;
}) {
  const { t } = useTranslation();
  const { current, choose } = useChooser();
  const ref = useRef<HTMLDetailsElement>(null);

  // Escape y clic fuera cierran el panel, como un menú nativo.
  useEffect(() => {
    if (variant !== 'dropdown') return;
    const close = (e: Event) => {
      const d = ref.current;
      if (!d?.open) return;
      if (e instanceof KeyboardEvent) {
        if (e.key !== 'Escape') return;
        d.open = false;
        d.querySelector('summary')?.focus();
      } else if (!d.contains(e.target as Node)) d.open = false;
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', close);
    };
  }, [variant]);

  if (variant === 'inline')
    return (
      <div className={className}>
        <p className="mb-1.5 flex items-center gap-1.5 px-1 text-label-sm tracking-wider text-neutral-muted uppercase">
          <Icon name="language" className="text-[16px]" /> {t('language.label')}
        </p>
        <div
          role="group"
          aria-label={t('language.label')}
          className="grid grid-cols-3 gap-1 rounded-xl bg-surface-cream-alt p-1"
        >
          {LANGUAGES.map((l) => {
            const active = l.code === current.code;
            return (
              <button
                key={l.code}
                type="button"
                lang={l.code}
                aria-pressed={active}
                onClick={() => choose(l.code)}
                className={`flex flex-col items-center rounded-lg px-1 py-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none ${
                  active
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-lowest hover:text-primary'
                }`}
              >
                <span className="text-label-md font-bold uppercase">{l.code}</span>
                <span className="text-[10px] leading-tight">{l.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );

  return (
    <details ref={ref} className={`group/lang relative ${className}`}>
      <summary
        aria-label={`${t('language.label')}: ${current.label}`}
        className="flex h-10 cursor-pointer list-none items-center gap-1.5 rounded-lg bg-surface-cream-alt px-2.5 text-label-md font-semibold text-primary transition-colors group-open/lang:bg-badge-sage-bg hover:bg-badge-sage-bg focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none [&::-webkit-details-marker]:hidden"
      >
        <Icon name="language" className="text-[20px]" />
        <span className="uppercase">{current.code}</span>
        <Icon name="expand_more" className="text-[16px] transition-transform group-open/lang:rotate-180" />
      </summary>
      <div className="absolute top-12 right-0 z-10 w-64 rounded-2xl bg-surface-container-lowest p-2 shadow-xl ring-1 ring-border-subtle">
        <p className="px-3 pt-1.5 pb-2 text-label-sm tracking-wider text-neutral-muted uppercase">
          {t('language.label')}
        </p>
        <ul className="flex flex-col gap-0.5">
          {LANGUAGES.map((l) => {
            const active = l.code === current.code;
            const hint = otherName(l.code);
            return (
              <li key={l.code}>
                <button
                  type="button"
                  aria-current={active ? 'true' : undefined}
                  onClick={() => {
                    choose(l.code);
                    if (!ref.current) return;
                    ref.current.open = false;
                    ref.current.querySelector('summary')?.focus(); // el foco no se pierde en el panel cerrado
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none ${
                    active ? 'bg-badge-sage-bg' : 'hover:bg-surface-cream-alt'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-label-sm font-bold uppercase ${
                      active ? 'bg-primary text-on-primary' : 'bg-surface-cream-alt text-primary'
                    }`}
                  >
                    {l.code}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span lang={l.code} className="text-label-md font-semibold text-on-surface">
                      {l.label}
                    </span>
                    {hint.toLocaleLowerCase() !== l.label.toLocaleLowerCase() ? (
                      <span className="text-label-sm text-neutral-muted">{hint}</span>
                    ) : null}
                  </span>
                  {active ? <Icon name="check" className="text-[18px] text-secondary" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
