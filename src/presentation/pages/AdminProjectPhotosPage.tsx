import { withBaseUrl } from '@/shared/base';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PROJECT_ROLES, projectsOfCenter, type Project } from '@/domain/projects/project';
import { ApiError } from '@/infrastructure/http/api-client';
import {
  addStaff,
  checkCenterAccess,
  listStaff,
  removeStaff,
  type ProjectStaff,
  deleteProjectPhoto,
  toProjectPhotoWebp,
  uploadProjectPhoto,
  type CenterKey,
} from '@/infrastructure/photos/photo-admin';
import { AdminTokenForm, useAdminToken } from '@/presentation/components/admin/AdminToken';
import { useConfirm } from '@/presentation/components/admin/ConfirmDialog';
import { PasswordInput } from '@/presentation/components/admin/PasswordInput';
import { Drawer } from '@/presentation/components/admin/Drawer';
import { displayName, initials } from '@/domain/authors/author';
import { ErrorState } from '@/presentation/components/feedback/Feedback';
import { FilterSelect } from '@/presentation/components/ui/FilterSelect';
import { Icon } from '@/presentation/components/ui/Icon';
import { useCenters } from '@/presentation/hooks/use-centers';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
import { useProjects } from '@/presentation/hooks/use-projects';

/** Igual que scripts/photo-store.ts (MAX_PROJECT_GALLERY). */
const MAX_GALLERY = 12;

type Access = CenterKey & { name: string };

/**
 * Vista oculta (fuera del menú, noindex, bloqueada en robots.txt): foto principal y galería de cada
 * proyecto. Ocultarla no es la seguridad: guardar exige el token del BFF y la contraseña del centro
 * (la asigna el admin general en /admin/centros y la tiene la dirección del centro).
 */
