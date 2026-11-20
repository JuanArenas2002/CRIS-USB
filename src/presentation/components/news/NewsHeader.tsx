import type { ReactNode } from 'react';
import type { NewsTemplate } from '@/infrastructure/news/news-api';

/**
 * Encabezado de una noticia según su plantilla (la crean los administradores en el panel).
 * Todas las disposiciones comparten el encabezado verde del portal; cambian la posición y el tamaño de la foto
 * y del título. Sin plantilla se usa la "Clásica" (texto a la izquierda, foto a la derecha).
 */
export const DEFAULT_TEMPLATE: Omit<NewsTemplate, 'id' | 'name' | 'is_default'> = {
  layout: 'split',
  image_size: 'medium',
  image_ratio: '4:3',
  title_size: 'lg',
};
type Template = typeof DEFAULT_TEMPLATE;

export const RATIO: Record<Template['image_ratio'], string> = {
  '16:9': 'aspect-video',
  '4:3': 'aspect-[4/3]',
  '3:2': 'aspect-[3/2]',
  '1:1': 'aspect-square',
  '21:9': 'aspect-[21/9]',
};
const TITLE: Record<Template['title_size'], string> = {
  md: 'text-2xl leading-tight sm:text-3xl xl:text-[2.25rem] xl:leading-[1.2]',
  lg: 'text-3xl leading-tight sm:text-4xl sm:leading-tight xl:text-[2.75rem] xl:leading-[1.12]',
  xl: 'text-4xl leading-[1.1] sm:text-5xl xl:text-[3.5rem] xl:leading-[1.05]',
};
// split: proporción texto/foto; hero y text: ancho de la foto; compact: ancho de la miniatura.
const SPLIT: Record<Template['image_size'], string> = {
  small: 'lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]',
  medium: 'lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]',
  large: 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]',
  full: 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]',
};
const WIDTH: Record<Template['image_size'], string> = {
  small: 'max-w-xl',
  medium: 'max-w-3xl',
  large: 'max-w-5xl',
  full: 'max-w-none',
};
const THUMB: Record<Template['image_size'], string> = {
  small: 'sm:w-44 lg:w-52',
  medium: 'sm:w-56 lg:w-72',
  large: 'sm:w-64 lg:w-96',
  full: 'sm:w-72 lg:w-[28rem]',
};

export interface HeaderImage {
  src: string;
  srcSet?: string;
  alt: string;
  caption?: string | null;
}

