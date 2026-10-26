import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';

// Diseño del carrusel de shadcn/ui (flechas redondas a los lados, 1/2 y 1/3 por vista) sin Embla:
// el desplazamiento es nativo (scroll-snap) y las flechas avanzan de una foto en una.
const GAP = 8; // gap-2

export function Carousel({ images, label }: { images: { src: string; alt: string }[]; label: string }) {
  const { t } = useTranslation();
  const track = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: images.length <= 1 });

  const update = () => {
    const el = track.current;
    if (el) setEdge({ start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  };
  // Si todas caben, las flechas quedan desactivadas.
  useEffect(() => {
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [images.length]);
  const move = (dir: 1 | -1) => {
    const el = track.current;
    const item = el?.firstElementChild as HTMLElement | null;
    if (el && item) el.scrollBy?.({ left: dir * (item.offsetWidth + GAP), behavior: 'smooth' });
  };
  const arrow =
    'absolute top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border-subtle bg-surface-container-lowest text-primary shadow-xs transition-colors hover:bg-surface-cream-alt disabled:opacity-40';

  return (
    <div role="group" aria-label={label} className="relative px-10">
      <ul
        ref={track}
        onScroll={update}
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto [scrollbar-width:none]"
      >
        {images.map((img) => (
          <li
            key={img.src}
            className="shrink-0 basis-[calc(50%-4px)] snap-start lg:basis-[calc((100%-16px)/3)]"
          >
            <img
              src={img.src}
              alt={img.alt}
              loading="lazy"
              className="aspect-video w-full rounded-xl border border-border-subtle bg-surface-cream-alt object-cover"
            />
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => move(-1)}
        disabled={edge.start}
        aria-label={t('carousel.prev')}
        className={`${arrow} left-0`}
      >
        <Icon name="chevron_left" className="text-[18px]" />
      </button>
      <button
        type="button"
        onClick={() => move(1)}
        disabled={edge.end}
        aria-label={t('carousel.next')}
        className={`${arrow} right-0`}
      >
        <Icon name="chevron_right" className="text-[18px]" />
      </button>
    </div>
  );
}
