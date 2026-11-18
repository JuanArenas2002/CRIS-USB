import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { iamAdmin, type Permission } from '@/infrastructure/news/iam-admin-api';
import { moduleLabel } from './labels';
import { KEYS } from './queries';
import {
  Badge,
  Button,
  Card,
  ErrorLine,
  Field,
  Input,
  Loading,
  StatusLine,
  useAction,
  useAdminSession,
  PageHeader,
} from './ui';

/** Catálogo de permisos. Registrar uno nuevo es el primer paso al integrar un módulo. */
export function PermissionsView() {
  const { can } = useAdminSession();
  const [module, setModule] = useState('');
  const all = useQuery({ queryKey: KEYS.permissions, queryFn: () => iamAdmin.listPermissions() });
  const modules = [...new Set((all.data?.items ?? []).map((p) => p.module))].sort();
  const items = (all.data?.items ?? [])
    .filter((p) => !module || p.module === module)
    .sort((a, b) => a.module.localeCompare(b.module) || a.name.localeCompare(b.name));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Permisos"
        description="Catálogo de acciones que el sistema controla. Se agrupan en roles; no se asignan sueltos."
      />
      {can('permissions.manage') && <CreatePermissionCard />}
      <Card
        title="Catálogo de permisos"
        actions={
          <div className="flex flex-wrap gap-2">
            {['', ...modules].map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={module === m}
                onClick={() => setModule(m)}
                className={`rounded-full px-3 py-1 text-label-sm ${module === m ? 'bg-primary text-on-primary' : 'bg-canvas-cream text-on-surface'}`}
              >
                {m ? moduleLabel(m) : 'Todos'}
              </button>
            ))}
          </div>
        }
      >
        {all.isPending ? (
          <Loading />
        ) : all.isError ? (
          <ErrorLine error={all.error} />
        ) : (
          <ul className="flex flex-col">
            {items.map((p) => (
              <PermissionRow key={p.id} p={p} manage={can('permissions.manage')} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function PermissionRow({ p, manage }: { p: Permission; manage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: p.name, description: p.description ?? '' });
  const a = useAction([KEYS.permissions]);
  return (
    <li className="flex flex-col gap-2 border-t border-border-subtle py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-on-surface">{p.name}</span>
        <Badge>{moduleLabel(p.module)}</Badge>
        {!p.is_active && <Badge tone="error">Inactivo</Badge>}
        <span className="text-label-sm text-neutral-muted" title="Identificador técnico">
          {p.code}
        </span>
        {manage && !editing && (
          <span className="ml-auto flex gap-2">
            <Button className="h-8 px-3" onClick={() => setEditing(true)}>
              Editar
            </Button>
            <Button
              className="h-8 px-3"
              disabled={a.busy}
              onClick={() =>
                void a.run(
                  () => iamAdmin.updatePermission(p.id, { is_active: !p.is_active }),
                  p.is_active ? 'Desactivado.' : 'Activado.',
                )
              }
            >
              {p.is_active ? 'Desactivar' : 'Activar'}
            </Button>
          </span>
        )}
      </div>
      {p.description && !editing && <p className="text-label-sm text-on-surface-variant">{p.description}</p>}
      {editing && (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Nombre">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="min-w-64 flex-1">
            <Field label="Descripción">
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
          </div>
          <Button
            variant="primary"
            disabled={a.busy}
            onClick={async () => {
              const ok = await a.run(
                () =>
                  iamAdmin.updatePermission(p.id, { name: form.name, description: form.description || null }),
                'Guardado.',
              );
              if (ok) setEditing(false);
            }}
          >
            Guardar
          </Button>
          <Button onClick={() => setEditing(false)}>Cancelar</Button>
        </div>
      )}
      <StatusLine status={a.status} />
    </li>
  );
}

function CreatePermissionCard() {
  const empty = { code: '', name: '', description: '' };
  const [form, setForm] = useState(empty);
  const a = useAction([KEYS.permissions]);
  const parts = form.code.split('.');
  // modulo.accion | modulo.recurso.accion: recurso = módulo si hay dos segmentos.
  const derived = {
    module: parts[0] ?? '',
    resource: parts.length === 3 ? parts[1]! : (parts[0] ?? ''),
    action: parts.at(-1) ?? '',
  };
  return (
    <Card title="Registrar permiso">
      <p className="mb-3 text-label-sm text-neutral-muted">
        Al incorporar un módulo a la plataforma: registra aquí sus permisos y después agrégalos a los roles en
        la pestaña Roles.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Nombre" hint="Lo que verán los administradores, p.ej. “Publicar eventos”">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Identificador técnico" hint="modulo.accion, p.ej. events.publish">
          <Input
            value={form.code}
            onChange={(e) =>
              setForm({ ...form, code: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '') })
            }
          />
        </Field>
        <Field label="Descripción">
          <Input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button
          variant="primary"
          disabled={a.busy || parts.length < 2 || !parts.every(Boolean) || !form.name}
          onClick={async () => {
            const r = await a.run(
              () => iamAdmin.createPermission({ ...form, description: form.description || null, ...derived }),
              'Permiso registrado.',
            );
            if (r) setForm(empty);
          }}
        >
          Registrar
        </Button>
        <StatusLine status={a.status} />
      </div>
    </Card>
  );
}
