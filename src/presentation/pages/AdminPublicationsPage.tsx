import { useState } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { QUARTILES, publicationStats, type StoredPublication } from '@/domain/publications/publication';
import { ApiError } from '@/infrastructure/http/api-client';
import {
  PUBLICATIONS_SHEET,
  clearPublications,
  publicationRows,
  uploadPublications,
  type PublicationsResult,
} from '@/infrastructure/publications/publication-admin';
import { readXlsxSheet } from '@/infrastructure/ranking/xlsx';
import { AdminTokenForm, useAdminToken } from '@/presentation/components/admin/AdminToken';
import { useConfirm } from '@/presentation/components/admin/ConfirmDialog';
import { Icon } from '@/presentation/components/ui/Icon';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
import { usePublicationStats } from '@/presentation/hooks/use-publications';

type Status = { kind: 'idle' | 'busy' | 'ok' | 'error'; text?: string };

const fmt = (n: number) => n.toLocaleString('es-CO');

/**
 * Vista oculta (fuera del menú, noindex, bloqueada en robots.txt) para cargar el ranking de
 * publicaciones Scopus que se muestra en /productos.
 */
export function AdminPublicationsPage() {
  const [confirm, confirmDialog] = useConfirm();
  useDocumentMetadata({
    title: 'Ranking de publicaciones',
    description: 'Administración interna del ranking de publicaciones Scopus.',
    path: '/admin/produccion',
    noindex: true,
  });
  const qc = useQueryClient();
  const current = usePublicationStats();
  const { token, error, save, clear, rejected } = useAdminToken();
  const [file, setFile] = useState<{ name: string; rows: StoredPublication[] } | null>(null);
  const [result, setResult] = useState<PublicationsResult | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setResult(null);
    setStatus({ kind: 'busy', text: 'Leyendo el Excel…' });
    try {
      const rows = publicationRows(await readXlsxSheet(f, PUBLICATIONS_SHEET));
      if (!rows.length) throw new Error('La hoja no tiene filas con EID');
      setFile({ name: f.name, rows });
      setStatus({ kind: 'idle' });
    } catch (err) {
      setFile(null);
      setStatus({ kind: 'error', text: (err as Error).message || 'No se pudo leer el Excel' });
    }
  };
  const run = async (action: () => Promise<PublicationsResult>, ok: (r: PublicationsResult) => string) => {
    setStatus({ kind: 'busy', text: 'Guardando…' });
    try {
      const r = await action();
      setResult(r);
      setStatus({ kind: 'ok', text: ok(r) });
      qc.invalidateQueries({ queryKey: ['publications'] });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return rejected();
      setStatus({ kind: 'error', text: (err as Error).message || 'Error al guardar' });
    }
  };
  const busy = status.kind === 'busy';
  const preview = file ? publicationStats(file.rows) : null;

  return (
    <div className="container-page py-10">
      {confirmDialog}
      <p className="text-label-md font-bold tracking-widest text-secondary uppercase">Administración</p>
      <h1 className="mt-1 text-headline-lg-mobile font-bold tracking-tight text-primary md:text-headline-lg">
        Ranking de publicaciones Scopus
      </h1>
      <p className="mt-1 max-w-3xl text-body-md text-neutral-muted">
        Sube el Excel del modelo de puntaje (hoja <strong>{PUBLICATIONS_SHEET}</strong>). Al publicarlo,{' '}
        <Link to="/productos" className="font-semibold text-secondary hover:underline">
          /productos
        </Link>{' '}
        muestra las publicaciones en el orden del ranking, con su revista, cuartil, citas y resumen. Los
        autores se toman de la producción Scopus de los investigadores seleccionados en Metri-K (por EID). Del
        Excel no se envían los aportes del modelo ni las categorías SCImago.
      </p>
      <p className="mt-3 text-label-md text-on-surface-variant">
        {current.data
          ? current.data.total
            ? `Publicado ahora: ${fmt(current.data.total)} publicaciones (${fmt(current.data.byQuartile.Q1)} en Q1).`
            : 'Aún no hay publicaciones cargadas: /productos muestra la sección vacía.'
          : current.isError
            ? 'No se pudo consultar lo publicado.'
            : 'Consultando lo publicado…'}
      </p>

      {!token ? (
        <AdminTokenForm error={error} onSubmit={save} />
      ) : (
        <div className="mt-6 flex max-w-3xl flex-col gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => clear()}
              className="text-label-md font-semibold text-secondary hover:underline"
            >
              Cambiar token
            </button>
          </div>

          <div className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-5 shadow-sm">
            <label className="cursor-pointer rounded-lg border border-dashed border-border-subtle px-3 py-6 text-center text-label-md font-semibold text-secondary hover:bg-surface-cream-alt">
              <Icon name="upload_file" className="mr-1 align-middle text-[20px]" />
              {file
                ? `${file.name} · ${fmt(file.rows.length)} filas leídas — elegir otro`
                : 'Elegir Excel (.xlsx)'}
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(e) => pick(e.target.files?.[0])}
              />
            </label>
            {preview ? (
              <dl className="grid grid-cols-2 gap-3 text-label-sm sm:grid-cols-4">
                {[
                  ['Publicaciones', fmt(preview.total)],
                  [
                    'Años',
                    preview.years.length
                      ? `${preview.years[preview.years.length - 1]}–${preview.years[0]}`
                      : '—',
                  ],
                  ['Cuartiles', QUARTILES.map((q) => `${q}: ${preview.byQuartile[q]}`).join(' · ')],
                  ['Acceso abierto', fmt(preview.openAccess)],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-canvas-cream px-3 py-2">
                    <dt className="text-neutral-muted">{k}</dt>
                    <dd className="font-semibold text-on-surface">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!file || busy}
                onClick={() =>
                  run(
                    () => uploadPublications(file!.rows, token),
                    (r) => `Ranking publicado: ${fmt(r.published)} publicaciones en /productos`,
                  )
                }
                className="h-10 rounded-lg bg-primary px-5 text-label-md font-semibold text-on-primary hover:bg-secondary disabled:opacity-40"
              >
                Publicar publicaciones
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (await confirm('¿Quitar el ranking de publicaciones? /productos quedará vacío.'))
                    run(
                      () => clearPublications(token),
                      () => 'Ranking de publicaciones quitado',
                    );
                }}
                className="h-10 rounded-lg px-3 text-label-md font-semibold text-error hover:bg-error-container/40 disabled:opacity-40"
              >
                Quitar publicaciones
              </button>
            </div>
            {status.kind !== 'idle' ? (
              <p
                role="status"
                className={`text-label-md ${status.kind === 'error' ? 'text-error' : status.kind === 'ok' ? 'text-secondary' : 'text-neutral-muted'}`}
              >
                {status.text}
              </p>
            ) : null}
          </div>

          {result && (result.invalid.length || result.unlinked) ? (
            <div className="grid gap-3 md:grid-cols-2">
              <details
                className="rounded-xl bg-surface-container-lowest p-4 shadow-sm"
                open={result.invalid.length > 0 && result.invalid.length <= 10}
              >
                <summary className="cursor-pointer text-label-md font-semibold text-on-surface">
                  Filas descartadas (sin EID, título o puesto): {result.invalid.length}
                </summary>
                {result.invalid.length ? (
                  <ul className="mt-2 max-h-64 overflow-y-auto text-label-sm text-on-surface-variant">
                    {result.invalid.map((n, i) => (
                      <li key={`${n}-${i}`}>{n}</li>
                    ))}
                  </ul>
                ) : null}
              </details>
              <p className="rounded-xl bg-surface-container-lowest p-4 text-label-md text-on-surface shadow-sm">
                <span className="font-semibold">Sin autor seleccionado en Metri-K: {result.unlinked}</span>
                <span className="block text-label-sm text-neutral-muted">
                  Se publican igual, pero sin investigadores enlazados.
                </span>
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
