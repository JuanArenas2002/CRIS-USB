import { CATEGORY_LEVEL, type CategoryRecord } from '@/domain/groups/group';
import { TrendChart } from '@/presentation/components/charts/TrendChart';

/** Escala oficial de grupos Minciencias, de la más baja a la más alta. */
const SCALE = [
  { value: CATEGORY_LEVEL.RECONOCIDO!, label: 'Reconocido' },
  { value: CATEGORY_LEVEL.D!, label: 'Cat. D' },
  { value: CATEGORY_LEVEL.C!, label: 'Cat. C' },
  { value: CATEGORY_LEVEL.B!, label: 'Cat. B' },
  { value: CATEGORY_LEVEL.A!, label: 'Cat. A' },
  { value: CATEGORY_LEVEL.A1!, label: 'Cat. A1' },
];

const level = (category: string) => CATEGORY_LEVEL[category.toUpperCase()] ?? CATEGORY_LEVEL.RECONOCIDO!;
/** "Convocatoria 833 de 2018" → "Conv. 833". */
const convNumber = (name: string) => {
  const n = /(\d{3,4})\s+de/.exec(name)?.[1];
  return n ? `Conv. ${n}` : undefined;
};
const pill = (category: string) => (category.toUpperCase() === 'RECONOCIDO' ? 'Recon.' : `Cat. ${category}`);

/** Evolución de la categoría Minciencias del grupo, convocatoria por convocatoria. */
export function CategoryTimeline({ history }: { history: CategoryRecord[] }) {
  if (!history.length)
    return <p className="text-body-sm text-neutral-muted">Sin historial de convocatorias registrado.</p>;

  const first = history[0]!;
  const last = history[history.length - 1]!;
  return (
    <TrendChart
      ariaLabel={`Categoría Minciencias del grupo: ${first.category} en ${first.year ?? '—'}, ${last.category} en ${last.year ?? '—'}.`}
      yTicks={SCALE}
      points={history.map((h, i) => ({
        key: `${h.convocation}-${i}`,
        value: level(h.category),
        xLabel: String(h.year ?? '—'),
        xSubLabel: convNumber(h.convocation),
        pill: pill(h.category),
        title: `${h.convocation}: categoría ${h.category}`,
      }))}
      caption={
        <>
          <span className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-secondary" />
            <span>
              Escala oficial: <strong className="text-primary">A1</strong> (máxima) &gt;{' '}
              <strong className="text-primary">A</strong> &gt; <strong className="text-primary">B</strong>{' '}
              &gt; <strong className="text-primary">C</strong> &gt;{' '}
              <strong className="text-primary">D</strong> &gt;{' '}
              <strong className="text-primary">Reconocido</strong>
            </span>
          </span>
          <span>Resultados según el modelo de medición de grupos de Minciencias.</span>
        </>
      }
    />
  );
}
