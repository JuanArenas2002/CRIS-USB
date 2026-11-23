import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { iamAdmin, type Role } from '@/infrastructure/news/iam-admin-api';
import { useConfirm } from '@/presentation/components/admin/ConfirmDialog';
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

export interface PermissionOption {
  code: string;
  name: string;
  module: string;
}

/** Roles dinámicos: el sistema decide por los permisos que contienen, nunca por su nombre. */
export function RolesView() {
  const { can } = useAdminSession();
  const roles = useQuery({
    queryKey: [...KEYS.roles, 'all'],
    queryFn: () => iamAdmin.listRoles({ order: 'asc', sort: 'name' }),
  });
  const perms = useQuery({
    queryKey: KEYS.permissions,
    queryFn: () => iamAdmin.listPermissions(),
    enabled: can('roles.manage') || can('permissions.view'),
  });
  const options: PermissionOption[] = (perms.data?.items ?? [])
    .filter((p) => p.is_active)
    .map(({ code, name, module }) => ({ code, name, module }));
  const [selected, setSelected] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const role = roles.data?.items.find((r) => r.id === selected);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Roles"
        description="Conjuntos de permisos que se asignan a los usuarios, con alcance institucional o por dependencia."
        actions={
          can('roles.manage') && (
            <Button variant="primary" aria-expanded={creating} onClick={() => setCreating((v) => !v)}>
              {creating ? 'Cancelar' : 'Nuevo rol'}
            </Button>
          )
        }
      />
      {can('roles.manage') && creating && <CreateRoleCard options={options} />}
      <Card title="Roles del sistema" description="Selecciona un rol para ver o editar sus permisos.">
        {roles.isPending ? (
          <Loading />
        ) : roles.isError ? (
          <ErrorLine error={roles.error} />
        ) : (
          <ul className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
            {roles.data.items.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelected(r.id === selected ? null : r.id)}
                  aria-expanded={r.id === selected}
                  className={`flex w-full flex-col gap-1 rounded-lg border p-3 text-left ${
                    r.id === selected
                      ? 'border-primary bg-primary/5'
                      : 'border-border-subtle hover:bg-surface-cream-alt'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-on-surface">{r.name}</span>
                    {!r.is_active && <Badge>Inactivo</Badge>}
                  </span>
                  {r.description && (
                    <span className="text-label-sm text-on-surface-variant">{r.description}</span>
                  )}
                  <span className="text-label-sm text-neutral-muted">
                    {r.permissions.length ? `${r.permissions.length} permisos` : 'Sin permisos'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {role && <RoleDetail key={role.id} role={role} options={options} />}
    </div>
  );
}

function CreateRoleCard({ options }: { options: PermissionOption[] }) {
  const empty = { code: '', name: '', description: '', permissions: [] as string[] };
  const [form, setForm] = useState(empty);
  const a = useAction([KEYS.roles]);
  return (
    <Card title="Nuevo rol">
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Nombre">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Identificador" hint="Sin espacios ni tildes, p.ej. comunicaciones">
          <Input
            value={form.code}
            onChange={(e) =>
              setForm({ ...form, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })
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
      <PermissionPicker
        options={options}
        value={form.permissions}
        onChange={(permissions) => setForm({ ...form, permissions })}
      />
      <div className="mt-3 flex items-center gap-3">
        <Button
          variant="primary"
          disabled={a.busy || form.code.length < 3 || !form.name}
          onClick={async () => {
            const r = await a.run(
              () => iamAdmin.createRole({ ...form, description: form.description || null }),
              'Rol creado.',
            );
            if (r) setForm(empty);
          }}
        >
          Crear rol
        </Button>
        <StatusLine status={a.status} />
      </div>
    </Card>
  );
}

function RoleDetail({ role, options }: { role: Role; options: PermissionOption[] }) {
  const { can } = useAdminSession();
  const [confirm, dialog] = useConfirm();
  const [form, setForm] = useState({ name: role.name, description: role.description ?? '' });
  const [permissions, setPermissions] = useState(role.permissions);
  const a = useAction([KEYS.roles]);
  const manage = can('roles.manage');
  // Sin acceso al catálogo de permisos, se muestran los del rol con el nombre que trae el backend.
  const shown: PermissionOption[] = options.length
    ? options
    : role.permissions.map((code) => ({
        code,
        name: role.permission_names[code] ?? code,
        module: code.split('.')[0]!,
      }));
  const changed = JSON.stringify([...permissions].sort()) !== JSON.stringify([...role.permissions].sort());
  return (
    <Card title={role.name}>
      {dialog}
      {manage && (
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Nombre">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Descripción">
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <div className="flex items-end gap-2">
            <Button
              disabled={a.busy || (form.name === role.name && form.description === (role.description ?? ''))}
              onClick={() =>
                void a.run(
                  () =>
                    iamAdmin.updateRole(role.id, { name: form.name, description: form.description || null }),
                  'Rol actualizado.',
                )
              }
            >
              Guardar datos
            </Button>
            <Button
              onClick={() =>
                void a.run(
                  () => iamAdmin.updateRole(role.id, { is_active: !role.is_active }),
                  role.is_active
                    ? 'Rol desactivado: sus usuarios pierden estos permisos de inmediato.'
                    : 'Rol activado.',
                )
              }
            >
              {role.is_active ? 'Desactivar' : 'Activar'}
            </Button>
          </div>
        </div>
      )}
      <PermissionPicker options={shown} value={permissions} onChange={setPermissions} disabled={!manage} />
      {manage && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            disabled={a.busy || !changed}
            onClick={() =>
              void a.run(
                () => iamAdmin.setRolePermissions(role.id, permissions),
                'Permisos actualizados: aplican de inmediato a quienes tienen el rol.',
              )
            }
          >
            Guardar permisos
          </Button>
          <Button
            variant="danger"
            disabled={a.busy}
            onClick={async () => {
              if (
                await confirm(
                  `¿Eliminar el rol “${role.name}”? Quedará inactivo; no se puede si alguien lo tiene asignado.`,
                  'Eliminar',
                )
              )
                void a.run(() => iamAdmin.deleteRole(role.id), 'Rol eliminado.');
            }}
          >
            Eliminar rol
          </Button>
        </div>
      )}
      <div className="mt-2">
        <StatusLine status={a.status} />
      </div>
    </Card>
  );
}

/** Permisos agrupados por módulo, por su nombre (el código solo como dato secundario). */
export function PermissionPicker({
  options,
  value,
  onChange,
  disabled,
}: {
  options: PermissionOption[];
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  const modules = [...new Set(options.map((o) => o.module))].sort();
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-3">
      {modules.map((m) => {
        const group = options.filter((o) => o.module === m).sort((a, b) => a.name.localeCompare(b.name));
        const all = group.every((o) => value.includes(o.code));
        return (
          <fieldset key={m} className="rounded-lg border border-border-subtle p-3">
            <legend className="flex items-center gap-2 px-1 text-label-md font-semibold text-on-surface">
              {moduleLabel(m)}
              {!disabled && (
                <button
                  type="button"
                  className="text-label-sm font-normal text-secondary hover:underline"
                  onClick={() =>
                    onChange(
                      all
                        ? value.filter((c) => !group.some((o) => o.code === c))
                        : [...new Set([...value, ...group.map((o) => o.code)])],
                    )
                  }
                >
                  {all ? 'quitar todos' : 'marcar todos'}
                </button>
              )}
            </legend>
            {group.map((o) => (
              <label
                key={o.code}
                title={o.code}
                className="flex items-start gap-2 py-0.5 text-body-sm text-on-surface"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  disabled={disabled}
                  checked={value.includes(o.code)}
                  onChange={(e) =>
                    onChange(e.target.checked ? [...value, o.code] : value.filter((x) => x !== o.code))
                  }
                />
                {o.name}
              </label>
            ))}
          </fieldset>
        );
      })}
    </div>
  );
}
