import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/presentation/components/ui/Icon';
import { trackShare, type ShareChannel } from '@/infrastructure/news/news-reading';

/** `newsId`: si viene, cada clic en una opción se registra en la analítica (clics, no envíos reales). */
export function NewsShare({ title, url, newsId }: { title: string; url: string; newsId?: number }) {
  const { t } = useTranslation('home');
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const container = useRef<HTMLElement>(null);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };

    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutsideClick);
    };
  }, [open]);

  const copied = copyStatus === 'copied';

  const copyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement('textarea');
        input.value = url;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.append(input);
        input.select();
        const copied = document.execCommand('copy');
        input.remove();
        if (!copied) throw new Error('Clipboard unavailable');
      }
      setCopyStatus('copied');
      if (newsId) trackShare(newsId, 'copy_link');
    } catch {
      setCopyStatus('error');
    }
  };

  const options: (
    | { label: string; href: string; channel: ShareChannel; brand: 'whatsapp' | 'facebook'; icon?: never }
    | { label: string; href: string; channel: ShareChannel; icon: string; brand?: never }
  )[] = [
    {
      label: 'WhatsApp',
      brand: 'whatsapp',
      channel: 'whatsapp',
      href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    },
    {
      label: 'Facebook',
      brand: 'facebook',
      channel: 'facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      label: t('newsPage.email'),
      icon: 'mail',
      channel: 'email',
      href: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`,
    },
  ];

  return (
    <aside
      ref={container}
      aria-label={t('newsPage.share')}
      className="fixed right-4 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-50 sm:right-8"
    >
      <button
        type="button"
        aria-label={open ? t('newsPage.closeShare') : t('newsPage.share')}
        aria-expanded={open}
        aria-controls="news-share-options"
        onClick={() => setOpen((value) => !value)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg ring-1 ring-white/30 transition hover:scale-105 hover:bg-primary-container focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary motion-reduce:transform-none"
      >
        <Icon name={open ? 'close' : 'share'} className="text-[24px]" />
      </button>

      {open && (
        <div
          id="news-share-options"
          className="absolute right-0 bottom-full mb-3 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-border-subtle bg-surface-container-lowest p-4 shadow-xl"
        >
          <h2 className="mb-3 px-1 text-label-md font-bold tracking-wide text-on-surface uppercase">
            {t('newsPage.share')}
          </h2>
          <div className="flex flex-col gap-2">
            {options.map((option) => (
              <a
                key={option.label}
                href={option.href}
                target={option.href.startsWith('mailto:') ? undefined : '_blank'}
                rel={option.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                onClick={() => {
                  if (newsId) trackShare(newsId, option.channel);
                  setOpen(false);
                }}
                className="grid min-h-12 w-full grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-3 rounded-xl border border-border-subtle px-3 text-left text-body-sm font-semibold text-on-surface transition-colors hover:border-outline-variant hover:bg-canvas-cream focus-visible:outline-2 focus-visible:outline-secondary"
              >
                <span className="flex h-5 w-5 items-center justify-center">
                  {option.brand ? (
                    <BrandIcon brand={option.brand} />
                  ) : (
                    <Icon name={option.icon} className="text-[20px] text-primary-container" />
                  )}
                </span>
                <span className="min-w-0">{option.label}</span>
              </a>
            ))}
            <button
              type="button"
              onClick={() => void copyLink()}
              className="grid min-h-12 w-full grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-3 rounded-xl border border-border-subtle px-3 text-left text-body-sm font-semibold text-on-surface transition-colors hover:border-outline-variant hover:bg-canvas-cream focus-visible:outline-2 focus-visible:outline-secondary"
            >
              <span className="flex h-5 w-5 items-center justify-center">
                <Icon
                  name={copied ? 'check' : 'content_copy'}
                  className="text-[20px] text-primary-container"
                />
              </span>
              <span className="min-w-0">{t(copied ? 'newsPage.linkCopied' : 'newsPage.copyLink')}</span>
            </button>
          </div>
          {copyStatus === 'error' && (
            <p role="alert" className="mt-2 text-label-sm text-error">
              {t('newsPage.copyError')}
            </p>
          )}
          {copied && (
            <p role="status" className="mt-2 text-label-sm text-badge-sage-text">
              {t('newsPage.linkCopied')}
            </p>
          )}
        </div>
      )}
    </aside>
  );
}

function BrandIcon({ brand }: { brand: 'whatsapp' | 'facebook' }) {
  if (brand === 'whatsapp') {
    return (
      <svg
        aria-hidden="true"
        data-brand="whatsapp"
        viewBox="0 0 24 24"
        className="h-5 w-5 shrink-0 text-[#25D366]"
        fill="currentColor"
      >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      data-brand="facebook"
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0 text-[#0866FF]"
      fill="currentColor"
    >
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
    </svg>
  );
}
