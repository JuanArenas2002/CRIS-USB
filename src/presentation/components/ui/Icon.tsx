/**
 * Ícono decorativo de Material Symbols. Si cambias `name`, agrégalo a `icon_names` en index.html.
 * Las clases (tamaño, color, posición) van en el contenedor: la hoja de Google fija `font-size: 24px`
 * sin capa y le ganaría a las utilidades de Tailwind (que viven en @layer), así que el glifo hereda.
 */
export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 leading-none select-none ${className}`}>
      <span className="material-symbols-outlined">{name}</span>
    </span>
  );
}
