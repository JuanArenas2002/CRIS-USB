import { useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router';
import { BASE } from '@/shared/base';
import { Icon } from '@/presentation/components/ui/Icon';
import { errorText } from '@/infrastructure/news/news-http';
import { hasNewsAccess } from '@/infrastructure/news/news-auth';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
import { useNewsSession } from '@/presentation/hooks/use-news-session';
import { AccountView } from './news-admin/AccountView';
import { AnalyticsView, NewsAnalyticsView } from './news-admin/AnalyticsView';
import { AuditView } from './news-admin/AuditView';
import {
  AcceptInvitationView,
  FirstPasswordView,
  ForgotView,
  LinkMicrosoftView,
  LoginForm,
  ResetView,
  VerifyEmailView,
} from './news-admin/AuthViews';
import { NewsEditorView } from './news-admin/NewsEditorView';
import { NewsListView } from './news-admin/NewsListView';
import { OrganizationView } from './news-admin/OrganizationView';
import { PermissionsView } from './news-admin/PermissionsView';
import { RolesView } from './news-admin/RolesView';
import { UserDetailView } from './news-admin/UserDetailView';
import { UsersView } from './news-admin/UsersView';
import { AdminSessionContext, Button, ROOT, useAdminSession } from './news-admin/ui';

/**
 * Vista oculta (fuera del menú, noindex, bloqueada en robots.txt): panel del módulo de noticias.
 * Autenticación y permisos los decide el backend (sesión por cookie HttpOnly + CSRF; RBAC con alcance);
 * la UI solo oculta lo que el usuario no puede usar.
 */
/** Enlaces de un solo uso (llegan por correo): se ven con el título del panel, no con la pantalla de login. */
const ONE_TIME_VIEWS = [
  'olvide',
  'restablecer',
  'aceptar-invitacion',
  'verificar-correo',
  'vincular-microsoft',
];

export function AdminNewsPage() {
  useDocumentMetadata({
    title: 'Noticias',
    description: 'Administración interna de noticias institucionales.',
    path: ROOT,
    noindex: true,
  });
  const { user, permissions, providers, login, logout } = useNewsSession();
  const microsoft = !!providers.data?.microsoft;
  const { pathname } = useLocation();
  const isLoginPath = !ONE_TIME_VIEWS.some((v) => pathname.startsWith(`${ROOT}/${v}`));
  // El login trae su propia presentación; el resto de pantallas sin sesión llevan el título del panel.
  const titled = user.isPending || !!user.data || user.isError || !isLoginPath;
  const frame = (children: ReactNode) => <PublicFrame titled={titled}>{children}</PublicFrame>;

  return (
    <Routes>
      {/* Enlaces de un solo uso que llegan por correo: no requieren sesión. */}
      <Route path="olvide" element={frame(<ForgotView />)} />
      <Route path="restablecer" element={frame(<ResetView />)} />
      <Route path="aceptar-invitacion" element={frame(<AcceptInvitationView microsoft={microsoft} />)} />
      <Route path="verificar-correo" element={frame(<VerifyEmailView />)} />
      <Route path="vincular-microsoft" element={frame(<LinkMicrosoftView microsoft={microsoft} />)} />
      <Route
        path="*"
        element={
          user.data && !user.data.must_change_password && permissions.data ? (
            <AdminSessionContext.Provider value={{ user: user.data, permissions: permissions.data }}>
              <Shell onLogout={() => logout.mutate()} loggingOut={logout.isPending} />
            </AdminSessionContext.Provider>
          ) : (
            frame(
              user.isPending ? (
                <p className="text-body-md text-neutral-muted" role="status">
                  Verificando sesión…
                </p>
              ) : user.isError ? (
                <p className="text-body-md text-error" role="alert">
                  {errorText(user.error)}
                </p>
              ) : !user.data ? (
                <LoginForm
                  microsoft={microsoft}
                  pending={login.isPending}
                  error={login.isError ? errorText(login.error) : undefined}
                  onSubmit={(email, password) => login.mutate({ email, password })}
                />
              ) : user.data.must_change_password ? (
                <FirstPasswordView onDone={() => void user.refetch()} onLogout={() => logout.mutate()} />
              ) : (
                <p className="text-body-md text-neutral-muted" role="status">
                  Cargando permisos…
                </p>
              ),
            )
          )
        }
      />
    </Routes>
  );
}

/** Marca del panel: logo + nombre del producto. */
function Brand() {
  return (
    <Link to={ROOT} className="flex min-w-0 items-center gap-3">
      <img
        src={`${BASE}/assets/unisimon-logo.png`}
        alt="Universidad Simón Bolívar"
        className="h-7 w-auto shrink-0"
      />
      <span aria-hidden="true" className="hidden h-6 w-px bg-border-subtle sm:block" />
      <span className="hidden min-w-0 sm:block">
        <span className="block truncate text-label-md font-bold text-primary">Noticias científicas</span>
        <span className="block truncate text-label-sm text-neutral-muted">Panel de administración</span>
      </span>
    </Link>
  );
}

function PortalLink({ className = '' }: { className?: string }) {
  return (
    <Link
      to="/noticias"
      className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-label-md font-semibold text-on-surface-variant hover:bg-surface-cream-alt ${className}`}
    >
      <Icon name="public" className="text-[18px]" /> Ver portal
    </Link>
  );
}

/** Pantallas sin sesión (login, enlaces de un solo uso): barra simple y contenido centrado. */
function PublicFrame({ titled, children }: { titled: boolean; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas-cream">
      <header className="flex h-admin-topbar items-center justify-between gap-4 border-b border-border-subtle bg-surface-container-lowest px-4 sm:px-6">
        <Brand />
        <PortalLink />
      </header>
      <main id="contenido" className="w-full flex-1 px-4 py-8 sm:px-6 lg:py-12">
        <div className="mx-auto w-full max-w-5xl">
          {titled && (
            <h1 className="mb-6 text-title-lg font-bold tracking-tight text-on-surface">Panel de noticias</h1>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

type NavItem = { to: string; label: string; icon: string; show: boolean; end?: boolean };

/**
 * Armazón del panel (app shell, patrón de Fluent 2 / Atlassian): barra superior fija, navegación lateral
 * agrupada por módulo (fija desde 1024 px; por debajo, panel desplegable) y área de trabajo con ancho máximo.
 */
function Shell({ onLogout, loggingOut }: { onLogout: () => void; loggingOut: boolean }) {
  const { user, permissions, can } = useAdminSession();
  const [open, setOpen] = useState(false);
  const news = hasNewsAccess(permissions);
  const groups = (
    [
      {
        label: 'Contenido',
        items: [
          { to: ROOT, label: 'Noticias', icon: 'newspaper', show: news, end: true },
          {
            to: `${ROOT}/estadisticas`,
            label: 'Estadísticas',
            icon: 'insights',
            show: can('news.analytics'),
          },
          { to: `${ROOT}/dependencias`, label: 'Dependencias', icon: 'apartment', show: true },
        ],
      },
      {
        label: 'Administración',
        items: [
          { to: `${ROOT}/usuarios`, label: 'Usuarios', icon: 'group', show: can('users.view') },
          {
            to: `${ROOT}/roles`,
            label: 'Roles',
            icon: 'badge',
            show: can('roles.view') || can('users.manage_roles'),
          },
          {
            to: `${ROOT}/permisos`,
            label: 'Permisos',
            icon: 'verified_user',
            show: can('permissions.view') || can('roles.manage'),
          },
          { to: `${ROOT}/auditoria`, label: 'Auditoría', icon: 'history', show: can('audit.view') },
        ],
      },
      {
        label: 'Cuenta',
        items: [{ to: `${ROOT}/mi-cuenta`, label: 'Mi cuenta', icon: 'person', show: true }],
      },
    ] as { label: string; items: NavItem[] }[]
  )
    .map((g) => ({ ...g, items: g.items.filter((i) => i.show) }))
    .filter((g) => g.items.length);
  const initials = `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase();

  return (
    <div className="min-h-screen bg-canvas-cream">
      <a
        href="#contenido-panel"
        className="sr-only z-[60] rounded-lg bg-primary px-4 py-2 text-on-primary focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Saltar al contenido
      </a>
      <header className="fixed inset-x-0 top-0 z-40 flex h-admin-topbar print:hidden items-center gap-2 border-b border-border-subtle bg-surface-container-lowest px-2 sm:px-4 lg:px-6">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="panel-nav"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-on-surface hover:bg-surface-cream-alt lg:hidden"
        >
          <Icon name={open ? 'close' : 'menu'} className="text-[22px]" />
        </button>
        <Brand />
        <div className="ml-auto flex items-center gap-2">
          <PortalLink className="max-sm:hidden" />
          <Link
            to={`${ROOT}/mi-cuenta`}
            aria-label="Mi cuenta"
            title={`${user.first_name} ${user.last_name}`}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-label-md font-bold text-on-primary hover:bg-secondary"
          >
            {initials}
          </Link>
        </div>
      </header>

      {open && (
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 top-admin-topbar z-30 bg-surface-dark-forest/40 lg:hidden"
        />
      )}
      <aside
        id="panel-nav"
        className={`fixed top-admin-topbar bottom-0 left-0 z-30 flex w-admin-sidebar print:hidden flex-col border-r border-border-subtle bg-surface-container-lowest transition-transform duration-200 lg:visible lg:translate-x-0 ${
          open ? 'translate-x-0' : 'invisible -translate-x-full'
        }`}
      >
        <nav aria-label="Secciones del panel" className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((g) => (
            <div key={g.label} className="mb-5 last:mb-0">
              <p className="px-3 pb-1.5 text-label-sm font-bold tracking-wider text-neutral-muted uppercase">
                {g.label}
              </p>
              <ul className="flex flex-col gap-0.5">
                {g.items.map((t) => (
                  <li key={t.to}>
                    <NavLink
                      to={t.to}
                      end={t.end}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        `relative flex h-10 items-center gap-3 rounded-lg px-3 text-body-sm font-semibold transition-colors ${
                          isActive
                            ? 'bg-cta-sage text-primary before:absolute before:top-2 before:bottom-2 before:left-0 before:w-1 before:rounded-full before:bg-secondary'
                            : 'text-on-surface-variant hover:bg-surface-cream-alt hover:text-on-surface'
                        }`
                      }
                    >
                      <Icon name={t.icon} className="text-[20px]" />
                      {t.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-border-subtle p-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cta-sage text-label-md font-bold text-primary"
            >
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-label-md font-semibold text-on-surface">
                {user.first_name} {user.last_name}
              </span>
              <span className="block truncate text-label-sm text-neutral-muted">{user.email}</span>
            </span>
          </div>
          <Button onClick={onLogout} disabled={loggingOut} className="mt-3 w-full">
            {loggingOut ? 'Cerrando…' : 'Cerrar sesión'}
          </Button>
        </div>
      </aside>

      <main id="contenido-panel" tabIndex={-1} className="pt-admin-topbar lg:pl-admin-sidebar print:p-0">
        <div className="w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Routes>
            <Route index element={news ? <NewsListView /> : <NoNewsAccess />} />
            <Route path="nueva" element={news ? <NewsEditorView /> : <NoNewsAccess />} />
            <Route path=":newsId" element={news ? <NewsEditorView /> : <NoNewsAccess />} />
            <Route
              path="estadisticas"
              element={can('news.analytics') ? <AnalyticsView /> : <NoAnalyticsAccess />}
            />
            <Route
              path=":newsId/estadisticas"
              element={can('news.analytics') ? <NewsAnalyticsView /> : <NoAnalyticsAccess />}
            />
            <Route path="dependencias" element={<OrganizationView />} />
            <Route path="usuarios" element={<UsersView />} />
            <Route path="usuarios/:userId" element={<UserDetailView />} />
            <Route path="roles" element={<RolesView />} />
            <Route path="permisos" element={<PermissionsView />} />
            <Route path="auditoria" element={<AuditView />} />
            <Route path="mi-cuenta" element={<AccountView />} />
            <Route path="*" element={<Navigate to={ROOT} replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function NoAnalyticsAccess() {
  return (
    <p
      className="rounded-xl border border-border-subtle bg-surface-container-lowest p-6 text-body-md text-on-surface"
      role="alert"
    >
      Tu cuenta no tiene el permiso para ver estadísticas de noticias (news.analytics).
    </p>
  );
}

function NoNewsAccess() {
  return (
    <p
      className="rounded-xl border border-border-subtle bg-surface-container-lowest p-6 text-body-md text-on-surface"
      role="alert"
    >
      Tu cuenta no tiene permisos en el módulo de noticias. Pide a un administrador que te asigne un rol.
    </p>
  );
}
