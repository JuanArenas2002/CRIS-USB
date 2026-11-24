import { useState } from 'react';
import { Icon } from '@/presentation/components/ui/Icon';
import { useCatalogs, useOrg } from '../queries';
import { Field, Input, Select } from '../ui';
import { CHANNEL, DEVICE } from './format';
import { PRESETS, today, useStatsFilter } from './use-stats-filter';

const TOOL_BUTTON =
  'inline-flex h-11 items-center gap-2 rounded-xl border border-border-subtle bg-surface-container-lowest px-4 text-label-md font-semibold text-on-surface hover:bg-surface-cream-alt';

const UNIT_LABEL: Record<string, string> = {
  faculty: 'Facultad',
  research_center: 'Centro',
  academic_program: 'Programa',
};

type Stats = ReturnType<typeof useStatsFilter>;

/** Control segmentado del periodo + filtros secundarios plegados + exportación. */
export function Toolbar({
  withNewsFilters = true,
  onExport,
}: {
  withNewsFilters?: boolean;
  onExport?: () => void;
}) {
  const stats = useStatsFilter();
  const [open, setOpen] = useState(stats.active > 0);
  // Los catálogos se piden siempre (aunque el panel esté plegado), como antes: no cambia cuándo se consulta.
  const catalogs = useCatalogs();
  const { units } = useOrg();
  return (
    <div className="flex flex-col gap-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <PeriodPicker preset={stats.preset} onPick={(value) => stats.set('periodo', value)} />
        <button
          type="button"
          aria-expanded={open}
          aria-controls="stats-filters"
          onClick={() => setOpen((v) => !v)}
          className={TOOL_BUTTON}
        >
          <Icon name="filter_alt_off" className="text-[18px]" />
          Filtros
          {stats.active > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-label-sm text-on-primary">
              {stats.active}
            </span>
          )}
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          {onExport && (
            <button type="button" onClick={onExport} className={TOOL_BUTTON}>
              <Icon name="download" className="text-[18px]" /> Exportar CSV
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-label-md font-semibold text-on-primary hover:bg-secondary"
          >
            <Icon name="picture_as_pdf" className="text-[18px]" /> Imprimir informe
          </button>
        </div>
      </div>
      {open && (
        <FilterFields
          stats={stats}
          withNewsFilters={withNewsFilters}
          categories={catalogs.data?.categories ?? []}
          units={units}
        />
      )}
    </div>
  );
}

function PeriodPicker({ preset, onPick }: { preset: string; onPick: (value: string) => void }) {
  return (
    <div
      role="group"
      aria-label="Periodo"
      className="inline-flex flex-wrap rounded-xl border border-border-subtle bg-surface-container-lowest p-1"
    >
      {PRESETS.map((p) => (
        <button
          key={p.value}
          type="button"
          aria-pressed={preset === p.value}
          onClick={() => onPick(p.value)}
          className={`h-9 rounded-lg px-3.5 text-label-md font-semibold transition-colors ${
            preset === p.value
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:bg-surface-cream-alt hover:text-on-surface'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

const fromRecord = (record: Record<string, string>) =>
  Object.entries(record).map(([value, label]) => ({ value, label }));

interface FilterFieldsProps {
  stats: Stats;
  withNewsFilters: boolean;
  categories: { id: number; name: string }[];
  units: Record<string, { id: number; name: string }[]>;
}

function FilterFields({ stats, withNewsFilters, categories, units }: FilterFieldsProps) {
  const { filter, preset, params, set, active, clear } = stats;
  return (
    <div
      id="stats-filters"
      role="group"
      aria-label="Filtros de las estadísticas"
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border-subtle bg-surface-container-lowest p-4"
    >
      {preset === 'custom' && (
        <>
          <Field label="Desde">
            <Input
              type="date"
              value={filter.start_date}
              max={filter.end_date}
              onChange={(e) => set('desde', e.target.value)}
            />
          </Field>
          <Field label="Hasta">
            <Input
              type="date"
              value={filter.end_date}
              min={filter.start_date}
              max={today()}
              onChange={(e) => set('hasta', e.target.value)}
            />
          </Field>
        </>
      )}
      <Field label="Agrupar por">
        <Select
          value={params.get('agrupar') ?? ''}
          onChange={(e) => set('agrupar', e.target.value)}
          empty="Automático"
          options={[
            { value: 'day', label: 'Día' },
            { value: 'week', label: 'Semana' },
            { value: 'month', label: 'Mes' },
            { value: 'year', label: 'Año' },
          ]}
        />
      </Field>
      {withNewsFilters && (
        <>
          <Field label="Categoría">
            <Select
              value={params.get('categoria') ?? ''}
              onChange={(e) => set('categoria', e.target.value)}
              empty="Todas"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
          <Field label="Dependencia">
            <Select
              value={params.get('dependencia') ?? ''}
              onChange={(e) => set('dependencia', e.target.value)}
              empty="Todas"
              className="max-w-64"
              options={Object.entries(units).flatMap(([type, list]) =>
                list.map((u) => ({ value: `${type}:${u.id}`, label: `${UNIT_LABEL[type]}: ${u.name}` })),
              )}
            />
          </Field>
        </>
      )}
      <Field label="Dispositivo">
        <Select
          value={params.get('dispositivo') ?? ''}
          onChange={(e) => set('dispositivo', e.target.value)}
          empty="Todos"
          options={fromRecord(DEVICE)}
        />
      </Field>
      <Field label="Canal (solo compartidos)">
        <Select
          value={params.get('canal') ?? ''}
          onChange={(e) => set('canal', e.target.value)}
          empty="Todos"
          options={fromRecord(CHANNEL)}
        />
      </Field>
      {active > 0 && (
        <button
          type="button"
          onClick={clear}
          className="h-10 rounded-lg px-3 text-label-md font-semibold text-secondary hover:bg-cta-sage"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
