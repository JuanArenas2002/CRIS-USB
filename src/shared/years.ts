/** Años transcurridos desde `year` (fundación…); null si no se conoce. */
export const yearsSince = (year: number | null | undefined, now = new Date().getFullYear()) =>
  year ? now - year : null;
