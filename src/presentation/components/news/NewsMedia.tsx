import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { responsiveImage, type NewsMedia as Media } from '@/infrastructure/news/news-api';
import { Icon } from '@/presentation/components/ui/Icon';
import { PROVIDER_LABEL, embedUrl, hostOf, isVertical } from './media';
import { SectionTitle } from './news-ui';

const KIND_ICON = { image: 'image', video: 'open_in_new', link: 'link' } as const;

/**
 * Galería, videos y enlaces de una noticia. Privacidad: nada de terceros se carga sin que el lector lo pida
 * (el reproductor de YouTube/Vimeo aparece solo al pulsar "Reproducir"; las redes se abren en su sitio).
 */
export function NewsMediaSections({ media }: { media: Media[] }) {
  const { t } = useTranslation('home');
  const images = media.filter((m) => m.kind === 'image');
  const videos = media.filter((m) => m.kind === 'video');
  const links = media.filter((m) => m.kind === 'link');
  return (
    <>
      {images.length > 0 && (
        <section aria-labelledby="news-gallery" className="mt-12">
          <SectionTitle id="news-gallery">{t('newsPage.gallery')}</SectionTitle>
          <Gallery images={images} />
        </section>
      )}
      {videos.length > 0 && (
        <section aria-labelledby="news-videos" className="mt-12">
          <SectionTitle id="news-videos">{t('newsPage.videos')}</SectionTitle>
          <Videos videos={videos} />
        </section>
      )}
      {links.length > 0 && (
        <section aria-labelledby="news-links" className="mt-12">
          <SectionTitle id="news-links">{t('newsPage.links')}</SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2">
            {links.map((l) => (
              <li key={l.url}>
                <LinkCard item={l} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Gallery({ images }: { images: Media[] }) {
  const { t } = useTranslation('home');
  const [open, setOpen] = useState<number | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open !== null && !d.open) {
      if (d.showModal) d.showModal();
      else d.setAttribute('open', '');
    }
    if (open === null && d.open) {
      if (d.close) d.close();
      else d.removeAttribute('open');
    }
  }, [open]);
  const current = open === null ? null : images[open];
  const big = current ? responsiveImage(current.url, 1920) : null;
  const go = (step: number) => setOpen((i) => (i === null ? i : (i + step + images.length) % images.length));
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((img, i) => {
          const thumb = responsiveImage(img.url, 640);
          return (
            <li key={img.url} className={images.length === 1 ? 'col-span-2 sm:col-span-3' : ''}>
              <button
                type="button"
                onClick={() => setOpen(i)}
                className="group block w-full overflow-hidden rounded-xl bg-surface-cream-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
              >
                <img
                  src={thumb?.src}
                  srcSet={thumb?.srcSet}
                  sizes="(min-width: 1024px) 260px, 50vw"
                  alt={img.caption ?? img.title ?? t('newsPage.galleryImage', { n: i + 1 })}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transform-none"
                />
              </button>
              {img.caption && (
                <p className="mt-1.5 text-label-sm leading-5 text-neutral-muted">{img.caption}</p>
              )}
            </li>
          );
        })}
      </ul>
      <dialog
        ref={ref}
        onClose={() => setOpen(null)}
        onClick={(e) => e.target === e.currentTarget && setOpen(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') go(1);
          if (e.key === 'ArrowLeft') go(-1);
        }}
        aria-label={t('newsPage.gallery')}
        className="m-auto max-h-none max-w-none bg-transparent p-0 backdrop:bg-surface-dark-forest/90"
      >
        {current && big && (
          <figure className="flex max-h-[92vh] w-[min(92vw,1400px)] flex-col items-center gap-3">
            <img
              src={big.src}
              srcSet={big.srcSet}
              sizes="92vw"
              alt={current.caption ?? current.title ?? ''}
              className="max-h-[80vh] w-auto max-w-full rounded-lg object-contain"
            />
            <figcaption className="flex w-full items-center justify-between gap-4 text-body-sm text-on-primary">
              <span>{current.caption ?? current.title ?? ''}</span>
              <span className="flex shrink-0 items-center gap-2">
                {images.length > 1 && (
                  <>
                    <span className="text-label-sm text-primary-fixed-dim">
                      {(open ?? 0) + 1} / {images.length}
                    </span>
                    <LightboxButton
                      label={t('newsPage.previous')}
                      icon="chevron_left"
                      onClick={() => go(-1)}
                    />
                    <LightboxButton label={t('newsPage.next')} icon="chevron_right" onClick={() => go(1)} />
                  </>
                )}
                <LightboxButton label={t('newsPage.close')} icon="close" onClick={() => setOpen(null)} />
              </span>
            </figcaption>
          </figure>
        )}
      </dialog>
    </>
  );
}

function LightboxButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-on-primary hover:bg-white/20"
    >
      <Icon name={icon} className="text-[22px]" />
    </button>
  );
}

