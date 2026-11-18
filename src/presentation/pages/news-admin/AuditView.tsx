import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { iamAdmin, type AuditEntry } from '@/infrastructure/news/iam-admin-api';
import { AUDIT_FILTERS, auditEventLabel, resultLabel } from './labels';
import { KEYS } from './queries';
import {
  Badge,
  Card,
  ErrorLine,
  Field,
  Input,
  Loading,
  Pager,
  Select,
  fmtDate,
  fromLocalInput,
  PageHeader,
} from './ui';

const LIMIT = 25;
const TONE = { success: 'ok', failure: 'error', denied: 'error' } as const;

/** Auditoría de solo lectura (en PostgreSQL un trigger impide modificarla). */
export function AuditView() {
  const [f, setF] = useState({ event_type: '', result: '', since: '', until: '', order: 'desc', offset: 0 });
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, offset: 0, ...patch }));
  const audit = useQuery({
    queryKey: [...KEYS.audit, f],
    queryFn: () =>
      iamAdmin.audit({
        event_type: f.event_type || undefined,
        result: f.result || undefined,
        since: fromLocalInput(f.since) ?? undefined,
        until: fromLocalInput(f.until) ?? undefined,
        order: f.order,
        limit: LIMIT,
        offset: f.offset,
      }),
    placeholderData: keepPreviousData,
  });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Auditoría"
        description="Registro de inicios de sesión y cambios de administración: quién hizo qué, cuándo y con qué resultado."
      />
      <Card title="Eventos">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Field label="Qué">
            <Select
              empty="Todo"
              value={f.event_type}
              options={AUDIT_FILTERS}
              onChange={(e) => set({ event_type: e.target.value })}
            />
          </Field>
          <Field label="Resultado">
            <Select
              empty="Todos"
              value={f.result}
              onChange={(e) => set({ result: e.target.value })}
              options={[
                { value: 'success', label: 'Correcto' },
                { value: 'failure', label: 'Fallido' },
                { value: 'denied', label: 'Denegado' },
              ]}
            />
          </Field>
          <Field label="Desde">
            <Input type="datetime-local" value={f.since} onChange={(e) => set({ since: e.target.value })} />
          </Field>
          <Field label="Hasta">
            <Input type="datetime-local" value={f.until} onChange={(e) => set({ until: e.target.value })} />
          </Field>
          <Field label="Orden">
            <Select
              value={f.order}
              onChange={(e) => set({ order: e.target.value })}
              options={[
                { value: 'desc', label: 'Recientes primero' },
                { value: 'asc', label: 'Antiguos primero' },
              ]}
            />
          </Field>
        </div>
        <div className="mt-4">
          {audit.isPending ? (
            <Loading />
          ) : audit.isError ? (
            <ErrorLine error={audit.error} />
          ) : (
            <>
              <AuditList items={audit.data.items} />
              <Pager
                total={audit.data.total}
                limit={LIMIT}
                offset={f.offset}
                onChange={(offset) => setF((x) => ({ ...x, offset }))}
              />
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

/** Lista legible de eventos (también la usa el detalle de usuario). */
export function AuditList({ items, showActor = true }: { items: AuditEntry[]; showActor?: boolean }) {
  if (!items.length) return <p className="text-body-sm text-neutral-muted">Sin eventos.</p>;
  return (
    <ul className="flex flex-col">
      {items.map((e) => (
        <li
          key={e.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-subtle py-2 text-body-sm first:border-t-0"
        >
          <Badge tone={TONE[e.result as keyof typeof TONE] ?? 'neutral'}>{resultLabel(e.result)}</Badge>
          <span className="font-semibold text-on-surface">{auditEventLabel(e.event_type)}</span>
          {showActor && (
            <span className="text-on-surface-variant">
              {e.actor_name ?? (e.actor_user_id ? 'Usuario eliminado' : 'Sin sesión')}
            </span>
          )}
          <span className="ml-auto text-label-sm text-neutral-muted">
            {fmtDate(e.at)}
            {e.ip ? ` · IP ${e.ip}` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}
