import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { newsAuth } from '@/infrastructure/news/news-auth';
import { PasswordInput } from '@/presentation/components/admin/PasswordInput';
import { Icon } from '@/presentation/components/ui/Icon';
import { BASE } from '@/shared/base';
import { Button, Field, Input, ROOT, StatusLine, useAction } from './ui';

/** Vistas sin sesión: login y los enlaces de un solo uso que llegan por correo. */

// Errores con los que el backend redirige tras el login con Microsoft (?error=microsoft&code=…).
const MICROSOFT_ERRORS: Record<string, string> = {
  '401': 'No fue posible validar tu cuenta de Microsoft. Intenta de nuevo.',
  '403': 'Tu cuenta no está habilitada en la plataforma. Pide acceso a un administrador.',
  '409': 'Esa cuenta de Microsoft ya está vinculada a otro usuario.',
  '422': 'El enlace ya no es válido o expiró.',
};
const POLICY = 'Mínimo 12 caracteres; que no sea común ni contenga tu nombre o correo.';

const Panel = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-8 flex max-w-md flex-col gap-4 rounded-xl bg-surface-container-lowest p-6 border border-border-subtle">
    {children}
  </div>
);

const BackToLogin = () => (
  <Link to={ROOT} className="text-label-sm text-secondary hover:underline">
    Volver al inicio de sesión
  </Link>
);

function MicrosoftButton({
  href,
  label = 'Entrar con cuenta institucional (Microsoft)',
}: {
  href: string;
  label?: string;
}) {
  return (
    <a
      href={href}
      className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border-subtle text-label-md font-semibold text-on-surface hover:bg-surface-cream-alt"
    >
      <Icon name="domain" className="text-[20px]" />
      {label}
    </a>
  );
}

const Or = () => (
  <div className="flex items-center gap-3 text-label-sm text-neutral-muted">
    <span className="h-px flex-1 bg-border-subtle" />o con tu correo
    <span className="h-px flex-1 bg-border-subtle" />
  </div>
);

/** Logo de Microsoft (cuatro cuadros), como pide la guía de marca para "Iniciar sesión con Microsoft". */
const MicrosoftLogo = () => (
  <svg aria-hidden="true" viewBox="0 0 21 21" className="h-5 w-5 shrink-0">
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
);

/**
 * Inicio de sesión del panel: a la izquierda la identidad del módulo; a la derecha el acceso.
 * Microsoft (cuenta institucional) va primero; si el backend aún no lo tiene configurado, el botón se
 * muestra deshabilitado con el motivo, en vez de desaparecer.
 */
