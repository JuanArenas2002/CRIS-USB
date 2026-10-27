import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { displayName } from '@/domain/authors/author';
import { ApiError } from '@/infrastructure/http/api-client';
import {
  RANKING_SHEET,
  clearRanking,
  listRanking,
  rankingRows,
  setRankingVisible,
  setRankingVisibleMany,
  uploadRanking,
  type RankingAdminRow,
  type RankingResult,
  type RankingRow,
} from '@/infrastructure/ranking/ranking-admin';
import { readXlsxSheet } from '@/infrastructure/ranking/xlsx';
import { AdminTokenForm, useAdminToken } from '@/presentation/components/admin/AdminToken';
import { useConfirm } from '@/presentation/components/admin/ConfirmDialog';
import { Icon } from '@/presentation/components/ui/Icon';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';

type Status = { kind: 'idle' | 'busy' | 'ok' | 'error'; text?: string };

/**
 * Vista oculta (fuera del menú, noindex, bloqueada en robots.txt) para cargar el ranking de
 * productividad USB. El ranking decide quién sale en el directorio de investigadores.
 */
export function AdminRankingPage() {
  const [confirm, confirmDialog] = useConfirm();
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
      qc.invalidateQueries({ queryKey: ['ranking-admin'] });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return rejected();
      setStatus({ kind: 'error', text: (err as Error).message || 'Error al guardar' });
    }
  };
  const busy = status.kind === 'busy';

  return (
    <div className="container-page py-10">
      {confirmDialog}
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
        <>
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
                  onClick={async () => {
                    if (
                      await confirm(
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
          <RankingList token={token} onUnauthorized={rejected} />
        </>
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

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/**
 * Quién sale en el directorio: cada fila se activa o desactiva y los puestos visibles se renumeran
 * entre los activos (si se oculta al 4.º, el 5.º se muestra como 4.º, en general y en su centro).
 */
function RankingList({ token, onUnauthorized }: { token: string; onUnauthorized: () => void }) {
  const [confirm, confirmDialog] = useConfirm();
  const qc = useQueryClient();
  const list = useQuery({
    // Sin el token en la clave: la clave aparece en mensajes de error y herramientas de depuración.
    // gcTime 0: al cambiar de token la lista se monta de nuevo y se pide otra vez.
    queryKey: ['ranking-admin'],
    queryFn: () => listRanking(token),
    retry: false,
    gcTime: 0,
  });
  const [term, setTerm] = useState('');
  const [center, setCenter] = useState('');
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState('');
  const unauthorized = list.error instanceof ApiError && list.error.status === 401;
  useEffect(() => {
    if (unauthorized) onUnauthorized();
  }, [unauthorized, onUnauthorized]);

  const rows = list.data ?? [];
  if (unauthorized || (list.isSuccess && !rows.length)) return null;
  const centers = [...new Set(rows.flatMap((r) => (r.center ? [r.center] : [])))].sort();
  const q = fold(term);
  const shown = rows.filter((r) => (!center || r.center === center) && (!q || fold(r.name).includes(q)));
  const active = rows.filter((r) => !r.hidden).length;

  // saving: id de la fila que se guarda, o 0 mientras se aplica «Activar / Desactivar todos».
  const apply = async (savingId: number, action: () => Promise<unknown>) => {
    setSaving(savingId);
    setError('');
    try {
      await action();
      await qc.invalidateQueries({ queryKey: ['ranking-admin'] });
      qc.invalidateQueries({ queryKey: ['authors'] });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onUnauthorized();
      setError((err as Error).message || 'No se pudo guardar');
    } finally {
      setSaving(null);
    }
  };
  const toggle = (r: RankingAdminRow) => apply(r.id, () => setRankingVisible(r.id, r.hidden, token));
  // Con búsqueda o centro elegido, se aplica solo a los filtrados.
  const filtered = Boolean(q || center);
  const setAll = async (visible: boolean) => {
    const ids = shown.filter((r) => r.hidden === visible).map((r) => r.id);
    if (!ids.length) return;
    const who = filtered ? `los ${ids.length} filtrados` : `los ${ids.length}`;
    if (await confirm(`¿${visible ? 'Activar' : 'Desactivar'} a ${who}?`))
      apply(0, () => setRankingVisibleMany(ids, visible, token));
  };

  return (
    <section aria-labelledby="ranking-list-title" className="mt-10">
      {confirmDialog}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 id="ranking-list-title" className="text-headline-sm font-bold text-primary">
            Quién sale en el directorio
          </h2>
          <p className="max-w-2xl text-body-sm text-neutral-muted">
            {list.isError
              ? `No se pudo cargar el ranking: ${list.error.message}`
              : list.data
                ? `${active} de ${rows.length} activos. Al desactivar a alguien, los de abajo suben un puesto (en general y en su centro).`
                : 'Cargando ranking…'}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 md:w-[28rem]">
          <div className="relative">
            <Icon
              name="search"
              className="pointer-events-none absolute top-2.5 left-3 text-[20px] text-on-surface-variant"
            />
            <input
              type="search"
              aria-label="Buscar investigador"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Buscar por nombre…"
              autoComplete="off"
              className="h-10 w-full rounded-lg bg-surface-container-lowest pr-3 pl-10 text-body-sm shadow-sm ring-1 ring-border-subtle focus:ring-2 focus:ring-secondary focus:outline-none"
            />
          </div>
          <select
            aria-label="Centro"
            value={center}
            onChange={(e) => setCenter(e.target.value)}
            className="h-10 rounded-lg bg-surface-container-lowest px-3 text-body-sm font-semibold shadow-sm focus:ring-2 focus:ring-secondary focus:outline-none"
          >
            <option value="">Todos los centros</option>
            {centers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      {list.data ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving !== null || shown.every((r) => !r.hidden)}
            onClick={() => setAll(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-label-md font-semibold text-on-primary hover:bg-secondary disabled:opacity-40"
          >
            <Icon name="visibility" className="text-[18px]" />
            {filtered ? 'Activar filtrados' : 'Activar todos'}
          </button>
          <button
            type="button"
            disabled={saving !== null || shown.every((r) => r.hidden)}
            onClick={() => setAll(false)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-label-md font-semibold text-error ring-1 ring-error/30 hover:bg-error-container/40 disabled:opacity-40"
          >
            <Icon name="visibility_off" className="text-[18px]" />
            {filtered ? 'Desactivar filtrados' : 'Desactivar todos'}
          </button>
          {saving === 0 ? <span className="text-label-sm text-neutral-muted">Guardando…</span> : null}
          {filtered ? (
            <span aria-live="polite" className="ml-auto text-label-md text-neutral-muted">
              {`${shown.length} de ${rows.length} investigadores`}
            </span>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-label-md text-error">
          {error}
        </p>
      ) : null}

      {list.data && filtered && !shown.length ? (
        <p className="mt-6 text-body-md text-neutral-muted">
          {term.trim()
            ? `Ningún investigador coincide con «${term.trim()}».`
            : 'Ningún investigador en ese centro.'}
        </p>
      ) : null}
      <ul className="mt-4 divide-y divide-border-subtle overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
        {shown.map((r) => (
          <li
            key={r.id}
            className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 ${r.hidden ? 'bg-surface-cream-alt/60' : ''}`}
          >
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={!r.hidden}
                disabled={saving !== null}
                onChange={() => toggle(r)}
                className="peer sr-only"
              />
              <span className="sr-only">{`Mostrar a ${displayName(r.name)} en el directorio`}</span>
              <span
                aria-hidden="true"
                className="h-6 w-11 rounded-full bg-neutral-muted/40 transition-colors peer-checked:bg-secondary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-secondary peer-disabled:opacity-50 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
              />
            </label>
            <div className={`min-w-0 ${r.hidden ? 'opacity-60' : ''}`}>
              <p className="truncate text-body-sm font-semibold text-on-surface">{displayName(r.name)}</p>
              <p className="text-label-sm text-neutral-muted">
                {r.center ?? 'Sin centro'} · Índice {r.index.toLocaleString('es-CO')} · Excel: #{r.rank}
                {r.centerRank ? ` general, #${r.centerRank} en ${r.center}` : ' general'}
              </p>
            </div>
            <p className="text-right text-label-md font-bold text-primary">
              {saving === r.id ? (
                <span className="text-label-sm text-neutral-muted">Guardando…</span>
              ) : r.shown ? (
                <>
                  #{r.shown.rank}
                  {r.shown.centerRank ? (
                    <span className="block text-label-sm font-semibold text-secondary">
                      #{r.shown.centerRank} en {r.center}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="text-label-sm font-semibold text-neutral-muted">Oculto</span>
              )}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
