import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { iamAdmin, type AdminUser } from '@/infrastructure/news/iam-admin-api';
import { useConfirm } from '@/presentation/components/admin/ConfirmDialog';
import { auditEventLabel, methodLabel, resultLabel, userStatusLabel } from './labels';
import { KEYS, useCatalogs, useOrg } from './queries';
import { ACCOUNT_TYPES, TempPasswordField } from './UsersView';
import {
  Badge,
  Button,
  Card,
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

export function UserDetailView() {
  const id = Number(useParams().userId);
  const user = useQuery({ queryKey: [...KEYS.users, id], queryFn: () => iamAdmin.user(id), enabled: !!id });
  if (user.isPending) return <Loading />;
  if (user.isError) return <ErrorLine error={user.error} />;
  return <UserDetail user={user.data} />;
}

function UserDetail({ user }: { user: AdminUser }) {
  const { can, user: me } = useAdminSession();
  const self = me.id === user.id;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumbs={[{ label: 'Usuarios', to: `${ROOT}/usuarios` }]}
        title={`${user.first_name} ${user.last_name}`}
        description={user.email}
        meta={
          <>
            <Badge tone={STATUS_TONE[user.status]}>{userStatusLabel(user.status)}</Badge>
            {!user.email_verified && <Badge tone="warn">correo sin verificar</Badge>}
            {user.must_change_password && <Badge tone="warn">contraseña temporal</Badge>}
            {user.locked_until && (
              <Badge tone="error">bloqueo temporal hasta {fmtDate(user.locked_until)}</Badge>
            )}
          </>
        }
      />
      {/* Izquierda: datos y accesos del usuario. Derecha: acciones sobre la cuenta. */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {can('users.update') && !self && <EditCard user={user} />}
          <RolesCard user={user} />
          <PermissionsCard userId={user.id} />
          {can('audit.view') && <ActivityCard userId={user.id} />}
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          {!self && <StatusCard user={user} />}
          {!self && can('users.update') && ['active', 'invited'].includes(user.status) && (
            <PasswordCard user={user} />
          )}
          {(self || can('users.manage_sessions')) && <SessionsCard userId={user.id} />}
          <IdentitiesCard user={user} />
        </div>
      </div>
    </div>
  );
}

function EditCard({ user }: { user: AdminUser }) {
  const [form, setForm] = useState({
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    account_type: user.account_type,
  });
  const a = useAction([KEYS.users]);
  const changed = Object.fromEntries(
    Object.entries(form).filter(([k, v]) => v !== (user as unknown as Record<string, string>)[k]),
  );
  return (
    <Card title="Datos de la cuenta">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre">
          <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
        </Field>
        <Field label="Apellido">
          <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
        </Field>
        <Field label="Correo" hint="Es el usuario con el que inicia sesión">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Tipo de cuenta">
          <Select
            value={form.account_type}
            options={ACCOUNT_TYPES}
            onChange={(e) => setForm({ ...form, account_type: e.target.value })}
          />
        </Field>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button
          variant="primary"
          disabled={a.busy || !Object.keys(changed).length}
          onClick={() => void a.run(() => iamAdmin.updateUser(user.id, changed), 'Datos actualizados.')}
        >
          Guardar
        </Button>
        <StatusLine status={a.status} />
      </div>
      <p className="mt-2 text-label-sm text-neutral-muted">
        Creado {fmtDate(user.created_at)} · último ingreso {fmtDate(user.last_login_at)}
      </p>
    </Card>
  );
}

function StatusCard({ user }: { user: AdminUser }) {
  const { can } = useAdminSession();
  const navigate = useNavigate();
  const [confirm, dialog] = useConfirm();
  const [reason, setReason] = useState('');
  const a = useAction([KEYS.users]);
  const s = user.status;
  const status = (action: 'activate' | 'deactivate' | 'block' | 'unblock', ok: string) =>
    void a.run(() => iamAdmin.userStatus(user.id, action, reason), ok);
  if (!can('users.update') && !can('users.delete') && !can('users.create')) return null;
  return (
    <Card title="Estado y acceso">
      {dialog}
      <Field label="Motivo (opcional)" hint="Queda registrado en la auditoría.">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div className="mt-4 flex flex-wrap gap-2">
        {can('users.update') && s === 'inactive' && (
          <Button onClick={() => status('activate', 'Cuenta activada.')}>Activar</Button>
        )}
        {can('users.update') && ['active', 'invited', 'blocked'].includes(s) && (
          <Button onClick={() => status('deactivate', 'Cuenta desactivada; sus sesiones se cerraron.')}>
            Desactivar
          </Button>
        )}
        {can('users.update') && s !== 'blocked' && (
          <Button
            variant="danger"
            onClick={() => status('block', 'Cuenta bloqueada; sus sesiones se cerraron.')}
          >
            Bloquear
          </Button>
        )}
        {can('users.update') && s === 'blocked' && (
          <Button onClick={() => status('unblock', 'Cuenta desbloqueada.')}>Desbloquear</Button>
        )}
        {can('users.update') && user.locked_until && (
          <Button onClick={() => void a.run(() => iamAdmin.unlock(user.id), 'Bloqueo temporal retirado.')}>
            Quitar bloqueo temporal
          </Button>
        )}
        {can('users.delete') && (
          <Button
            variant="danger"
            onClick={async () => {
              const message = `¿Eliminar a ${user.email}? Se revocan sus sesiones y roles; el registro se conserva para auditoría.`;
              if (!(await confirm(message, 'Eliminar'))) return;
              const ok = await a.run(() => iamAdmin.deleteUser(user.id), 'Usuario eliminado.');
              if (ok !== undefined) navigate(`${ROOT}/usuarios`);
            }}
          >
            Eliminar
          </Button>
        )}
      </div>
      <div className="mt-3">
        <StatusLine status={a.status} />
      </div>
    </Card>
  );
}

/** Olvido de contraseña: el administrador fija una temporal; se cierran sus sesiones y deberá cambiarla. */
function PasswordCard({ user }: { user: AdminUser }) {
  const [password, setPassword] = useState('');
  const a = useAction([KEYS.users]);
  return (
    <Card title="Restablecer contraseña">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await a.run(
            () => iamAdmin.setPassword(user.id, password),
            `Contraseña temporal fijada: ${password}. Sus sesiones se cerraron.`,
          );
          if (ok) setPassword('');
        }}
      >
        <TempPasswordField value={password} onChange={setPassword} />
        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={a.busy || !password}>
            Fijar contraseña
          </Button>
        </div>
      </form>
      <div className="mt-2">
        <StatusLine status={a.status} />
      </div>
    </Card>
  );
}