export function AdminProjectPhotosPage() {
  useDocumentMetadata({
    title: 'Fotos de proyectos',
    description: 'Administración interna de la foto principal y las fotos asociadas de cada proyecto.',
    path: '/admin/proyectos/fotos',
    noindex: true,
  });
  const qc = useQueryClient();
  const list = useProjects();
  const centers = useCenters();
  const { token, error, save, clear, rejected } = useAdminToken();
  // ponytail: la contraseña del centro vive solo en memoria; al recargar se vuelve a pedir.
  const [center, setCenter] = useState<Access | null>(null);
  const onChanged = () => qc.invalidateQueries({ queryKey: ['projects'] });
  const projects = center ? projectsOfCenter(list.data ?? [], center.name) : [];

  return (
    <div className="container-page py-10">
      <p className="text-label-md font-bold tracking-widest text-secondary uppercase">Administración</p>
      <h1 className="mt-1 text-headline-lg-mobile font-bold tracking-tight text-primary md:text-headline-lg">
        Fotos de proyectos
      </h1>
      <p className="mt-1 max-w-3xl text-body-md text-neutral-muted">
        Metri-K no guarda fotos: se guardan en el servidor del portal. La <strong>foto principal</strong> es
        la de la lista de proyectos; las <strong>fotos asociadas</strong> (hasta {MAX_GALLERY}) salen en la
        ficha. Cada foto se convierte a WebP (máx. 1280 px, sin recortar) antes de subirla.
      </p>

      {!token ? (
        <AdminTokenForm error={error} onSubmit={save} />
      ) : list.isError ? (
        <div className="mt-8">
          <ErrorState message={list.error.message} onRetry={() => list.refetch()} />
        </div>
      ) : !center ? (
        <CenterLogin
          // Solo los centros que tienen proyectos.
          centers={(centers.data ?? []).filter((c) => projectsOfCenter(list.data ?? [], c.name).length)}
          token={token}
          onAccess={setCenter}
          onUnauthorized={rejected}
          onChangeToken={() => clear()}
        />
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="text-body-sm font-semibold text-primary">{center.name}</span>
            <span className="text-body-sm text-neutral-muted">{projects.length} proyectos</span>
            <button
              type="button"
              onClick={() => setCenter(null)}
              className="text-label-md font-semibold text-secondary hover:underline"
            >
              Cambiar centro
            </button>
          </div>
          <ul className="mt-4 flex flex-col gap-gutter">
            {projects.map((p) => (
              <ProjectPhotos
                key={p.id}
                project={p}
                token={token}
                center={center}
                onChanged={onChanged}
                onUnauthorized={rejected}
                onForbidden={() => setCenter(null)}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

type Status = { kind: 'idle' | 'busy' | 'ok' | 'error'; text?: string };

/** Elegir el centro y escribir la contraseña de su dirección (la comprueba el BFF). */
function CenterLogin({
  centers,
  token,
  onAccess,
  onUnauthorized,
  onChangeToken,
}: {
  centers: { id: number; name: string }[];
  token: string;
  onAccess: (c: Access) => void;
  onUnauthorized: () => void;
  onChangeToken: () => void;
}) {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const chosen = centers.find((c) => String(c.id) === id);

  const submit = async () => {
    if (!chosen) return;
    setStatus({ kind: 'busy' });
    try {
      if (await checkCenterAccess({ id: chosen.id, password }, token))
        return onAccess({ id: chosen.id, password, name: chosen.name });
      setStatus({ kind: 'error', text: 'Contraseña del centro incorrecta' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onUnauthorized();
      setStatus({ kind: 'error', text: (err as Error).message || 'No se pudo comprobar' });
    }
  };

  return (
    <form
      className="mt-8 flex max-w-md flex-col gap-3 rounded-xl bg-surface-container-lowest p-5 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p className="text-body-sm text-neutral-muted">
        Elige el centro y escribe la contraseña de su dirección para administrar las fotos de sus proyectos.
      </p>
      <FilterSelect
        label="Centro"
        value={id}
        onChange={setId}
        options={[['', 'Elige un centro'], ...centers.map((c): [string, string] => [String(c.id), c.name])]}
        className=""
      />
      <label className="flex flex-col gap-1 text-label-sm font-semibold text-on-surface-variant">
        Contraseña del centro
        <PasswordInput
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!chosen || !password || status.kind === 'busy'}
          className="h-10 rounded-lg bg-primary px-5 text-label-md font-semibold text-on-primary hover:bg-secondary disabled:opacity-40"
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={onChangeToken}
          className="text-label-md font-semibold text-secondary hover:underline"
        >
          Cambiar token
        </button>
      </div>
      {status.kind === 'error' ? (
        <p role="alert" className="text-label-sm text-error">
          {status.text}
        </p>
      ) : null}
    </form>
  );
}

function ProjectPhotos({
  project: p,
  token,
  center,
  onChanged,
  onUnauthorized,
  onForbidden,
}: {
  project: Project;
  token: string;
  center: CenterKey;
  onChanged: () => void;
  onUnauthorized: () => void;
  /** La contraseña del centro cambió mientras tanto: se vuelve a pedir. */
  onForbidden: () => void;
}) {
  const [confirm, confirmDialog] = useConfirm();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [teamOpen, setTeamOpen] = useState(false);
  const busy = status.kind === 'busy';
  const free = Array.from({ length: MAX_GALLERY }, (_, i) => i + 1).filter(
    (slot) => !p.gallery.some((g) => g.slot === slot),
  );

  const run = async (action: () => Promise<unknown>, ok: string) => {
    setStatus({ kind: 'busy' });
    try {
      await action();
      setStatus({ kind: 'ok', text: ok });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onUnauthorized();
      if (err instanceof ApiError && err.status === 403) return onForbidden();
      setStatus({ kind: 'error', text: (err as Error).message || 'Error al guardar' });
    } finally {
      onChanged();
    }
  };
  const images = (files: FileList | null) => [...(files ?? [])].filter((f) => f.type.startsWith('image/'));

  const setMain = (files: FileList | null) => {
    const [file] = images(files);
    if (file)
      run(
        async () => uploadProjectPhoto(p.id, 0, await toProjectPhotoWebp(file), token, center),
        'Foto principal guardada',
      );
  };
  const addGallery = (files: FileList | null) => {
    const picked = images(files).slice(0, free.length);
    if (picked.length)
      run(
        async () => {
          // Una a una: cada foto ocupa la siguiente posición libre.
          for (const [i, file] of picked.entries())
            await uploadProjectPhoto(p.id, free[i]!, await toProjectPhotoWebp(file), token, center);
        },
        picked.length === 1 ? 'Foto agregada' : `${picked.length} fotos agregadas`,
      );
  };

  const fileButton =
    'cursor-pointer rounded-lg border border-dashed border-border-subtle px-3 py-2 text-center text-label-md font-semibold text-secondary hover:bg-surface-cream-alt';
  const removeButton =
    'rounded-lg bg-white/90 px-2 py-1 text-label-sm font-semibold text-error shadow-sm hover:bg-white disabled:opacity-40';

  return (
    <li className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-5 shadow-sm">
      {confirmDialog}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex shrink-0 flex-col gap-2 lg:w-80">
          <p className="font-mono text-label-sm text-neutral-muted">{p.code}</p>
          <h2 className="text-headline-sm leading-snug font-semibold text-primary">{p.title}</h2>
          <div className="relative mt-1 aspect-video overflow-hidden rounded-xl border border-border-subtle bg-surface-cream-alt">
            {p.photoUrl ? (
              <img
                src={withBaseUrl(p.photoUrl)}
                alt="Foto principal"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full items-center justify-center text-label-md text-neutral-muted">
                Sin foto principal
              </span>
            )}
            {p.photoUrl ? (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (await confirm('¿Quitar la foto principal?'))
                    run(() => deleteProjectPhoto(p.id, 0, token, center), 'Foto principal quitada');
                }}
                className={`absolute top-2 right-2 ${removeButton}`}
              >
                Quitar
              </button>
            ) : null}
          </div>
          <label className={fileButton}>
            <Icon name="upload" className="mr-1 align-middle text-[18px]" />
            {p.photoUrl ? 'Cambiar foto principal' : 'Elegir foto principal'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                setMain(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="text-label-md font-semibold text-on-surface-variant">
            Fotos asociadas ({p.gallery.length}/{MAX_GALLERY})
          </p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {p.gallery.map((g) => (
              <li
                key={g.slot}
                className="relative aspect-video overflow-hidden rounded-lg bg-surface-cream-alt"
              >
                <img src={withBaseUrl(g.url)} alt={`Foto ${g.slot}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    if (await confirm('¿Quitar esta foto?'))
                      run(() => deleteProjectPhoto(p.id, g.slot, token, center), 'Foto quitada');
                  }}
                  className={`absolute top-1.5 right-1.5 ${removeButton}`}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
          {free.length ? (
            <label className={fileButton}>
              <Icon name="upload" className="mr-1 align-middle text-[18px]" />
              Agregar fotos asociadas
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={busy}
                onChange={(e) => {
                  addGallery(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          ) : null}
          {status.kind !== 'idle' ? (
            <p
              role="status"
              className={`text-label-sm ${status.kind === 'error' ? 'text-error' : status.kind === 'ok' ? 'text-secondary' : 'text-neutral-muted'}`}
            >
              {status.kind === 'busy' ? 'Guardando…' : status.text}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
        <div className="flex min-w-0 items-center gap-2 text-body-sm">
          <Icon name="group" className="text-[20px] text-secondary" />
          {p.team.length ? (
            <span className="min-w-0 truncate text-on-surface">
              <span className="font-semibold">{p.team.length}</span>{' '}
              {p.team.length === 1 ? 'integrante' : 'integrantes'} ·{' '}
              <span className="text-neutral-muted">{p.team.map((m) => m.name).join(', ')}</span>
            </span>
          ) : (
            <span className="text-neutral-muted">Sin equipo asignado</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setTeamOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-container-lowest px-3.5 py-2 text-label-md font-semibold text-primary shadow-xs transition-colors hover:border-secondary hover:bg-badge-sage-bg"
        >
          <Icon name="person" className="text-[18px]" /> Gestionar equipo
        </button>
      </div>
      <Drawer
        open={teamOpen}
        onClose={() => setTeamOpen(false)}
        title="Equipo del proyecto"
        subtitle={`${p.code} · ${p.title}`}
      >
        <ProjectTeam
          projectId={p.id}
          token={token}
          center={center}
          onChanged={onChanged}
          onUnauthorized={onUnauthorized}
          onForbidden={onForbidden}
        />
      </Drawer>
    </li>
  );
}

/**
 * Equipo del proyecto en Metri-K (`personal`): una persona por envío (se pueden agregar varias),
 * cédula opcional y rol libre con sugerencias. Metri-K solo permite quitar por cédula.
 */
function ProjectTeam({
  projectId,
  token,
  center,
  onChanged,
  onUnauthorized,
  onForbidden,
}: {
  projectId: number;
  token: string;
  center: CenterKey;
  onChanged: () => void;
  onUnauthorized: () => void;
  onForbidden: () => void;
}) {
  const [confirm, confirmDialog] = useConfirm();
  const qc = useQueryClient();
  // Lectura en vivo de Metri-K al abrir el panel; cada cambio deja aquí el equipo actualizado.
  const staffKey = ['projects', 'staff', projectId];
  const query = useQuery({
    queryKey: staffKey,
    queryFn: () => listStaff(projectId, token, center),
    retry: false,
    staleTime: 0,
  });
  const team = query.data ?? null;
  const [form, setForm] = useState({ nombreCompleto: '', cedula: '', rol: PROJECT_ROLES[0] as string });
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const busy = status.kind === 'busy';
  // El toast se cierra solo a los 4 s (el error también, pero puede cerrarse antes).
  useEffect(() => {
    if (status.kind !== 'ok' && status.kind !== 'error') return;
    const id = setTimeout(() => setStatus({ kind: 'idle' }), 4000);
    return () => clearTimeout(id);
  }, [status]);

  const run = async (action: () => Promise<ProjectStaff[]>, ok?: string) => {
    setStatus({ kind: 'busy' });
    try {
      qc.setQueryData(staffKey, await action());
      setStatus(ok ? { kind: 'ok', text: ok } : { kind: 'idle' });
      if (ok) onChanged();
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onUnauthorized();
      else if (err instanceof ApiError && err.status === 403) onForbidden();
      else setStatus({ kind: 'error', text: (err as Error).message || 'Error al guardar' });
      return false;
    }
  };

  const field =
    'h-10 w-full rounded-lg border border-border-subtle bg-surface-container-lowest px-3 text-body-sm font-normal focus:ring-2 focus:ring-secondary focus:outline-none';

  return (
    <div className="flex flex-col gap-8">
      {confirmDialog}
      <section aria-labelledby={`team-list-${projectId}`}>
        <h3
          id={`team-list-${projectId}`}
          className="mb-3 text-label-md font-bold tracking-wider text-neutral-muted uppercase"
        >
          Integrantes{team ? ` (${team.length})` : ''}
        </h3>
        {query.isError ? (
          <p role="alert" className="rounded-lg bg-error-container/40 p-3 text-body-sm text-error">
            {query.error.message || 'No se pudo cargar el equipo'}
          </p>
        ) : team === null ? (
          <div aria-busy="true" className="flex flex-col gap-2">
            {[0, 1].map((k) => (
              <div key={k} className="h-14 animate-pulse rounded-xl bg-surface-cream-alt" />
            ))}
          </div>
        ) : team.length ? (
          <ul className="flex flex-col gap-2">
            {team.map((m) => (
              <li
                key={`${m.cedula ?? ''}-${m.nombreCompleto}`}
                className="flex items-center gap-3 rounded-xl border border-border-subtle p-3"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-badge-sage-bg text-label-md font-bold text-badge-sage-text">
                  {initials(displayName(m.nombreCompleto))}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-semibold text-on-surface">
                    {displayName(m.nombreCompleto)}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-2 text-label-sm text-neutral-muted">
                    {m.rol ? <span className="font-medium text-secondary">{m.rol}</span> : null}
                    <span>{m.cedula ? `C.C. ${m.cedula}` : 'Sin cédula'}</span>
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy || !m.cedula}
                  aria-label={`Quitar a ${m.nombreCompleto}`}
                  title={
                    m.cedula ? 'Quitar del proyecto' : 'Metri-K solo permite quitar a quien tiene cédula'
                  }
                  onClick={async () => {
                    if (m.cedula && (await confirm(`¿Quitar a ${m.nombreCompleto} del proyecto?`)))
                      void run(
                        () => removeStaff(projectId, m.cedula!, token, center),
                        'Participante eliminado correctamente',
                      );
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-muted transition-colors hover:bg-error-container/40 hover:text-error disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <Icon name="close" className="text-[18px]" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-border-subtle p-4 text-center text-body-sm text-neutral-muted">
            Este proyecto aún no tiene integrantes.
          </p>
        )}
      </section>

      <section aria-labelledby={`team-add-${projectId}`} className="rounded-xl bg-canvas-cream p-4">
        <h3
          id={`team-add-${projectId}`}
          className="mb-3 text-label-md font-bold tracking-wider text-neutral-muted uppercase"
        >
          Agregar integrante
        </h3>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const person = {
              nombreCompleto: form.nombreCompleto.trim(),
              cedula: form.cedula.trim() || null,
              rol: form.rol.trim() || null,
            };
            // Tras agregar, el formulario queda listo para la siguiente persona.
            if (
              await run(
                () => addStaff(projectId, person, token, center),
                'Participante agregado correctamente',
              )
            )
              setForm((f) => ({ ...f, nombreCompleto: '', cedula: '' }));
          }}
        >
          <label className="flex flex-col gap-1 text-label-sm font-semibold text-on-surface-variant">
            Nombre completo
            <input
              required
              maxLength={200}
              value={form.nombreCompleto}
              onChange={(e) => setForm({ ...form, nombreCompleto: e.target.value })}
              placeholder="Ej.: Roberto Figueroa del Valle"
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1 text-label-sm font-semibold text-on-surface-variant">
            <span>
              Cédula <span className="font-normal text-neutral-muted">(opcional)</span>
            </span>
            <input
              inputMode="numeric"
              pattern="\d{4,15}"
              title="Solo números (4 a 15 dígitos)"
              value={form.cedula}
              onChange={(e) => setForm({ ...form, cedula: e.target.value })}
              className={field}
            />
          </label>
          <div className="flex flex-col gap-1">
            <span aria-hidden="true" className="text-label-sm font-semibold text-on-surface-variant">
              Rol
            </span>
            <FilterSelect
              label="Rol"
              value={form.rol}
              onChange={(rol) => setForm({ ...form, rol })}
              options={PROJECT_ROLES.map((r): [string, string] => [r, r])}
              className=""
            />
          </div>
          <button
            type="submit"
            disabled={busy || !form.nombreCompleto.trim()}
            className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-secondary px-4 text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:opacity-40"
          >
            <Icon name="person" className="text-[18px]" />
            {busy ? 'Guardando…' : 'Agregar participante'}
          </button>
        </form>
      </section>

      {/* Toast: dentro del panel (el <dialog> está por encima del resto de la página). */}
      <div aria-live="polite" className="pointer-events-none fixed right-6 bottom-6 z-50 flex justify-end">
        {status.kind === 'ok' || status.kind === 'error' ? (
          <p
            role={status.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-xl px-4 py-3 text-label-md font-semibold text-on-primary shadow-xl motion-safe:animate-[toast-in_200ms_ease-out] ${
              status.kind === 'error' ? 'bg-error' : 'bg-secondary'
            }`}
          >
            <Icon name={status.kind === 'error' ? 'error' : 'check_circle'} className="text-[20px]" />
            {status.text}
            <button
              type="button"
              onClick={() => setStatus({ kind: 'idle' })}
              aria-label="Cerrar aviso"
              className="ml-1 rounded-full p-0.5 hover:bg-white/20"
            >
              <Icon name="close" className="text-[16px]" />
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}