/**
 * Videos ordenados por formato para que la cuadrícula no quede dispareja:
 * 1) horizontales (YouTube/Vimeo): de a dos; si son impares, el primero a todo el ancho;
 * 2) verticales (YouTube Shorts): en su propia fila con formato 9:16;
 * 3) redes que no se pueden incrustar (TikTok, Instagram, Facebook, X…): lista compacta de enlaces.
 */
function Videos({ videos }: { videos: Media[] }) {
  const { t } = useTranslation('home');
  const playable = videos.filter((v) => embedUrl(v.url));
  const wide = playable.filter((v) => !isVertical(v.url));
  const vertical = playable.filter((v) => isVertical(v.url));
  const social = videos.filter((v) => !embedUrl(v.url));
  return (
    <div className="flex flex-col gap-8">
      {wide.length > 0 && (
        <ul className="grid gap-6 sm:grid-cols-2">
          {wide.map((v, i) => (
            <li key={v.url} className={i === 0 && wide.length % 2 === 1 ? 'sm:col-span-2' : ''}>
              <Video video={v} />
            </li>
          ))}
        </ul>
      )}
      {vertical.length > 0 && (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {vertical.map((v) => (
            <li key={v.url}>
              <Video video={v} vertical />
            </li>
          ))}
        </ul>
      )}
      {social.length > 0 && (
        <div>
          {playable.length > 0 && (
            <h3 className="mb-3 text-label-md font-semibold text-on-surface-variant">
              {t('newsPage.onSocial')}
            </h3>
          )}
          <ul className="grid gap-3 sm:grid-cols-2">
            {social.map((v) => (
              <li key={v.url}>
                <Video video={v} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Título legible: si alguien pegó la URL como título, se usa el nombre de la plataforma. */
const readable = (title: string | null | undefined) =>
  title && !/^https?:\/\//i.test(title.trim()) ? title : null;

/** Reproductor "clic para cargar": hasta pulsar no hay ninguna petición al proveedor. */
function Video({ video, vertical = false }: { video: Media; vertical?: boolean }) {
  const { t } = useTranslation('home');
  const [playing, setPlaying] = useState(false);
  const src = embedUrl(video.url);
  const provider = PROVIDER_LABEL[video.provider ?? ''] ?? hostOf(video.url);
  const title = readable(video.title) ?? t('newsPage.videoOn', { provider });
  if (!src) return <LinkCard item={{ ...video, title }} provider={provider} />;
  return (
    <figure>
      <div
        className={`relative overflow-hidden rounded-xl bg-surface-dark-forest ${vertical ? 'aspect-[9/16]' : 'aspect-video'}`}
      >
        {playing ? (
          <iframe
            src={src}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-on-primary"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary-fixed text-surface-dark-forest shadow-lg transition-transform group-hover:scale-105 motion-reduce:transform-none">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="ml-1 h-7 w-7 fill-current">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <span className="text-body-md font-semibold">
              {t('newsPage.playVideo')}
              <span className="sr-only">: {title}</span>
            </span>
            <span className="max-w-xs text-label-sm text-primary-fixed-dim">
              {t('newsPage.externalNotice', { provider })}
            </span>
          </button>
        )}
      </div>
      <figcaption className="mt-2 text-body-sm font-semibold text-on-surface">
        {title}
        {video.caption && <span className="block font-normal text-neutral-muted">{video.caption}</span>}
      </figcaption>
    </figure>
  );
}

function LinkCard({ item, provider }: { item: Media; provider?: string }) {
  const { t } = useTranslation('home');
  const source = provider ?? PROVIDER_LABEL[item.provider ?? ''] ?? hostOf(item.url);
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex h-full items-start gap-3 rounded-xl border border-border-subtle bg-surface-container-lowest p-4 transition-colors hover:border-outline-variant hover:bg-canvas-cream"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-badge-sage-bg text-badge-sage-text">
        <Icon name={KIND_ICON[item.kind]} className="text-[20px]" />
      </span>
      <span className="min-w-0">
        <span className="line-clamp-2 block font-semibold text-on-surface group-hover:text-primary-container group-hover:underline">
          {readable(item.title) ?? source}
        </span>
        {item.caption && <span className="block text-body-sm text-on-surface-variant">{item.caption}</span>}
        <span className="mt-0.5 block text-label-sm text-neutral-muted">
          {t('newsPage.openOn', { provider: source })}
        </span>
      </span>
    </a>
  );
}
