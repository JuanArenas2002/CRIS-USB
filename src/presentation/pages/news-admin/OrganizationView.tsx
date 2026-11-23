import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { newsApi, type Center, type OrgUnit, type Program } from '@/infrastructure/news/news-api';
import { Icon } from '@/presentation/components/ui/Icon';
import { KEYS } from './queries';
import {
  Badge,
  Button,
  Card,
  ErrorLine,
  Input,
  Loading,
  StatusLine,
  fmtDate,
  useAction,
  useAdminSession,
  PageHeader,
} from './ui';

/** Búsqueda sin tildes ni mayúsculas. */
const norm = (s: string | null | undefined) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const isPostgrad = (p: Program) => norm(p.level_academic).startsWith('posgrado');

/** Dependencias replicadas desde Metri-K (lectura) y sincronización (organization.sync institucional). */
export function OrganizationView() {
  const { can } = useAdminSession();
  const [all, setAll] = useState(false);
  const [tab, setTab] = useState<'faculties' | 'centers'>('faculties');
  const [q, setQ] = useState('');
  const sync = useAction([KEYS.org]);
  const faculties = useQuery({
    queryKey: [...KEYS.org, 'faculties', all],
    queryFn: () => newsApi.faculties(all),
  });
  const centers = useQuery({ queryKey: [...KEYS.org, 'centers', all], queryFn: () => newsApi.centers(all) });
  const programs = useQuery({
    queryKey: [...KEYS.org, 'programs', 'all', all],
    queryFn: () => newsApi.programs(undefined, all),
  });

  const lastSync = [...(faculties.data ?? []), ...(centers.data ?? [])]
    .map((u) => u.synced_at)
    .sort()
    .at(-1);
  const empty = faculties.data?.length === 0 && centers.data?.length === 0;
  const loading = faculties.isPending || centers.isPending || programs.isPending;
  const error = faculties.error ?? centers.error ?? programs.error;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dependencias"
        description="Facultades, programas y centros de investigación tomados de Metri-K. Son las dependencias a las que se asocian las noticias y sobre las que se asignan roles."
        meta={
          <span className="inline-flex items-center gap-1 text-label-sm text-neutral-muted">
            <Icon name="history" className="text-[16px]" />
            {lastSync ? `Última sincronización: ${fmtDate(lastSync)}` : 'Aún no se ha sincronizado'}
          </span>
        }
        actions={
          can('organization.sync') && (
            <Button
              variant="primary"
              disabled={sync.busy}
              className="inline-flex items-center gap-1"
              onClick={() =>
                void sync.run(newsApi.sync, 'Sincronización completa: los datos están al día con Metri-K.')
              }
            >
              <Icon
                name="refresh"
                className={`text-[18px] ${sync.busy ? 'animate-spin motion-reduce:animate-none' : ''}`}
              />
              {sync.busy ? 'Sincronizando…' : 'Sincronizar con Metri-K'}
            </Button>
          )
        }
      />
      <StatusLine status={sync.status} />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorLine error={error} />
      ) : empty ? (
        <Card>
          <p className="text-body-md text-on-surface">
            Todavía no hay dependencias.
            {can('organization.sync')
              ? ' Pulsa “Sincronizar con Metri-K” para traerlas.'
              : ' Pide a un administrador que las sincronice.'}
          </p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat icon="account_balance" label="Facultades" value={faculties.data!.length} />
            <Stat
              icon="school"
              label="Programas académicos"
              value={programs.data!.length}
              detail={`${programs.data!.filter((p) => !isPostgrad(p)).length} de pregrado · ${programs.data!.filter(isPostgrad).length} de posgrado`}
            />
            <Stat
              icon="science"
              label="Centros de investigación"
              value={centers.data!.length}
              detail={`${centers.data!.filter((c) => c.is_active).length} activos`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="Tipo de dependencia" className="flex gap-2">
              {(
                [
                  ['faculties', 'Facultades y programas'],
                  ['centers', 'Centros de investigación'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={tab === key}
                  onClick={() => setTab(key)}
                  className={`rounded-full px-4 py-2 text-label-md font-semibold ${
                    tab === key
                      ? 'bg-secondary text-on-primary'
                      : 'bg-surface-container-lowest text-on-surface shadow-sm hover:bg-surface-cream-alt'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Icon
                  name="search"
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[18px] text-neutral-muted"
                />
                <Input
                  aria-label="Buscar dependencia"
                  placeholder="Buscar por nombre, sigla o SNIES"
                  value={q}
                  className="w-72 pl-9"
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-label-md text-on-surface">
                <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Incluir
                inactivas
              </label>
            </div>
          </div>

          {tab === 'faculties' ? (
            <Faculties faculties={faculties.data!} programs={programs.data!} q={norm(q)} />
          ) : (
            <Centers centers={centers.data!} q={norm(q)} />
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  detail,
}: {
  icon: string;
  label: string;
  value: number;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-surface-container-lowest p-5 border border-border-subtle">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-badge-sage-bg text-primary-container">
        <Icon name={icon} className="text-[24px]" />
      </span>
      <span>
        <span className="block text-headline-sm font-bold text-primary tabular-nums">{value}</span>
        <span className="block text-label-md text-on-surface">{label}</span>
        {detail && <span className="block text-label-sm text-neutral-muted">{detail}</span>}
      </span>
    </div>
  );
}

function Faculties({ faculties, programs, q }: { faculties: OrgUnit[]; programs: Program[]; q: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const rows = faculties
    .map((f) => {
      const own = programs.filter((p) => p.faculty_id === f.id);
      const facultyHit = norm(f.name).includes(q);
      const matching =
        q && !facultyHit
          ? own.filter((p) => norm(p.name).includes(q) || (p.code_snies ?? '').includes(q))
          : own;
      return {
        f,
        own,
        matching,
        byProgram: !!q && !facultyHit,
        visible: !q || facultyHit || matching.length > 0,
      };
    })
    .filter((r) => r.visible)
    .sort((a, b) => a.f.name.localeCompare(b.f.name));
  if (!rows.length)
    return (
      <Card>
        <p className="text-body-md text-neutral-muted">Ninguna facultad o programa coincide con “{q}”.</p>
      </Card>
    );

  return (
    <ul className="flex flex-col gap-3">
      {rows.map(({ f, own, matching, byProgram }) => {
        // Si la búsqueda coincide con programas (no con la facultad), se despliega para mostrarlos.
        const expanded = open === f.id || byProgram;
        const pre = own.filter((p) => !isPostgrad(p)).length;
        return (
          <li
            key={f.id}
            className="overflow-hidden rounded-xl bg-surface-container-lowest border border-border-subtle"
          >
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(open === f.id ? null : f.id)}
              className="flex w-full items-center gap-4 p-4 text-left hover:bg-surface-cream-alt"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-badge-sage-bg text-primary-container">
                <Icon name="account_balance" className="text-[22px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-on-surface">{f.name}</span>
                <span className="block text-label-sm text-neutral-muted">
                  {own.length
                    ? `${own.length} programas · ${pre} de pregrado · ${own.length - pre} de posgrado`
                    : 'Sin programas registrados'}
                </span>
              </span>
              {!f.is_active && <Badge>Inactiva</Badge>}
              <Icon
                name="expand_more"
                className={`text-[24px] text-neutral-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            </button>
            {expanded && own.length > 0 && <ProgramList programs={matching} />}
          </li>
        );
      })}
    </ul>
  );
}

function ProgramList({ programs }: { programs: Program[] }) {
  const groups = [
    { label: 'Pregrado', items: programs.filter((p) => !isPostgrad(p)) },
    { label: 'Posgrado', items: programs.filter(isPostgrad) },
  ].filter((g) => g.items.length);
  return (
    <div className="grid gap-4 border-t border-border-subtle p-4 md:grid-cols-2">
      {groups.map((g) => (
        <div key={g.label}>
          <h3 className="mb-2 text-label-md font-bold tracking-wider text-secondary uppercase">
            {g.label} ({g.items.length})
          </h3>
          <ul className="flex flex-col gap-2">
            {[...g.items]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => (
                <li key={p.id} className="rounded-lg bg-canvas-cream px-3 py-2">
                  <span className="block text-body-sm font-semibold text-on-surface">
                    {titleCase(p.name)}
                  </span>
                  <span className="flex flex-wrap gap-x-3 text-label-sm text-on-surface-variant">
                    {p.level_education && <span>{p.level_education}</span>}
                    {p.modality && <span>{p.modality}</span>}
                    {p.code_snies && <span>SNIES {p.code_snies}</span>}
                    {!p.is_active && <span className="text-error">Inactivo</span>}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Centers({ centers, q }: { centers: Center[]; q: string }) {
  const rows = centers
    .filter((c) => !q || norm(c.name).includes(q) || norm(c.acronym).includes(q) || norm(c.code).includes(q))
    .sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name));
  if (!rows.length)
    return (
      <Card>
        <p className="text-body-md text-neutral-muted">Ningún centro coincide con “{q}”.</p>
      </Card>
    );
  const year = (d: string | null) => (d ? new Date(d).getFullYear() : null);
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((c) => (
        <li
          key={c.id}
          className={`flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-5 border border-border-subtle ${c.is_active ? '' : 'opacity-75'}`}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="rounded-lg bg-primary-container px-3 py-1.5 text-label-md font-bold tracking-wide text-on-primary">
              {c.acronym || c.code || 'Centro'}
            </span>
            <Badge tone={c.is_active ? 'ok' : 'neutral'}>{c.is_active ? 'Activo' : 'Cerrado'}</Badge>
          </div>
          <p className="font-semibold text-on-surface">{c.name}</p>
          <p className="mt-auto text-label-sm text-neutral-muted">
            {year(c.date_created) ? `Desde ${year(c.date_created)}` : ''}
            {c.date_closed ? ` · cerrado en ${year(c.date_closed)}` : ''}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Metri-K guarda los programas en MAYÚSCULAS: se muestran como título (respetando las palabras cortas). */
function titleCase(name: string): string {
  const small = new Set([
    'de',
    'del',
    'la',
    'las',
    'los',
    'el',
    'en',
    'y',
    'e',
    'o',
    'u',
    'a',
    'con',
    'para',
    'por',
  ]);
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}