export function NewsHeader({
  template,
  crumbs,
  kicker,
  title,
  summary,
  meta,
  image,
  frame,
}: {
  template?: Template | null;
  crumbs: ReactNode;
  kicker: ReactNode;
  title: string;
  summary: string;
  meta: ReactNode;
  image: HeaderImage | null;
  /** Ancho del contenido (el mismo que el cuerpo de la página). */
  frame: string;
}) {
  const t = template ?? DEFAULT_TEMPLATE;
  const layout = image ? t.layout : 'text';
  const text = (extra = '') => (
    <div className={`flex min-w-0 flex-col gap-4 ${extra}`}>
      {kicker}
      <h1 className={`font-bold tracking-tight text-surface-container-lowest ${TITLE[t.title_size]}`}>
        {title}
      </h1>
      <p className="text-lg leading-8 text-primary-fixed-dim sm:text-xl">{summary}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/15 pt-4 text-label-md text-primary-fixed-dim">
        {meta}
      </div>
    </div>
  );
  const photo = (img: HeaderImage, className: string, sizes: string, onDark = true) => (
    <figure className="min-w-0">
      <img
        src={img.src}
        srcSet={img.srcSet}
        sizes={sizes}
        alt={img.alt}
        fetchPriority="high"
        decoding="async"
        className={`w-full bg-primary-container object-cover ${RATIO[t.image_ratio]} ${className}`}
      />
      {img.caption && (
        <figcaption
          className={`mt-2 border-l-4 pl-3 text-label-sm leading-5 ${
            onDark ? 'border-secondary-fixed text-primary-fixed-dim' : 'border-secondary text-neutral-muted'
          }`}
        >
          {img.caption}
        </figcaption>
      )}
    </figure>
  );
  const band = (children: ReactNode, padding = 'pt-8 pb-12 lg:pt-10 lg:pb-14') => (
    <header className={`w-full bg-surface-dark-forest text-on-primary ${padding}`}>
      <div className="container-page">
        <div className={`${frame} flex flex-col gap-6`}>
          {crumbs}
          {children}
        </div>
      </div>
    </header>
  );

  // Título sobre la imagen: la foto es el fondo del encabezado y el texto va abajo, sobre un degradado.
  if (layout === 'overlay' && image)
    return (
      <header className="relative w-full overflow-hidden bg-surface-dark-forest text-on-primary">
        <img
          src={image.src}
          srcSet={image.srcSet}
          sizes="100vw"
          alt={image.alt}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-surface-dark-forest via-surface-dark-forest/75 to-surface-dark-forest/20"
        />
        <div className="relative container-page">
          <div className={`${frame} flex flex-col gap-6 pt-8 pb-12 lg:pt-10 lg:pb-14`}>
            {crumbs}
            <div
              className={`flex flex-col justify-end ${{ small: 'min-h-[18rem]', medium: 'min-h-[24rem]', large: 'min-h-[30rem]', full: 'min-h-[36rem]' }[t.image_size]}`}
            >
              {text('max-w-4xl')}
            </div>
            {image.caption && <p className="text-label-sm text-primary-fixed-dim">{image.caption}</p>}
          </div>
        </div>
      </header>
    );

  // Imagen destacada: el texto en la franja verde y la foto grande debajo, montada sobre el borde.
  if (layout === 'hero' && image)
    return (
      <>
        {band(text('max-w-4xl'), 'pt-8 pb-28 lg:pt-10 lg:pb-36')}
        <div className="container-page">
          <div className={`${frame} -mt-20 lg:-mt-28`}>
            <div className={`mx-auto ${WIDTH[t.image_size]}`}>
              {photo(image, 'rounded-2xl shadow-xl', '(min-width: 1280px) 1280px, 100vw', false)}
            </div>
          </div>
        </div>
      </>
    );

  // Imagen pequeña: el título manda y la foto acompaña como miniatura.
  if (layout === 'compact' && image)
    return band(
      <div className="flex flex-col-reverse gap-6 sm:flex-row sm:items-start sm:gap-10">
        {text('flex-1')}
        <div className={`w-full shrink-0 ${THUMB[t.image_size]}`}>
          {photo(image, 'rounded-xl shadow-md ring-1 ring-white/10', '(min-width: 1024px) 384px, 100vw')}
        </div>
      </div>,
    );

  // Clásica: texto a la izquierda y foto a la derecha (en móvil, apilados).
  if (layout === 'split' && image)
    return band(
      <div className={`grid gap-8 lg:items-center lg:gap-12 ${SPLIT[t.image_size]}`}>
        {text()}
        {photo(image, 'rounded-2xl shadow-md ring-1 ring-white/10', '(min-width: 1024px) 50vw, 100vw')}
      </div>,
    );

  // Solo texto (o noticia sin foto): la foto, si existe, se muestra al inicio del cuerpo (NewsBodyImage).
  return band(text('max-w-4xl'));
}

/** En la plantilla "Solo texto" la foto principal abre el cuerpo de la noticia. */
export function NewsBodyImage({
  template,
  image,
}: {
  template?: Template | null;
  image: HeaderImage | null;
}) {
  const t = template ?? DEFAULT_TEMPLATE;
  if (!image || t.layout !== 'text') return null;
  return (
    <figure className={`mb-8 ${WIDTH[t.image_size]}`}>
      <img
        src={image.src}
        srcSet={image.srcSet}
        sizes="(min-width: 1024px) 780px, 100vw"
        alt={image.alt}
        decoding="async"
        className={`w-full rounded-2xl bg-surface-cream-alt object-cover ${RATIO[t.image_ratio]}`}
      />
      {image.caption && (
        <figcaption className="mt-2 border-l-4 border-secondary pl-3 text-label-sm leading-5 text-neutral-muted">
          {image.caption}
        </figcaption>
      )}
    </figure>
  );
}
