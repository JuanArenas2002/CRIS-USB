import { useState } from 'react';
import { newsApi, responsiveImage, type NewsMedia, type NewsTemplate } from '@/infrastructure/news/news-api';
import {
  PROVIDER_LABEL,
  embedUrl,
  hostOf,
  isHttpUrl,
  providerOf,
} from '@/presentation/components/news/media';
import { Icon } from '@/presentation/components/ui/Icon';
import { Button, Card, Field, Input, Select, StatusLine, useAction } from './ui';

const KIND_ICON = { image: 'image', video: 'open_in_new', link: 'link' } as const;

const IMAGE_TYPES = 'image/jpeg,image/png,image/webp';
const MAX_MEDIA = 30;
const KIND_LABEL: Record<NewsMedia['kind'], string> = { image: 'Imagen', video: 'Video', link: 'Enlace' };

/**
 * Galería de la noticia: imágenes subidas al portal, videos por enlace (YouTube, Vimeo, Facebook, Instagram,
 * TikTok, X…) y enlaces relacionados. El orden de la lista es el orden en la página.
 */
export function MediaCard({
  newsId,
  media,
  locked,
  onChange,
}: {
  newsId?: number;
  media: NewsMedia[];
  locked: boolean;
  onChange: (media: NewsMedia[]) => void;
}) {
  const [kind, setKind] = useState<'video' | 'link'>('video');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const upload = useAction();
  const full = media.length >= MAX_MEDIA;
  const exists = media.some((m) => m.url === url.trim());
  const urlError =
    url && !isHttpUrl(url.trim())
      ? 'Pega un enlace completo (https://…)'
      : exists
        ? 'Ya está en la galería'
        : null;
  const update = (i: number, patch: Partial<NewsMedia>) =>
    onChange(media.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const move = (i: number, step: number) => {
    const next = [...media];
    const [item] = next.splice(i, 1);
    next.splice(i + step, 0, item!);
    onChange(next);
  };

  return (
    <Card
      title="Galería, videos y enlaces"
      description="Fotos adicionales, videos de YouTube o redes sociales y enlaces a resultados (artículos, repositorios…)."
    >
      {locked && (
        <p className="mb-4 rounded-lg bg-primary/10 p-3 text-label-sm text-primary">
          La galería forma parte del contenido revisado: ya no se puede cambiar.
        </p>
      )}
      {media.length > 0 && (
        <ol className="mb-5 flex flex-col divide-y divide-border-subtle rounded-lg border border-border-subtle">
          {media.map((m, i) => (
            <li key={`${m.kind}-${m.url}`} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
              <MediaThumb item={m} />
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                <Field label="Texto a mostrar">
                  <Input
                    value={m.title ?? ''}
                    disabled={locked}
                    maxLength={250}
                    onChange={(e) => update(i, { title: e.target.value || null })}
                  />
                </Field>
                <Field label={m.kind === 'image' ? 'Pie de foto' : 'Descripción (opcional)'}>
                  <Input
                    value={m.caption ?? ''}
                    disabled={locked}
                    maxLength={500}
                    onChange={(e) => update(i, { caption: e.target.value || null })}
                  />
                </Field>
              </div>
              {!locked && (
                <div className="flex shrink-0 gap-1 sm:flex-col">
                  <IconButton
                    label="Subir"
                    icon="expand_more"
                    flip
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  />
                  <IconButton
                    label="Bajar"
                    icon="expand_more"
                    disabled={i === media.length - 1}
                    onClick={() => move(i, 1)}
                  />
                  <IconButton
                    label="Quitar"
                    icon="close"
                    onClick={() => onChange(media.filter((_, j) => j !== i))}
                  />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {!locked && (
        <div className="flex flex-col gap-4">
          <form
            className="flex flex-col gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              const clean = url.trim();
              if (!clean || urlError || full) return;
              onChange([...media, { kind, url: clean, title: title.trim() || null, caption: null }]);
              setUrl('');
              setTitle('');
            }}
          >
            {/* Todos los controles en una sola línea (misma altura); la ayuda va debajo, no dentro de una columna. */}
            <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
              <Field label="Tipo">
                <Select
                  value={kind}
                  options={[
                    { value: 'video', label: 'Video' },
                    { value: 'link', label: 'Enlace' },
                  ]}
                  onChange={(e) => setKind(e.target.value as 'video' | 'link')}
                />
              </Field>
              <Field label="Enlace">
                <Input
                  type="url"
                  value={url}
                  placeholder="https://"
                  aria-invalid={!!urlError}
                  aria-describedby="media-url-hint"
                  onChange={(e) => setUrl(e.target.value)}
                />
              </Field>
              <Field label="Texto a mostrar (opcional)">
                <Input value={title} maxLength={250} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              <Button type="submit" disabled={!url.trim() || !!urlError || full}>
                Agregar
              </Button>
            </div>
            <p
              id="media-url-hint"
              className={`text-label-sm ${urlError ? 'text-error' : 'text-neutral-muted'}`}
              role={urlError ? 'alert' : undefined}
            >
              {urlError ??
                (kind === 'video'
                  ? 'Videos de YouTube o Vimeo se ven en la noticia; los de Facebook, Instagram, TikTok o X se abren en su sitio.'
                  : 'Artículos, repositorios, DOI u otras páginas relacionadas con la noticia.')}
            </p>
          </form>
          <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle pt-4">
            {newsId ? (
              <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-border-subtle px-4 text-label-md font-semibold text-on-surface hover:bg-surface-cream-alt">
                <Icon name="add_photo_alternate" className="text-[20px]" /> Subir fotos
                <input
                  type="file"
                  accept={IMAGE_TYPES}
                  multiple
                  className="sr-only"
                  disabled={upload.busy || full}
                  onChange={async (e) => {
                    const files = [...(e.target.files ?? [])].slice(0, MAX_MEDIA - media.length);
                    e.target.value = '';
                    const added: NewsMedia[] = [];
                    await upload.run(
                      async () => {
                        for (const file of files) {
                          const { url: path } = await newsApi.uploadContentImage(newsId, file);
                          if (!media.some((m) => m.url === path))
                            added.push({ kind: 'image', url: path, title: null, caption: null });
                        }
                      },
                      `${files.length === 1 ? 'Foto subida' : 'Fotos subidas'}. Guarda los cambios para publicarlas.`,
                    );
                    if (added.length) onChange([...media, ...added]);
                  }}
                />
              </label>
            ) : (
              <span className="text-label-sm text-neutral-muted">
                Guarda el borrador para poder subir fotos.
              </span>
            )}
            <span className="text-label-sm text-neutral-muted">
              JPG, PNG o WebP · {media.length}/{MAX_MEDIA} elementos
            </span>
            <StatusLine status={upload.status} />
          </div>
        </div>
      )}
    </Card>
  );
}

function IconButton({
  label,
  icon,
  flip,
  disabled,
  onClick,
}: {
  label: string;
  icon: string;
  flip?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-subtle text-on-surface-variant hover:bg-surface-cream-alt disabled:opacity-40"
    >
      <Icon name={icon} className={`text-[20px] ${flip ? 'rotate-180' : ''}`} />
    </button>
  );
}

function MediaThumb({ item }: { item: NewsMedia }) {
  const provider = item.kind === 'image' ? null : (providerOf(item.url) ?? null);
  const label = provider ? PROVIDER_LABEL[provider] : item.kind === 'image' ? null : hostOf(item.url);
  return (
    <div className="flex w-full shrink-0 items-center gap-3 sm:w-48">
      <span className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-cream-alt">
        {item.kind === 'image' ? (
          <img src={responsiveImage(item.url, 320)?.src} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon name={KIND_ICON[item.kind]} className="text-[24px] text-neutral-muted" />
        )}
      </span>
      <span className="min-w-0 text-label-sm">
        <span className="block font-semibold text-on-surface">{KIND_LABEL[item.kind]}</span>
        {label && <span className="block truncate text-neutral-muted">{label}</span>}
        {item.kind === 'video' && !embedUrl(item.url) && (
          <span className="block text-neutral-muted">Se muestra como enlace</span>
        )}
      </span>
    </div>
  );
}

/** Esquema en miniatura de una plantilla: ayuda a elegirla sin abrir la noticia. */
export function TemplateThumb({
  template,
  className = '',
}: {
  template: Omit<NewsTemplate, 'id' | 'name' | 'is_default'>;
  className?: string;
}) {
  const t = template;
  const title = { md: 'h-1.5 w-3/5', lg: 'h-2 w-4/5', xl: 'h-3 w-full' }[t.title_size];
  const lines = (
    <span className="flex w-full flex-col gap-1">
      <span className={`block rounded-sm bg-on-primary ${title}`} />
      <span className="block h-1 w-11/12 rounded-sm bg-primary-fixed-dim/70" />
      <span className="block h-1 w-2/3 rounded-sm bg-primary-fixed-dim/70" />
    </span>
  );
  const img = (cls: string) => <span className={`block rounded-sm bg-secondary-fixed/80 ${cls}`} />;
  const imgWidth = { small: 'w-1/4', medium: 'w-2/5', large: 'w-1/2', full: 'w-3/5' }[t.image_size];
  return (
    <span
      aria-hidden="true"
      className={`relative flex aspect-[16/10] w-full flex-col overflow-hidden rounded-lg bg-surface-dark-forest p-2.5 ${className}`}
    >
      {t.layout === 'split' && (
        <span className="flex flex-1 items-center gap-2">
          <span className="flex-1">{lines}</span>
          {img(`${imgWidth} aspect-[4/3]`)}
        </span>
      )}
      {t.layout === 'compact' && (
        <span className="flex flex-1 items-start gap-2 pt-1">
          <span className="flex-1">{lines}</span>
          {img('w-1/5 aspect-square')}
        </span>
      )}
      {t.layout === 'text' && <span className="flex flex-1 items-center pr-6">{lines}</span>}
      {t.layout === 'hero' && (
        <span className="flex flex-1 flex-col gap-1.5">
          <span className="pr-8">{lines}</span>
          {img(
            `mx-auto flex-1 ${t.image_size === 'full' ? 'w-full' : t.image_size === 'large' ? 'w-4/5' : 'w-3/5'}`,
          )}
        </span>
      )}
      {t.layout === 'overlay' && (
        <>
          <span className="absolute inset-0 bg-secondary-fixed/50" />
          <span className="absolute inset-0 bg-gradient-to-t from-surface-dark-forest to-transparent" />
          <span className="relative mt-auto pr-8">{lines}</span>
        </>
      )}
    </span>
  );
}

export const LAYOUT_LABEL: Record<NewsTemplate['layout'], string> = {
  split: 'Texto y foto lado a lado',
  hero: 'Foto grande bajo el título',
  overlay: 'Título sobre la foto',
  compact: 'Foto pequeña junto al título',
  text: 'Solo texto (foto al inicio del cuerpo)',
};
