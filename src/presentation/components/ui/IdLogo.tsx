import { withBase } from '@/shared/base';
/** Logos oficiales de identificadores científicos (public/assets/ids, WebP de 96 px). */
const LOGOS: Record<string, string> = {
  ORCID: withBase('/assets/ids/orcid.webp'),
  CvLAC: withBase('/assets/ids/cvlac.webp'),
  Scopus: withBase('/assets/ids/scopus.webp'),
  'Google Scholar': withBase('/assets/ids/scholar.webp'),
};

/** Decorativo: el nombre del identificador siempre va en texto al lado. */
export function IdLogo({ label, size = 32 }: { label: string; size?: number }) {
  const src = LOGOS[label];
  return src ? (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 rounded object-contain"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded bg-primary-container text-label-sm font-bold text-secondary-fixed"
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.34) }}
    >
      {label.slice(0, 2) /* identificador sin logo: sus iniciales */}
    </span>
  );
}
