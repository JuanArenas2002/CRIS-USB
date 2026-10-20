import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/infrastructure/http/api-client';
import {
  RANKING_SHEET,
  clearRanking,
  rankingRows,
  uploadRanking,
  type RankingResult,
  type RankingRow,
} from '@/infrastructure/ranking/ranking-admin';
import { readXlsxSheet } from '@/infrastructure/ranking/xlsx';
import { AdminTokenForm, useAdminToken } from '@/presentation/components/admin/AdminToken';
import { Icon } from '@/presentation/components/ui/Icon';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';

type Status = { kind: 'idle' | 'busy' | 'ok' | 'error'; text?: string };

/**
 * Vista oculta (fuera del menú, noindex, bloqueada en robots.txt) para cargar el ranking de
 * productividad USB. El ranking decide quién sale en el directorio de investigadores.
 */
export function AdminRankingPage() {
  useDocumentMetadata({
    title: 'Ranking de productividad',
    description: 'Administración interna del ranking de productividad USB.',
    path: '/admin/ranking',
    noindex: true,
  });
  const qc = useQueryClient();
  const { token, error, save, clear, rejected } = useAdminToken();
  const [file, setFile] = useState<{ name: string; rows: RankingRow[] } | null>(null);
  const [result, setResult] = useState<RankingResult | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setResult(null);
    setStatus({ kind: 'busy', text: 'Leyendo el Excel…' });
    try {
      const rows = rankingRows(await readXlsxSheet(f, RANKING_SHEET));
      if (!rows.length) throw new Error('La hoja no tiene filas con cédula');
      setFile({ name: f.name, rows });
      setStatus({ kind: 'idle' });
    } catch (err) {
      setFile(null);
      setStatus({ kind: 'error', text: (err as Error).message || 'No se pudo leer el Excel' });
    }
  };
  const run = async (action: () => Promise<RankingResult>, ok: (r: RankingResult) => string) => {
    setStatus({ kind: 'busy', text: 'Guardando…' });
    try {
      const r = await action();
      setResult(r);
      setStatus({ kind: 'ok', text: ok(r) });
      qc.invalidateQueries({ queryKey: ['authors'] });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return rejected();
      setStatus({ kind: 'error', text: (err as Error).message || 'Error al guardar' });
    }
  };
  const busy = status.kind === 'busy';

  return (
    <div className="container-page py-10">
      <p className="text-label-md font-bold tracking-widest text-secondary uppercase">Administración</p>
      <h1 className="mt-1 text-headline-lg-mobile font-bold tracking-tight text-primary md:text-headline-lg">
        Ranking de productividad USB
      </h1>
      <p className="mt-1 max-w-3xl text-body-md text-neutral-muted">
        Sube el Excel del modelo (hoja <strong>{RANKING_SHEET}</strong>). Al publicarlo, el directorio muestra
        solo a los investigadores del ranking que estén activos en GrupLAC, cada uno con su índice de
        productividad y su puesto en el centro. Del Excel solo se envían la cédula, el nombre, los puestos, el
        centro y el índice; la cédula se usa para encontrar a cada persona en Metri-K y no se guarda.
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
                ? `${file.name} · ${file.rows.length} filas leídas — elegir otro`
                : 'Elegir Excel (.xlsx)'}
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(e) => pick(e.target.files?.[0])}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!file || busy}
                onClick={() =>
                  run(
                    () => uploadRanking(file!.rows, token),
                    (r) => `Ranking publicado: ${r.published} investigadores en el directorio`,
                  )
                }
                className="h-10 rounded-lg bg-primary px-5 text-label-md font-semibold text-on-primary hover:bg-secondary disabled:opacity-40"
              >
                Publicar ranking
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      '¿Quitar el ranking? El directorio volverá a mostrar los seleccionados de Metri-K.',
                    )
                  )
                    run(
                      () => clearRanking(token),
                      () => 'Ranking quitado: se muestran los seleccionados de Metri-K',
                    );
                }}
                className="h-10 rounded-lg px-3 text-label-md font-semibold text-error hover:bg-error-container/40 disabled:opacity-40"
              >
                Quitar ranking
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

          {result ? (
            <div className="grid gap-3 md:grid-cols-3">
              <NameList title="No están en Metri-K (cédula)" names={result.notFound} />
              <NameList title="Inactivos en GrupLAC" names={result.inactive} />
              <NameList title="Fila incompleta (puesto o índice)" names={result.invalid} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function NameList({ title, names }: { title: string; names: string[] }) {
  return (
    <details
      className="rounded-xl bg-surface-container-lowest p-4 shadow-sm"
      open={names.length > 0 && names.length <= 10}
    >
      <summary className="cursor-pointer text-label-md font-semibold text-on-surface">
        {title}: {names.length}
      </summary>
      {names.length ? (
        <ul className="mt-2 max-h-64 overflow-y-auto text-label-sm text-on-surface-variant">
          {names.map((n, i) => (
            <li key={`${n}-${i}`}>{n}</li>
          ))}
        </ul>
      ) : null}
    </details>
  );
}
