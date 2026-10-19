import { HeroWaves } from '@/presentation/components/layout/HeroWaves';
import type { AuthorStats } from '@/domain/authors/author';

const fmt = new Intl.NumberFormat('es-CO');

interface Props {
  stats?: AuthorStats;
}

function Stat({ value, label, accent }: { value?: number | string; label: string; accent: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-label-sm text-primary-fixed-dim">{label}</dt>
      <dd className={`text-stat-metric font-bold ${accent}`}>
        {value === undefined ? '—' : typeof value === 'number' ? fmt.format(value) : value}
      </dd>
    </div>
  );
}

export function DirectoryHero({ stats }: Props) {
  const by = stats?.byCategory;
  return (
    <section
      aria-labelledby="hero-title"
      className="relative w-full overflow-hidden bg-surface-dark-forest pt-10 pb-16 text-on-primary"
    >
      <HeroWaves />
      <div className="relative container-page flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-primary-container px-3 py-1 text-label-sm tracking-wide text-primary-fixed">
            <span className="h-2 w-2 animate-pulse rounded-full bg-secondary-fixed motion-reduce:animate-none" />
            Investigación Unisimón
          </p>
          <span className="text-label-sm text-primary-fixed-dim">/ Portal Institucional</span>
        </div>
        <div className="flex max-w-3xl flex-col gap-2">
          <h1
            id="hero-title"
            className="text-display-hero-mobile font-bold tracking-tight text-surface-container-lowest md:text-display-hero"
          >
            Las personas y los proyectos detrás del <span className="text-secondary-fixed">conocimiento</span>{' '}
            que producimos
          </h1>
          <p className="text-body-lg text-primary-fixed-dim">
            Conoce a quienes investigan en la Universidad Simón Bolívar y los proyectos científicos que están
            transformando la Región Caribe colombiana y el mundo.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-4 border-t border-primary-container pt-2 sm:grid-cols-4">
          <Stat value={stats?.total} label="Investigadores activos" accent="text-surface-container-lowest" />
          <Stat
            value={by && by.senior + by.emerito}
            label="Sénior y Eméritos (Minciencias)"
            accent="text-secondary-fixed"
          />
          <Stat
            value={by?.asociado}
            label="Investigadores Asociados"
            accent="text-surface-container-lowest"
          />
          <Stat value={by?.junior} label="Investigadores Junior" accent="text-tertiary-fixed" />
        </dl>
      </div>
    </section>
  );
}
