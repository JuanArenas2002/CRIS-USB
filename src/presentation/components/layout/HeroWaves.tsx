/** Ondas animadas de la franja verde superior (mismo motivo que la plantilla). El padre debe ser `relative overflow-hidden`. */
export function HeroWaves() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-40"
      fill="none"
      viewBox="0 0 1440 480"
      preserveAspectRatio="xMidYMid slice"
    >
      <path
        className="wave-dash text-secondary-fixed"
        d="M-100 320C240 180 520 420 860 260C1200 100 1380 340 1600 220"
        stroke="currentColor"
        strokeDasharray="6 6"
        strokeWidth="2"
      />
      <path
        className="wave-drift text-tertiary-fixed"
        d="M-60 160C280 320 640 120 980 280C1320 440 1420 180 1560 120"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <circle className="wave-drift" cx="980" cy="280" fill="#8cfaa1" r="6" />
      <circle className="wave-drift" cx="860" cy="260" fill="#c1f279" r="4" />
    </svg>
  );
}