function RolesCard({ user }: { user: AdminUser }) {
  const { can } = useAdminSession();
  const catalogs = useCatalogs();
  const { units, scopeName } = useOrg();
  const [history, setHistory] = useState(false);
  const key = [...KEYS.users, user.id, 'roles', history];
  const assignments = useQuery({
    queryKey: key,
    queryFn: () => (history ? iamAdmin.roleHistory : iamAdmin.roles)(user.id),
  });
  const roles = useQuery({ queryKey: KEYS.roles, queryFn: () => iamAdmin.listRoles({ is_active: true }) });
  const [form, setForm] = useState({ role: '', scope_type: '', scope_id: '' });
  const a = useAction([[...KEYS.users, user.id]]);
  const institutional = !form.scope_type || form.scope_type === 'institution';
  const scopeUnits = units[form.scope_type];
  return (
    <Card
      title="Roles asignados"
      actions={
        <label className="flex items-center gap-2 text-label-sm text-on-surface">
          <input type="checkbox" checked={history} onChange={(e) => setHistory(e.target.checked)} /> Ver
          historial (incluye revocadas)
        </label>
      }
    >
      {assignments.isPending ? (
        <Loading />
      ) : assignments.isError ? (
        <ErrorLine error={assignments.error} />
      ) : (
        <ul className="flex flex-col gap-2 text-body-sm">
          {!assignments.data.length && <li className="text-neutral-muted">Sin roles.</li>}
          {assignments.data.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2">
              <Badge tone={r.is_active ? 'ok' : 'neutral'}>{r.role_name}</Badge>
              <span>{scopeName(r.scope_type, r.scope_id)}</span>
              <span className="text-label-sm text-neutral-muted">
                asignado {fmtDate(r.assigned_at)}
                {r.assigned_by ? ` por #${r.assigned_by}` : ''}
                {r.revoked_at &&
                  ` · revocado ${fmtDate(r.revoked_at)} por #${r.revoked_by}${r.revoke_reason ? ` (${r.revoke_reason})` : ''}`}
              </span>
              {r.is_active && can('users.manage_roles') && (
                <Button
                  variant="danger"
                  className="h-8 px-3"
                  onClick={() =>
                    void a.run(() => iamAdmin.revokeRole(user.id, r.id), 'Rol revocado (efecto inmediato).')
                  }
                >
                  Revocar
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {can('users.manage_roles') && (
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border-subtle pt-4">
          <Field label="Rol">
            <Select
              empty="Elige"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              options={(roles.data?.items ?? []).map((r) => ({ value: r.code, label: r.name }))}
            />
          </Field>
          <Field label="Alcance">
            <Select
              empty="Institucional (todas)"
              value={form.scope_type}
              onChange={(e) => setForm({ ...form, scope_type: e.target.value, scope_id: '' })}
              options={(catalogs.data?.scope_types ?? [])
                .filter((t) => t.code !== 'institution')
                .map((t) => ({ value: t.code, label: t.name }))}
            />
          </Field>
          {!institutional && (
            <Field label="Dependencia">
              {scopeUnits ? (
                <Select
                  empty="Elige"
                  value={form.scope_id}
                  onChange={(e) => setForm({ ...form, scope_id: e.target.value })}
                  options={scopeUnits.map((u) => ({ value: u.id, label: u.name }))}
                />
              ) : (
                <Input
                  type="number"
                  min={1}
                  placeholder="Id"
                  value={form.scope_id}
                  onChange={(e) => setForm({ ...form, scope_id: e.target.value })}
                />
              )}
            </Field>
          )}
          <Button
            variant="primary"
            disabled={a.busy || !form.role || (!institutional && !Number(form.scope_id))}
            onClick={() =>
              void a.run(
                () =>
                  iamAdmin.assignRole(user.id, {
                    role: form.role,
                    scope_type: institutional ? null : form.scope_type,
                    scope_id: institutional ? null : Number(form.scope_id),
                  }),
                'Rol asignado.',
              )
            }
          >
            Asignar
          </Button>
          <p className="w-full text-label-sm text-neutral-muted">
            Solo puedes asignar roles cuyos permisos ya tienes en ese mismo alcance. Una facultad incluye sus
            programas.
          </p>
        </div>
      )}
      <div className="mt-3">
        <StatusLine status={a.status} />
      </div>
    </Card>
  );
}

function PermissionsCard({ userId }: { userId: number }) {
  const { scopeName } = useOrg();
  const perms = useQuery({
    queryKey: [...KEYS.users, userId, 'permissions'],
    queryFn: () => iamAdmin.userPermissions(userId),
  });
  return (
    <Card title="Permisos efectivos">
      {perms.isPending ? (
        <Loading />
      ) : perms.isError ? (
        <ErrorLine error={perms.error} />
      ) : !perms.data.grants.length ? (
        <p className="text-body-sm text-neutral-muted">Sin permisos.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-body-sm">
          {perms.data.grants.map((g, i) => (
            <li key={i}>
              <span className="font-semibold">{g.permission_name}</span> ·{' '}
              <span className="text-on-surface-variant">{scopeName(g.scope_type, g.scope_id)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function SessionsCard({ userId }: { userId: number }) {
  const sessions = useQuery({
    queryKey: [...KEYS.users, userId, 'sessions'],
    queryFn: () => iamAdmin.sessions(userId),
  });
  const a = useAction([[...KEYS.users, userId, 'sessions']]);
  return (
    <Card title="Sesiones activas">
      {sessions.isPending ? (
        <Loading />
      ) : sessions.isError ? (
        <ErrorLine error={sessions.error} />
      ) : (
        <ul className="flex flex-col gap-2 text-body-sm">
          {!sessions.data.length && <li className="text-neutral-muted">Sin sesiones activas.</li>}
          {sessions.data.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2">
              <Badge>{methodLabel(s.method)}</Badge>
              <span>
                {s.ip ?? 'IP desconocida'} · desde {fmtDate(s.created_at)} · visto {fmtDate(s.last_seen_at)}
              </span>
              <span className="max-w-xs truncate text-label-sm text-neutral-muted" title={s.user_agent ?? ''}>
                {s.user_agent}
              </span>
              <Button
                variant="danger"
                className="h-8 px-3"
                onClick={() => void a.run(() => iamAdmin.revokeSession(userId, s.id), 'Sesión cerrada.')}
              >
                Cerrar
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2">
        <StatusLine status={a.status} />
      </div>
    </Card>
  );
}

function IdentitiesCard({ user }: { user: AdminUser }) {
  const { can } = useAdminSession();
  const a = useAction([[...KEYS.users, user.id]]);
  return (
    <Card
      title="Métodos de acceso"
      actions={
        can('users.update') && (
          <Button
            onClick={() =>
              void a.run(
                () => iamAdmin.requestMicrosoftLink(user.id),
                'Enviamos al correo del usuario un enlace para vincular su cuenta de Microsoft.',
              )
            }
          >
            Pedir vinculación con Microsoft
          </Button>
        )
      }
    >
      <p className="mb-2 text-body-sm">
        Métodos: {user.auth_methods.map(methodLabel).join(' · ') || 'ninguno'}
      </p>
      <ul className="flex flex-col gap-2 text-body-sm">
        {user.linked_identities.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-2">
            <Badge>{methodLabel(i.provider)}</Badge>
            <span>
              {i.email_at_link ?? '—'} · tenant {i.tenant_id} · vinculada {fmtDate(i.linked_at)} · último uso{' '}
              {fmtDate(i.last_used_at)}
            </span>
            {can('users.update') && (
              <Button
                variant="danger"
                className="h-8 px-3"
                onClick={() =>
                  void a.run(
                    () => iamAdmin.unlinkIdentity(user.id, i.id),
                    'Identidad desvinculada; sus sesiones se cerraron.',
                  )
                }
              >
                Desvincular
              </Button>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-2">
        <StatusLine status={a.status} />
      </div>
    </Card>
  );
}

function ActivityCard({ userId }: { userId: number }) {
  const [offset, setOffset] = useState(0);
  const activity = useQuery({
    queryKey: [...KEYS.audit, 'user', userId, offset],
    queryFn: () => iamAdmin.activity(userId, { limit: 10, offset }),
  });
  return (
    <Card title="Actividad del usuario">
      {activity.isPending ? (
        <Loading />
      ) : activity.isError ? (
        <ErrorLine error={activity.error} />
      ) : (
        <>
          <ul className="flex flex-col gap-1 text-body-sm">
            {activity.data.items.map((e) => (
              <li key={e.id}>
                <Badge tone={e.result === 'success' ? 'ok' : 'error'}>{resultLabel(e.result)}</Badge>{' '}
                {auditEventLabel(e.event_type)}
                {e.resource_type && (
                  <span className="text-neutral-muted">
                    {' '}
                    · {e.resource_type} {e.resource_id}
                  </span>
                )}
                <span className="text-neutral-muted"> · {fmtDate(e.at)}</span>
              </li>
            ))}
          </ul>
          <Pager total={activity.data.total} limit={10} offset={offset} onChange={setOffset} />
        </>
      )}
    </Card>
  );
}
