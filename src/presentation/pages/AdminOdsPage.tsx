import { useContext, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { displayName } from '@/domain/authors/author';
import type { Group } from '@/domain/groups/group';
import { ODS, odsIcon, type OdsId } from '@/domain/ods/ods';
import { saveGroupOds } from '@/infrastructure/groups/ods-admin';
import { ApiError } from '@/infrastructure/http/api-client';
import { AdminTokenForm, useAdminToken } from '@/presentation/components/admin/AdminToken';
import { ErrorState } from '@/presentation/components/feedback/Feedback';
import { Icon } from '@/presentation/components/ui/Icon';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
import { GroupQueriesContext } from '@/presentation/hooks/use-groups';

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/**
 * Vista oculta (fuera del menú, noindex, bloqueada en robots.txt) para asignar ODS a los grupos
 * activos mientras Metri-K no los tenga. Ocultarla no es la seguridad: guardar exige el token del BFF.
 */
export function AdminOdsPage() {
  useDocumentMetadata({
    title: 'Asignación de ODS',
    description: 'Administración interna de los ODS de cada grupo de investigación.',
    path: '/admin/ods',
    noindex: true,
  });
  const queries = useContext(GroupQueriesContext)!;
  const qc = useQueryClient();
  const list = useQuery(queries.list());
  const { token, error, save, clear, rejected } = useAdminToken();
  const [term, setTerm] = useState('');
  const onSaved = () => qc.invalidateQueries({ queryKey: ['groups'] });

  const q = fold(term);
  const visible = (list.data ?? []).filter((g) => !q || fold(`${g.name} ${g.code}`).includes(q));
  const assigned = (list.data ?? []).filter((g) => g.ods.length).length;

  return (
    <div className="container-page py-10">
      <p className="text-label-md font-bold tracking-widest text-secondary uppercase">Administración</p>
      <h1 className="mt-1 text-headline-lg-mobile font-bold tracking-tight text-primary md:text-headline-lg">
        Asignación de ODS
      </h1>
      <p className="mt-1 max-w-3xl text-body-md text-neutral-muted">
        Marca los Objetivos de Desarrollo Sostenible a los que aporta cada grupo. Se guardan en el servidor
        del portal hasta que Metri-K los soporte, y se muestran en el perfil del grupo.
      </p>

      {!token ? (
        <AdminTokenForm error={error} onSubmit={save} />
      ) : list.isError ? (
        <div className="mt-8">
          <ErrorState message={list.error.message} onRetry={() => list.refetch()} />
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="text-body-sm text-neutral-muted">
                {list.data
                  ? `${list.data.length} grupos activos · ${assigned} con ODS asignados`
                  : 'Cargando…'}
              </span>
              <button
                type="button"
                onClick={() => clear()}
                className="text-label-md font-semibold text-secondary hover:underline"
              >
                Cambiar token
              </button>
            </div>
            <div className="relative w-full sm:w-80">
              <Icon
                name="search"
                className="pointer-events-none absolute top-2.5 left-3 text-[20px] text-on-surface-variant"
              />
              <label htmlFor="ods-group-search" className="sr-only">
                Buscar grupo
              </label>
              <input
                id="ods-group-search"
                type="search"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Buscar por nombre o código…"
                className="h-10 w-full rounded-lg bg-surface-container-lowest pr-3 pl-10 text-body-sm shadow-sm focus:ring-2 focus:ring-secondary focus:outline-none"
              />
            </div>
          </div>
          <ul className="mt-4 grid gap-gutter xl:grid-cols-2">
            {visible.map((g) => (
              <OdsRow key={g.id} group={g} token={token} onSaved={onSaved} onUnauthorized={rejected} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function OdsRow({
  group,
  token,
  onSaved,
  onUnauthorized,
}: {
  group: Group;
  token: string;
  onSaved: () => void;
  onUnauthorized: () => void;
}) {
  const [selected, setSelected] = useState<OdsId[]>(group.ods);
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'error'; text?: string }>({
    kind: 'idle',
  });
  const dirty = selected.join() !== group.ods.join();
  const toggle = (id: OdsId) => {
    setStatus({ kind: 'idle' });
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].sort((a, b) => a - b)));
  };
  const submit = async () => {
    setStatus({ kind: 'busy' });
    try {
      setSelected(await saveGroupOds(group.id, selected, token));
      setStatus({ kind: 'ok', text: 'ODS guardados' });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onUnauthorized();
      setStatus({ kind: 'error', text: (err as Error).message || 'Error al guardar' });
    }
  };

  return (
    <li className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-headline-sm leading-snug font-semibold text-primary">{group.name}</h2>
          <p className="text-label-sm text-neutral-muted">
            {group.code}
            {group.category ? ` · Cat. ${group.category}` : ''}
            {group.leader ? ` · ${displayName(group.leader.name)}` : ''}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-badge-sage-bg px-2.5 py-0.5 text-label-sm font-bold text-badge-sage-text">
          {selected.length} ODS
        </span>
      </div>

      <fieldset>
        <legend className="sr-only">ODS de {group.name}</legend>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9">
          {ODS.map((o) => {
            const on = selected.includes(o.id);
            return (
              <label
                key={o.id}
                title={`ODS ${o.id}: ${o.name}`}
                className={`relative cursor-pointer rounded-md transition-all has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-container ${
                  on
                    ? 'ring-2 ring-primary-container ring-offset-2'
                    : 'opacity-35 grayscale hover:opacity-80 hover:grayscale-0'
                }`}
              >
                <input type="checkbox" checked={on} onChange={() => toggle(o.id)} className="sr-only" />
                <img
                  src={odsIcon(o.id)}
                  alt={`ODS ${o.id}: ${o.name}`}
                  className="aspect-square w-full rounded-md"
                />
                {on ? (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary-container text-on-primary shadow"
                  >
                    <Icon name="check_circle" className="text-[16px]" />
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!dirty || status.kind === 'busy'}
          onClick={submit}
          className="h-9 rounded-lg bg-primary px-5 text-label-md font-semibold text-on-primary hover:bg-secondary disabled:opacity-40"
        >
          Guardar
        </button>
        <button
          type="button"
          disabled={!dirty || status.kind === 'busy'}
          onClick={() => setSelected(group.ods)}
          className="h-9 rounded-lg px-3 text-label-md font-semibold text-on-surface-variant hover:bg-surface-cream-alt disabled:opacity-40"
        >
          Descartar
        </button>
        <p
          role="status"
          className={`text-label-sm ${status.kind === 'error' ? 'text-error' : status.kind === 'ok' ? 'text-secondary' : 'text-neutral-muted'}`}
        >
          {status.kind === 'busy'
            ? 'Guardando…'
            : status.kind === 'idle' && dirty
              ? 'Cambios sin guardar'
              : status.text}
        </p>
      </div>
    </li>
  );
}