export function LoginForm({
  microsoft,
  pending,
  error,
  onSubmit,
}: {
  microsoft: boolean;
  pending: boolean;
  error?: string;
  onSubmit: (email: string, password: string) => void;
}) {
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const redirected = params.get('error')
    ? (MICROSOFT_ERRORS[params.get('code') ?? ''] ?? 'No se pudo iniciar sesión con Microsoft.')
    : undefined;
  const message = error ?? redirected;
  const field =
    'h-12 w-full rounded-xl border border-border-subtle bg-surface-container-lowest pl-11 pr-3 text-body-sm text-on-surface placeholder:text-neutral-muted focus:border-secondary focus:ring-2 focus:ring-secondary/30 focus:outline-none';

  return (
    <div className="mx-auto mt-2 grid w-full max-w-5xl overflow-hidden rounded-3xl bg-surface-container-lowest shadow-xl ring-1 ring-border-subtle lg:grid-cols-2">
      {/* Identidad */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-surface-dark-forest p-10 text-white lg:flex">
        <img
          src={`${BASE}/assets/home/hero.jpg`}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-luminosity"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-primary/90 via-surface-dark-forest/85 to-primary-container/70"
        />
        <img
          src={`${BASE}/assets/unisimon-logo.png`}
          alt="Universidad Simón Bolívar"
          className="relative h-8 w-auto self-start brightness-0 invert"
        />
        <div className="relative">
          <p className="flex items-center gap-2 text-label-sm font-semibold tracking-widest uppercase text-secondary-fixed">
            <Icon name="science" className="text-[16px]" /> Divulgación científica
          </p>
          <p className="mt-3 text-4xl leading-tight font-extrabold">Noticias científicas</p>
          <span aria-hidden="true" className="mt-5 block h-1 w-12 rounded-full bg-secondary-fixed" />
          <p className="mt-5 max-w-sm text-body-md text-white/75">
            Comparte los avances, hallazgos y logros de investigación de la universidad.
          </p>
        </div>
        <p className="relative text-label-sm text-white/50">
          © {new Date().getFullYear()} Universidad Simón Bolívar
        </p>
      </div>

      {/* Acceso */}
      <div className="flex flex-col justify-center gap-6 p-6 sm:p-10">
        <div>
          <h1 className="text-headline-lg-mobile font-extrabold text-on-surface">Inicia sesión</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">Accede con tu cuenta institucional.</p>
        </div>

        {microsoft ? (
          <a
            href={newsAuth.microsoftLoginUrl(`${BASE}${ROOT}`)}
            className="flex h-12 items-center justify-center gap-3 rounded-xl border border-[#8c8c8c] bg-white text-body-sm font-semibold text-[#5e5e5e] transition-colors hover:bg-[#f3f3f3]"
          >
            <MicrosoftLogo /> Iniciar sesión con Microsoft
          </a>
        ) : (
          <div>
            <button
              type="button"
              disabled
              aria-describedby="microsoft-off"
              className="flex h-12 w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl border border-border-subtle bg-surface-cream-alt/40 text-body-sm font-semibold text-neutral-muted"
            >
              <span className="opacity-50">
                <MicrosoftLogo />
              </span>{' '}
              Iniciar sesión con Microsoft
            </button>
            <p id="microsoft-off" className="mt-1.5 text-label-sm text-neutral-muted">
              Aún no está habilitado.
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 text-label-sm text-neutral-muted">
          <span className="h-px flex-1 bg-border-subtle" />o con tu correo
          <span className="h-px flex-1 bg-border-subtle" />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(email.trim(), password);
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-email" className="text-label-md font-semibold text-on-surface">
              Correo institucional
            </label>
            <div className="relative">
              <Icon
                name="mail"
                className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[20px] text-neutral-muted"
              />
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                required
                placeholder="nombre@unisimon.edu.co"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={field}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="text-label-md font-semibold text-on-surface">
                Contraseña
              </label>
              <Link
                to={`${ROOT}/olvide`}
                className="text-label-sm font-semibold text-secondary hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <div className="relative">
              <Icon
                name="lock"
                className="pointer-events-none absolute top-1/2 left-4 z-10 -translate-y-1/2 text-[20px] text-neutral-muted"
              />
              <PasswordInput
                id="login-password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={field}
              />
            </div>
          </div>
          {message && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-error-container px-3 py-2.5 text-label-md text-error"
            >
              <Icon name="error" className="text-[18px]" />
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={pending || !email.trim() || !password}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary-container text-body-sm font-bold text-on-primary shadow-lg shadow-primary-container/20 transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {pending ? 'Ingresando…' : 'Ingresar'}
            {!pending && <Icon name="arrow_forward" className="text-[18px]" />}
          </button>
        </form>
        <p className="flex items-center justify-center gap-1.5 border-t border-border-subtle pt-5 text-label-sm text-neutral-muted">
          <Icon name="lock" className="text-[16px]" /> Acceso exclusivo para personal autorizado
        </p>
      </div>
    </div>
  );
}

export function ForgotView() {
  const [email, setEmail] = useState('');
  const a = useAction();
  return (
    <Panel>
      <p className="text-body-sm text-neutral-muted">
        Te enviaremos un enlace de un solo uso para definir una nueva contraseña.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void a.run(
            () => newsAuth.forgotPassword(email.trim()),
            'Si la cuenta existe, enviamos un enlace a ese correo.',
          );
        }}
        className="flex flex-col gap-3"
      >
        <Field label="Correo">
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <StatusLine status={a.status} />
        <Button type="submit" variant="primary" disabled={a.busy || !email.trim()}>
          Enviar enlace
        </Button>
      </form>
      <BackToLogin />
    </Panel>
  );
}

/** Formulario de contraseña nueva para los enlaces de restablecer y de invitación. */
function NewPasswordForm({
  submitLabel,
  onSubmit,
  done,
}: {
  submitLabel: string;
  onSubmit: (password: string) => Promise<unknown>;
  done: string;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const a = useAction();
  if (a.status.kind === 'ok')
    return (
      <>
        <p role="status" className="text-body-md text-secondary">
          {done}
        </p>
        <BackToLogin />
      </>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void a.run(() => onSubmit(password));
      }}
      className="flex flex-col gap-3"
    >
      <Field label="Nueva contraseña" hint={POLICY}>
        <PasswordInput
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Field label="Confirmar contraseña">
        <PasswordInput
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>
      {confirm && confirm !== password && (
        <p className="text-label-sm text-error">Las contraseñas no coinciden.</p>
      )}
      <StatusLine status={a.status} />
      <Button type="submit" variant="primary" disabled={a.busy || !password || password !== confirm}>
        {submitLabel}
      </Button>
    </form>
  );
}

const useToken = () => useSearchParams()[0].get('token') ?? '';

export function ResetView() {
  const token = useToken();
  return (
    <Panel>
      <p className="text-body-sm text-neutral-muted">
        Define tu nueva contraseña. Al guardarla se cerrarán tus sesiones abiertas.
      </p>
      <NewPasswordForm
        submitLabel="Guardar contraseña"
        done="Contraseña actualizada. Ya puedes iniciar sesión."
        onSubmit={(p) => newsAuth.resetPassword(token, p)}
      />
    </Panel>
  );
}

export function AcceptInvitationView({ microsoft }: { microsoft: boolean }) {
  const token = useToken();
  return (
    <Panel>
      <p className="text-body-sm text-neutral-muted">
        Activa tu cuenta definiendo una contraseña
        {microsoft ? ' o entrando con tu cuenta institucional de Microsoft' : ''}.
      </p>
      <NewPasswordForm
        submitLabel="Activar cuenta"
        done="Cuenta activada. Ya puedes iniciar sesión."
        onSubmit={(p) => newsAuth.acceptInvitation(token, p)}
      />
      {microsoft && (
        <>
          <Or />
          <MicrosoftButton
            label="Activar con Microsoft"
            href={newsAuth.microsoftLoginUrl(`${BASE}${ROOT}`, { invitation: token })}
          />
        </>
      )}
    </Panel>
  );
}

export function VerifyEmailView() {
  const token = useToken();
  const a = useAction();
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !token) return; // un solo intento: el enlace es de un solo uso
    sent.current = true;
    void a.run(() => newsAuth.verifyEmail(token), 'Correo verificado.');
  }, [token, a]);
  return (
    <Panel>
      {a.busy ? (
        <p role="status" className="text-body-md text-neutral-muted">
          Verificando…
        </p>
      ) : (
        <StatusLine status={a.status} />
      )}
      {!token && <p className="text-body-md text-error">El enlace no tiene token.</p>}
      <BackToLogin />
    </Panel>
  );
}

