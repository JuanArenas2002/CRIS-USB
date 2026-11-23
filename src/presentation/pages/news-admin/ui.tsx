import { createContext, useContext, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { Icon } from '@/presentation/components/ui/Icon';
import type { NewsPermissions, NewsUser } from '@/infrastructure/news/news-auth';
import { can as canDo } from '@/infrastructure/news/news-auth';
import { errorText } from '@/infrastructure/news/news-http';

/** Piezas comunes del panel de noticias (mismo lenguaje visual que las otras vistas /admin). */

export const ROOT = '/admin/noticias';

// ---------- sesión ----------
export interface AdminSession {
  user: NewsUser;
  permissions: NewsPermissions;
}
export const AdminSessionContext = createContext<AdminSession | null>(null);

export function useAdminSession() {
  const s = useContext(AdminSessionContext)!;
  return { ...s, can: (code: string) => canDo(s.permissions, code) };
}

// ---------- acciones con mensaje ----------
type Status = { kind: 'idle' | 'busy' | 'ok' | 'error'; text?: string };

/** Ejecuta una acción del backend, muestra el resultado e invalida las consultas afectadas. */
export function useAction(invalidate: QueryKey[] = []) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const m = useMutation({
    mutationFn: async ({ run }: { run: () => Promise<unknown>; ok?: string }) => run(),
    onMutate: () => setStatus({ kind: 'busy' }),
    onSuccess: (_d, { ok }) => {
      setStatus({ kind: 'ok', text: ok ?? 'Listo.' });
      invalidate.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
    },
    onError: (err) => setStatus({ kind: 'error', text: errorText(err) }),
  });
  return {
    status,
    busy: m.isPending,
    run: (run: () => Promise<unknown>, ok?: string) => m.mutateAsync({ run, ok }).catch(() => undefined),
    clear: () => setStatus({ kind: 'idle' }),
  };
}

export function StatusLine({ status }: { status: Status }) {
  if (status.kind === 'idle' || status.kind === 'busy') return null;
  return (
    <p
      role={status.kind === 'error' ? 'alert' : 'status'}
      className={`text-label-sm ${status.kind === 'error' ? 'text-error' : 'text-secondary'}`}
    >
      {status.text}
    </p>
  );
}

// ---------- layout ----------
/**
 * Encabezado de página (patrón de Atlassian/Primer): migas, título, descripción breve y acciones a la derecha.
 * Una sola h1 por vista; las secciones de la página usan Card (h2).
 */
export function PageHeader({
  title,
  description,
  crumbs,
  meta,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  crumbs?: { label: string; to: string }[];
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-2 border-b border-border-subtle pb-6">
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Ruta de navegación">
          <ol className="flex flex-wrap items-center gap-1 text-label-md text-neutral-muted">
            {crumbs.map((c) => (
              <li key={c.to} className="inline-flex items-center gap-1">
                <Link to={c.to} className="font-semibold text-secondary hover:underline">
                  {c.label}
                </Link>
                <Icon name="chevron_right" className="text-[16px]" />
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-80">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-title-lg font-bold tracking-tight text-on-surface">{title}</h1>
            {meta}
          </div>
          {description && (
            <p className="mt-1 max-w-3xl text-body-sm text-on-surface-variant">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** Sección de una página: superficie blanca con borde (sin sombra) y título h2. */
export function Card({
  title,
  description,
  actions,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6">
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-title-md font-semibold text-on-surface">{title}</h2>}
            {description && <p className="mt-0.5 text-body-sm text-neutral-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Enlace con aspecto de botón primario (acción principal de una página que navega). */
export const LINK_BUTTON =
  'inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-label-md font-semibold text-on-primary hover:bg-secondary';

const BUTTON = {
  primary: 'bg-primary text-on-primary hover:bg-secondary',
  secondary: 'border border-border-subtle text-on-surface hover:bg-surface-cream-alt',
  danger: 'border border-error text-error hover:bg-error hover:text-on-primary',
};

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON }) {
  return (
    <button
      type="button"
      {...props}
      className={`h-10 rounded-lg px-4 text-label-md font-semibold disabled:opacity-50 ${BUTTON[variant]} ${className}`}
    />
  );
}

const INPUT =
  'h-10 rounded-lg border border-border-subtle bg-surface-container-lowest px-3 text-body-sm font-normal focus:ring-2 focus:ring-secondary focus:outline-none';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-label-md font-semibold text-on-surface">
      {label}
      {children}
      {hint && <span className="text-label-sm font-normal text-neutral-muted">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT} ${props.className ?? ''}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${INPUT} h-auto min-h-24 py-2 ${props.className ?? ''}`} />;
}

export function Select({
  options,
  empty,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string | number; label: string }[];
  empty?: string;
}) {
  return (
    <select {...props} className={`${INPUT} ${props.className ?? ''}`}>
      {empty !== undefined && <option value="">{empty}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'ok' | 'warn' | 'error';
}) {
  const tones = {
    neutral: 'bg-canvas-cream text-on-surface-variant',
    ok: 'bg-secondary/15 text-secondary',
    warn: 'bg-primary/10 text-primary',
    error: 'bg-error/10 text-error',
  };
  return (
    <span className={`inline-block rounded-full px-3 py-0.5 text-label-sm ${tones[tone]}`}>{children}</span>
  );
}

export function Pager({
  total,
  limit,
  offset,
  onChange,
}: {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
}) {
  if (total <= limit) return null;
  return (
    <div className="mt-2 flex items-center justify-end gap-3 text-label-sm text-neutral-muted">
      <span>
        {offset + 1}–{Math.min(offset + limit, total)} de {total}
      </span>
      <Button disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>
        Anterior
      </Button>
      <Button disabled={offset + limit >= total} onClick={() => onChange(offset + limit)}>
        Siguiente
      </Button>
    </div>
  );
}

export function Loading({ what = 'Cargando' }: { what?: string }) {
  return (
    <p className="text-body-md text-neutral-muted" role="status">
      {what}…
    </p>
  );
}

export function ErrorLine({ error }: { error: unknown }) {
  return (
    <p className="text-body-md text-error" role="alert">
      {errorText(error)}
    </p>
  );
}

// ---------- fechas ----------
export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/** `<input type="datetime-local">` <-> ISO con zona horaria (el backend guarda UTC). */
export const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
export const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

export const STATUS_TONE: Record<string, 'neutral' | 'ok' | 'warn' | 'error'> = {
  published: 'ok',
  scheduled: 'ok',
  approved: 'warn',
  in_review: 'warn',
  rejected: 'error',
  archived: 'neutral',
  active: 'ok',
  invited: 'warn',
  inactive: 'neutral',
  blocked: 'error',
};
