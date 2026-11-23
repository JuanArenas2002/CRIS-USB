import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { iamAdmin } from '@/infrastructure/news/iam-admin-api';
import { newsAuth } from '@/infrastructure/news/news-auth';
import { PasswordInput } from '@/presentation/components/admin/PasswordInput';
import { BASE } from '@/shared/base';
import { useNewsSession } from '@/presentation/hooks/use-news-session';
import { methodLabel } from './labels';
import { useOrg } from './queries';
import {
  Badge,
  Button,
  Card,
  ErrorLine,
  Field,
  Loading,
  ROOT,
  StatusLine,
  fmtDate,
  useAction,
  useAdminSession,
  PageHeader,
} from './ui';

/** Autoservicio: contraseña, sesiones propias, vincular Microsoft y mis permisos. */
export function AccountView() {
  const { user, permissions } = useAdminSession();
  const { providers } = useNewsSession();
  const { scopeName } = useOrg();
  const linkedMicrosoft = user.auth_methods.includes('microsoft');
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Mi cuenta" description={`${user.first_name} ${user.last_name} · ${user.email}`} />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Acceso">
            <p className="text-label-sm text-neutral-muted">
              Métodos de acceso: {user.auth_methods.map(methodLabel).join(' · ') || 'ninguno'} · sesión actual
              con {methodLabel(user.session?.method).toLowerCase()}, expira{' '}
              {fmtDate(user.session?.expires_at)}
            </p>
            {providers.data?.microsoft && !linkedMicrosoft && (
              <a
                href={newsAuth.microsoftLoginUrl(`${BASE}${ROOT}/mi-cuenta`, { link: true })}
                className="mt-3 inline-flex h-10 items-center rounded-lg border border-border-subtle px-4 text-label-md font-semibold text-on-surface hover:bg-surface-cream-alt"
              >
                Vincular mi cuenta de Microsoft
              </a>
            )}
          </Card>
          {user.auth_methods.includes('password') && <ChangePasswordCard />}
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <MySessionsCard userId={user.id} currentId={user.session?.id} />
          <Card title="Mis permisos">
            {!permissions.grants.length ? (
              <p className="text-body-sm text-neutral-muted">Sin permisos asignados.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-body-sm">
                {permissions.grants.map((g, i) => (
                  <li key={i}>
                    <span className="font-semibold">{g.permission_name}</span> ·{' '}
                    <span className="text-on-surface-variant">{scopeName(g.scope_type, g.scope_id)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordCard() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const a = useAction();
  return (
    <Card title="Cambiar contraseña">
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await a.run(
            () => newsAuth.changePassword(form.current, form.next),
            'Contraseña actualizada; tus otras sesiones se cerraron.',
          );
          if (ok) setForm({ current: '', next: '', confirm: '' });
        }}
      >
        <Field label="Contraseña actual">
          <PasswordInput
            autoComplete="current-password"
            value={form.current}
            onChange={(e) => setForm({ ...form, current: e.target.value })}
          />
        </Field>
        <Field label="Nueva contraseña" hint="Mínimo 12 caracteres">
          <PasswordInput
            autoComplete="new-password"
            value={form.next}
            onChange={(e) => setForm({ ...form, next: e.target.value })}
          />
        </Field>
        <Field label="Confirmar nueva">
          <PasswordInput
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </Field>
        <div className="flex items-center justify-end gap-3">
          <Button
            type="submit"
            variant="primary"
            disabled={a.busy || !form.current || !form.next || form.next !== form.confirm}
          >
            Cambiar contraseña
          </Button>
          {form.confirm && form.next !== form.confirm && (
            <span className="text-label-sm text-error">No coinciden.</span>
          )}
          <StatusLine status={a.status} />
        </div>
      </form>
    </Card>
  );
}

function MySessionsCard({ userId, currentId }: { userId: number; currentId?: number }) {
  const key = ['news-admin', 'my-sessions'];
  const sessions = useQuery({ queryKey: key, queryFn: () => iamAdmin.sessions(userId) });
  const a = useAction([key]);
  return (
    <Card title="Mis sesiones activas">
      {sessions.isPending ? (
        <Loading />
      ) : sessions.isError ? (
        <ErrorLine error={sessions.error} />
      ) : (
        <ul className="flex flex-col gap-2 text-body-sm">
          {sessions.data.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2">
              <Badge tone={s.id === currentId ? 'ok' : 'neutral'}>
                {s.id === currentId ? 'Esta sesión' : methodLabel(s.method)}
              </Badge>
              <span>
                {s.ip ?? '—'} · desde {fmtDate(s.created_at)}
              </span>
              <span className="max-w-xs truncate text-label-sm text-neutral-muted" title={s.user_agent ?? ''}>
                {s.user_agent}
              </span>
              {s.id !== currentId && (
                <Button
                  variant="danger"
                  className="h-8 px-3"
                  onClick={() => void a.run(() => iamAdmin.revokeSession(userId, s.id), 'Sesión cerrada.')}
                >
                  Cerrar
                </Button>
              )}
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
