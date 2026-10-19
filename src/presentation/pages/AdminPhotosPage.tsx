import { useContext, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { displayName, initials, type Author } from '@/domain/authors/author';
import { ApiError } from '@/infrastructure/http/api-client';
import { deletePhoto, toSquareWebp, uploadPhoto } from '@/infrastructure/photos/photo-admin';
import { AdminTokenForm, useAdminToken } from '@/presentation/components/admin/AdminToken';
import { ErrorState } from '@/presentation/components/feedback/Feedback';
import { Icon } from '@/presentation/components/ui/Icon';
import { AuthorQueriesContext } from '@/presentation/hooks/use-authors';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';

/**
 * Vista oculta (no está en el menú, noindex, bloqueada en robots.txt) para asignar fotos a los
 * investigadores publicados. Ocultarla no es la seguridad: la escritura exige el token del BFF.
 */
export function AdminPhotosPage() {
  useDocumentMetadata({
    title: 'Asignación de fotos',
    description: 'Administración interna de fotos de investigadores.',
    path: '/admin/fotos',
    noindex: true,
  });
  const queries = useContext(AuthorQueriesContext)!;
  const qc = useQueryClient();
  const list = useQuery(queries.directory({ search: '', page: 1 }));
  const { token, error: tokenError, save: saveToken, clear: clearToken, rejected } = useAdminToken();
  const onChanged = () => qc.invalidateQueries({ queryKey: ['authors'] });

  return (
    <div className="container-page py-10">
      <p className="text-label-md font-bold tracking-widest text-secondary uppercase">Administración</p>
      <h1 className="mt-1 text-headline-lg-mobile font-bold tracking-tight text-primary md:text-headline-lg">
        Asignación de fotos
      </h1>
      <p className="mt-1 max-w-2xl text-body-md text-neutral-muted">
        Las fotos se guardan en el servidor del portal (Metri-K aún no aloja fotos). Se recortan al cuadrado y
        se convierten a WebP de 512 px antes de subirlas.
      </p>

      {!token ? (
        <AdminTokenForm error={tokenError} onSubmit={saveToken} />
      ) : list.isError ? (
        <div className="mt-8">
          <ErrorState message={list.error.message} onRetry={() => list.refetch()} />
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-center gap-3">
            <span className="text-body-sm text-neutral-muted">
              {list.data ? `${list.data.total} investigadores publicados` : 'Cargando…'}
            </span>
            <button
              type="button"
              onClick={() => clearToken()}
              className="text-label-md font-semibold text-secondary hover:underline"
            >
              Cambiar token
            </button>
          </div>
          <ul className="mt-4 grid gap-gutter sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.data?.items.map((a) => (
              <PhotoRow key={a.id} author={a} token={token} onChanged={onChanged} onUnauthorized={rejected} />
            ))}
          </ul>
          {list.data && list.data.total > list.data.items.length ? (
            <p className="mt-4 text-body-sm text-neutral-muted">
              Se muestran los primeros {list.data.items.length}; la vista está pensada para los investigadores
              seleccionados.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function PhotoRow({
  author,
  token,
  onChanged,
  onUnauthorized,
}: {
  author: Author;
  token: string;
  onChanged: () => void;
  onUnauthorized: () => void;
}) {
  const name = displayName(author.name);
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null);
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'error'; text?: string }>({
    kind: 'idle',
  });
  const shown = preview?.url ?? author.photoUrl;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/'))
      return setStatus({ kind: 'error', text: 'El archivo no es una imagen' });
    try {
      const blob = await toSquareWebp(file);
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
      if (preview) URL.revokeObjectURL(preview.url);
      setPreview(null);
      setStatus({ kind: 'ok', text: ok });
      onChanged();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onUnauthorized();
      setStatus({ kind: 'error', text: (err as Error).message || 'Error al guardar' });
    }
  };

  return (
    <li className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-dark-forest text-headline-sm font-bold text-secondary-fixed">
          {shown ? (
            <img src={shown} alt={`Foto de ${name}`} className="h-full w-full object-cover" />
          ) : (
            initials(name)
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-body-md font-semibold text-on-surface">{name}</p>
          <p className="text-label-sm text-neutral-muted">
            ID {author.id} · {author.photoUrl ? 'Con foto' : 'Sin foto'}
            {preview ? ' · vista previa sin guardar' : ''}
          </p>
        </div>
      </div>
      <label className="cursor-pointer rounded-lg border border-dashed border-border-subtle px-3 py-2 text-center text-label-md font-semibold text-secondary hover:bg-surface-cream-alt">
        <Icon name="upload" className="mr-1 align-middle text-[18px]" />
        {author.photoUrl || preview ? 'Elegir otra imagen' : 'Elegir imagen'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!preview || status.kind === 'busy'}
          onClick={() => run(() => uploadPhoto(author.id, preview!.blob, token), 'Foto guardada')}
          className="h-9 flex-1 rounded-lg bg-primary text-label-md font-semibold text-on-primary hover:bg-secondary disabled:opacity-40"
        >
          Guardar
        </button>
        <button
          type="button"
          disabled={!author.photoUrl || status.kind === 'busy'}
          onClick={() => {
            if (confirm(`¿Quitar la foto de ${name}?`))
              run(() => deletePhoto(author.id, token), 'Foto quitada');
          }}
          className="h-9 rounded-lg px-3 text-label-md font-semibold text-error hover:bg-error-container/40 disabled:opacity-40"
        >
          Quitar
        </button>
      </div>
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
