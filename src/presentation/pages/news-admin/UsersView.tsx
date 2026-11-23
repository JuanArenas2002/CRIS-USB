import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { iamAdmin } from '@/infrastructure/news/iam-admin-api';
import { Drawer } from '@/presentation/components/admin/Drawer';
import { PasswordInput } from '@/presentation/components/admin/PasswordInput';
import { Icon } from '@/presentation/components/ui/Icon';
import { methodLabel, userStatusLabel } from './labels';
import { KEYS } from './queries';
import {
  Badge,
  Button,
  ErrorLine,
  Field,
  Input,
  Loading,
  PageHeader,
  Pager,
  ROOT,
  STATUS_TONE,
  Select,
  StatusLine,
  fmtDate,
  useAction,
  useAdminSession,
} from './ui';

const LIMIT = 20;
const STATUSES = [
  { value: 'active', label: 'Activo' },
  { value: 'invited', label: 'Invitado' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'blocked', label: 'Bloqueado' },
];
const ACCOUNT_TYPES = [
  { value: 'institutional', label: 'Institucional' },
  { value: 'external', label: 'Externo' },
];

export function UsersView() {
  const { can } = useAdminSession();
  const [f, setF] = useState({ q: '', status: '', role: '', sort: 'created_at', order: 'desc', offset: 0 });
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, offset: 0, ...patch }));
  const roles = useQuery({
    queryKey: KEYS.roles,
    queryFn: () => iamAdmin.listRoles(),
    enabled: can('roles.view'),
  });
  const users = useQuery({
    queryKey: [...KEYS.users, f],
    queryFn: () => iamAdmin.users({ ...f, limit: LIMIT }),
    placeholderData: keepPreviousData,
    enabled: can('users.view'),
  });
  const [creating, setCreating] = useState(false);
  if (!can('users.view')) return <ErrorLine error={new Error('Requiere el permiso users.view.')} />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuarios"
        description="Cuentas con acceso al panel. Los roles y su alcance definen qué puede hacer cada persona."
        actions={
          can('users.create') && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="add" className="text-[20px]" /> Crear usuario
              </span>
            </Button>
          )
        }
      />
      <Drawer
        open={creating}
        onClose={() => setCreating(false)}
        title="Crear usuario"
        subtitle="Comparte el correo y la contraseña temporal con la persona: al entrar por primera vez deberá cambiarla."
      >
        <CreateUserForm />
      </Drawer>

      <section
        aria-label="Listado de usuarios"
        className="rounded-xl border border-border-subtle bg-surface-container-lowest"
      >
        <div className="grid gap-3 border-b border-border-subtle p-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
          <div className="sm:col-span-2 lg:col-span-4 2xl:col-span-1">
            <Field label="Buscar">
              <Input value={f.q} placeholder="Nombre o correo" onChange={(e) => set({ q: e.target.value })} />
            </Field>
          </div>
          <Field label="Estado">
            <Select
              empty="Todos"
              value={f.status}
              options={STATUSES}
              onChange={(e) => set({ status: e.target.value })}
            />
          </Field>
          <Field label="Rol">
            <Select
              empty="Todos"
              value={f.role}
              onChange={(e) => set({ role: e.target.value })}
              options={(roles.data?.items ?? []).map((r) => ({ value: r.code, label: r.name }))}
            />
          </Field>
          <Field label="Ordenar por">
            <Select
              value={f.sort}
              onChange={(e) => set({ sort: e.target.value })}
              options={[
                { value: 'created_at', label: 'Creación' },
                { value: 'last_login_at', label: 'Último ingreso' },
                { value: 'email', label: 'Correo' },
                { value: 'last_name', label: 'Apellido' },
              ]}
            />
          </Field>
          <Field label="Orden">
            <Select
              value={f.order}
              onChange={(e) => set({ order: e.target.value })}
              options={[
                { value: 'desc', label: 'Descendente' },
                { value: 'asc', label: 'Ascendente' },
              ]}
            />
          </Field>
        </div>
        <div>
          {users.isPending ? (
            <div className="p-6">
              <Loading />
            </div>
          ) : users.isError ? (
            <div className="p-6">
              <ErrorLine error={users.error} />
            </div>
          ) : !users.data.items.length ? (
            <p className="px-6 py-12 text-center text-body-md text-neutral-muted">
              Ningún usuario coincide con los filtros.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-body-sm">
                  <thead className="bg-canvas-cream text-label-sm font-semibold tracking-wide text-neutral-muted uppercase">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        Nombre
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Correo
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Estado
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Acceso
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Último ingreso
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {users.data.items.map((u) => (
                      <tr key={u.id} className="transition-colors hover:bg-canvas-cream">
                        <td className="px-4 py-3">
                          <Link
                            to={`${ROOT}/usuarios/${u.id}`}
                            className="font-semibold whitespace-nowrap text-primary hover:underline"
                          >
                            {u.first_name} {u.last_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant">{u.email}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge tone={STATUS_TONE[u.status]}>{userStatusLabel(u.status)}</Badge>
                          {u.must_change_password && (
                            <span className="ml-2 text-label-sm text-neutral-muted">clave temporal</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant">
                          {u.auth_methods.map(methodLabel).join(' · ') || '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-on-surface-variant">
                          {fmtDate(u.last_login_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-border-subtle px-4 py-3">
                <p className="text-label-sm text-neutral-muted">
                  {users.data.total} {users.data.total === 1 ? 'usuario' : 'usuarios'}
                </p>
                <Pager
                  total={users.data.total}
                  limit={LIMIT}
                  offset={f.offset}
                  onChange={(offset) => setF((x) => ({ ...x, offset }))}
                />
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/** Contraseña temporal aleatoria (sin caracteres que se confunden al dictarla). */
export function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const s = Array.from(bytes, (b) => chars[b % chars.length]).join('');
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

/** Campo de contraseña temporal con botón para generar una. */
export function TempPasswordField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Contraseña temporal" hint="Mínimo 12 caracteres. Deberá cambiarla al entrar.">
      <span className="flex gap-2">
        <span className="flex-1">
          <PasswordInput
            required
            autoComplete="new-password"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </span>
        <Button type="button" onClick={() => onChange(generatePassword())}>
          Generar
        </Button>
      </span>
    </Field>
  );
}

function CreateUserForm() {
  const empty = { email: '', first_name: '', last_name: '', account_type: 'institutional', password: '' };
  const [form, setForm] = useState(empty);
  const a = useAction([KEYS.users]);
  return (
    <section aria-label="Crear usuario">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await a.run(
            () => iamAdmin.createUser(form),
            `Usuario creado. Contraseña temporal: ${form.password}`,
          );
          if (ok) setForm(empty);
        }}
      >
        <Field label="Correo">
          <Input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            <Input
              required
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            />
          </Field>
          <Field label="Apellido">
            <Input
              required
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Tipo de cuenta">
          <Select
            value={form.account_type}
            options={ACCOUNT_TYPES}
            onChange={(e) => setForm({ ...form, account_type: e.target.value })}
          />
        </Field>
        <TempPasswordField value={form.password} onChange={(password) => setForm({ ...form, password })} />
        <StatusLine status={a.status} />
        <div className="flex justify-end border-t border-border-subtle pt-4">
          <Button type="submit" variant="primary" disabled={a.busy}>
            Crear usuario
          </Button>
        </div>
      </form>
    </section>
  );
}

export { ACCOUNT_TYPES };
