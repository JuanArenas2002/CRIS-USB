import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Center } from '@/domain/centers/center';
import { ApiError } from '@/infrastructure/http/api-client';
import { deleteLogo, saveCenterWebsite, toLogoWebp, uploadLogo } from '@/infrastructure/photos/photo-admin';
import { AdminTokenForm, useAdminToken } from '@/presentation/components/admin/AdminToken';
import { ErrorState } from '@/presentation/components/feedback/Feedback';
import { Icon } from '@/presentation/components/ui/Icon';
import { useCenters } from '@/presentation/hooks/use-centers';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';

/**
 * Vista oculta (fuera del menú, noindex, bloqueada en robots.txt) para el logo y la página oficial
 * de cada centro activo. Ocultarla no es la seguridad: guardar exige el token del BFF.
 */
export function AdminCentersPage() {
  useDocumentMetadata({
    title: 'Logos y páginas de centros',
    description: 'Administración interna del logo y la página oficial de cada centro.',
    path: '/admin/centros',
    noindex: true,
  });
  const qc = useQueryClient();
  const list = useCenters();
  const { token, error, save, clear, rejected } = useAdminToken();
  const onChanged = () => qc.invalidateQueries({ queryKey: ['centers'] });

  return (
    <div className="container-page py-10">
      <p className="text-label-md font-bold tracking-widest text-secondary uppercase">Administración</p>
      <h1 className="mt-1 text-headline-lg-mobile font-bold tracking-tight text-primary md:text-headline-lg">
        Logos y páginas de centros
      </h1>
      <p className="mt-1 max-w-3xl text-body-md text-neutral-muted">
        Metri-K aún no guarda logos ni páginas oficiales: se guardan en el servidor del portal. El logo se
        convierte a WebP (máx. 512 px, sin recortar y con su transparencia) antes de subirlo.
      </p>

      {!token ? (
        <AdminTokenForm error={error} onSubmit={save} />
      ) : list.isError ? (
        <div className="mt-8">
          <ErrorState message={list.error.message} onRetry={() => list.refetch()} />
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-center gap-3">
            <span className="text-body-sm text-neutral-muted">
              {list.data ? `${list.data.length} centros activos` : 'Cargando…'}
            </span>
            <button
              type="button"
              onClick={() => clear()}
              className="text-label-md font-semibold text-secondary hover:underline"
            >
              Cambiar token
            </button>
          </div>
          <ul className="mt-4 grid gap-gutter lg:grid-cols-2">
            {list.data?.map((c) => (
              <CenterRow
                key={c.id}
                center={c}
                token={token}
                onChanged={onChanged}
                onUnauthorized={rejected}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

type Status = { kind: 'idle' | 'busy' | 'ok' | 'error'; text?: string };

function CenterRow({
  center: c,
  token,
  onChanged,
  onUnauthorized,
}: {
  center: Center;
  token: string;
  onChanged: () => void;
  onUnauthorized: () => void;
}) {
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null);
  const [website, setWebsite] = useState(c.website ?? '');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const shown = preview?.url ?? c.logoUrl;
  const siteDirty = website.trim() !== (c.website ?? '');

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/'))
      return setStatus({ kind: 'error', text: 'El archivo no es una imagen' });
    try {
      const blob = await toLogoWebp(file);
      if (preview) URL.revokeObjectURL(preview.url);
      setPreview({ blob, url: URL.createObjectURL(blob) });
      setStatus({ kind: 'idle' });
    } catch {
      setStatus({ kind: 'error', text: 'No se pudo leer la imagen' });
    }
  };
  const run = async (action: () => Promise<unknown>, ok: string) => {
    setStatus({ kind: 'busy' });
    try {
      await action();
      setStatus({ kind: 'ok', text: ok });
      onChanged();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onUnauthorized();
      setStatus({ kind: 'error', text: (err as Error).message || 'Error al guardar' });
    }
  };
  const clearPreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };
  const busy = status.kind === 'busy';

  return (
    <li className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-white p-2">
          {shown ? (
            <img src={shown} alt={`Logo de ${c.name}`} className="h-full w-full object-contain" />
          ) : (
            <Icon name="domain" className="text-[36px] text-neutral-muted" />
          )}
        </div>
        <div className="min-w-0">
          <h2 className="text-headline-sm leading-snug font-semibold text-primary">{c.name}</h2>
          <p className="text-label-sm text-neutral-muted">
            {c.code}
            {c.acronym ? ` · ${c.acronym}` : ''} · {c.logoUrl ? 'Con logo' : 'Sin logo'}
            {preview ? ' · vista previa sin guardar' : ''}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="flex-1 cursor-pointer rounded-lg border border-dashed border-border-subtle px-3 py-2 text-center text-label-md font-semibold text-secondary hover:bg-surface-cream-alt">
          <Icon name="upload" className="mr-1 align-middle text-[18px]" />
          {c.logoUrl || preview ? 'Elegir otro logo' : 'Elegir logo'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </label>
        <button
          type="button"
          disabled={!preview || busy}
          onClick={() =>
            run(() => uploadLogo(c.id, preview!.blob, token).then(clearPreview), 'Logo guardado')
          }
          className="h-10 rounded-lg bg-primary px-5 text-label-md font-semibold text-on-primary hover:bg-secondary disabled:opacity-40"
        >
          Guardar logo
        </button>
        <button
          type="button"
          disabled={!c.logoUrl || busy}
          onClick={() => {
            if (confirm(`¿Quitar el logo de ${c.name}?`)) run(() => deleteLogo(c.id, token), 'Logo quitado');
          }}
          className="h-10 rounded-lg px-3 text-label-md font-semibold text-error hover:bg-error-container/40 disabled:opacity-40"
        >
          Quitar
        </button>
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            async () => setWebsite((await saveCenterWebsite(c.id, website.trim() || null, token)) ?? ''),
            website.trim() ? 'Página guardada' : 'Página quitada',
          );
        }}
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-label-sm font-semibold text-on-surface-variant">
          Página oficial
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://…"
            className="h-10 w-full rounded-lg border border-border-subtle bg-surface-container-lowest px-3 text-body-sm font-normal focus:ring-2 focus:ring-secondary focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={!siteDirty || busy}
          className="h-10 rounded-lg bg-primary px-5 text-label-md font-semibold text-on-primary hover:bg-secondary disabled:opacity-40"
        >
          Guardar página
        </button>
      </form>

      {status.kind !== 'idle' ? (
        <p
          role="status"
          className={`text-label-sm ${status.kind === 'error' ? 'text-error' : status.kind === 'ok' ? 'text-secondary' : 'text-neutral-muted'}`}
        >
          {status.kind === 'busy' ? 'Guardando…' : status.text}
        </p>
      ) : null}
    </li>
  );
}
