/**
 * Ícono decorativo de Material Symbols. Si cambias `name`, agrégalo a `icon_names` en index.html
 * y corre `npm run icons`. Las clases (tamaño, color, posición) van en el contenedor; el glifo hereda.
 */
export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 leading-none select-none ${className}`}>
      <span className="material-symbols-outlined">{name}</span>
    </span>
  );
}