export function LinkMicrosoftView({ microsoft }: { microsoft: boolean }) {
  const token = useToken();
  return (
    <Panel>
      <p className="text-body-sm text-neutral-muted">
        Un administrador pidió vincular tu cuenta institucional de Microsoft. Entra con ella para completar la
        vinculación (el enlace es de un solo uso).
      </p>
      {microsoft ? (
        <MicrosoftButton
          label="Vincular con Microsoft"
          href={newsAuth.microsoftLoginUrl(`${BASE}${ROOT}`, { link_token: token })}
        />
      ) : (
        <p className="text-body-md text-error">El inicio de sesión con Microsoft no está configurado.</p>
      )}
    </Panel>
  );
}

/** Primer ingreso (o contraseña fijada por un administrador): hay que cambiarla antes de usar el panel. */
export function FirstPasswordView({ onDone, onLogout }: { onDone: () => void; onLogout: () => void }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const a = useAction();
  const mismatch = !!form.confirm && form.next !== form.confirm;
  return (
    <div className="mx-auto mt-2 flex w-full max-w-md flex-col gap-5 rounded-3xl bg-surface-container-lowest p-6 shadow-xl ring-1 ring-border-subtle sm:p-10">
      <div>
        <h2 className="text-headline-lg-mobile font-extrabold text-on-surface">Crea tu contraseña</h2>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Estás usando una contraseña temporal. Cámbiala para continuar.
        </p>
      </div>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await a.run(() => newsAuth.changePassword(form.current, form.next));
          if (ok) onDone();
        }}
      >
        <Field label="Contraseña temporal">
          <PasswordInput
            required
            autoComplete="current-password"
            value={form.current}
            onChange={(e) => setForm({ ...form, current: e.target.value })}
          />
        </Field>
        <Field label="Nueva contraseña" hint={POLICY}>
          <PasswordInput
            required
            autoComplete="new-password"
            value={form.next}
            onChange={(e) => setForm({ ...form, next: e.target.value })}
          />
        </Field>
        <Field label="Confirmar nueva contraseña">
          <PasswordInput
            required
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </Field>
        {mismatch && <p className="text-label-sm text-error">Las contraseñas no coinciden.</p>}
        <StatusLine status={a.status} />
        <Button type="submit" variant="primary" disabled={a.busy || !form.current || !form.next || mismatch}>
          Guardar y continuar
        </Button>
      </form>
      <button type="button" onClick={onLogout} className="text-label-sm text-secondary hover:underline">
        Cerrar sesión
      </button>
    </div>
  );
}
