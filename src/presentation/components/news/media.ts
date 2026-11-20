/**
 * Videos y enlaces de una noticia. Solo se guardan URLs: el reproductor se arma aquí y SOLO para proveedores
 * con reproductor embebible sin scripts propios (YouTube en modo sin cookies, Vimeo con dnt). Las redes
 * sociales (Facebook, Instagram, TikTok, X, LinkedIn) se muestran como tarjeta que abre la publicación.
 */
export const PROVIDER_LABEL: Record<string, string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  x: 'X',
  linkedin: 'LinkedIn',
};

const HOSTS: Record<string, string> = {
  'youtube.com': 'youtube',
  'm.youtube.com': 'youtube',
  'youtu.be': 'youtube',
  'youtube-nocookie.com': 'youtube',
  'vimeo.com': 'vimeo',
  'player.vimeo.com': 'vimeo',
  'facebook.com': 'facebook',
  'm.facebook.com': 'facebook',
  'fb.watch': 'facebook',
  'instagram.com': 'instagram',
  'tiktok.com': 'tiktok',
  'vm.tiktok.com': 'tiktok',
  'x.com': 'x',
  'twitter.com': 'x',
  'linkedin.com': 'linkedin',
};

function parse(url: string): URL | null {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null;
  } catch {
    return null;
  }
}

/** Mismo criterio que el backend (domain/services/media_service.py). */
export function providerOf(url: string): string | null {
  const u = parse(url);
  return u ? (HOSTS[u.hostname.toLowerCase().replace(/^www\./, '')] ?? null) : null;
}

export const isHttpUrl = (url: string) => parse(url) !== null;

/** URL del reproductor embebido, o null si el enlace no se puede incrustar (se muestra como tarjeta). */
export function embedUrl(url: string): string | null {
  const u = parse(url);
  if (!u) return null;
  const provider = providerOf(url);
  if (provider === 'youtube') {
    const id = u.hostname.endsWith('youtu.be')
      ? u.pathname.slice(1)
      : (u.searchParams.get('v') ?? u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1] ?? '');
    return /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0` : null;
  }
  if (provider === 'vimeo') {
    const id = u.pathname.match(/(\d{5,})/)?.[1];
    return id ? `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1` : null;
  }
  return null;
}

/** Dominio legible para tarjetas de enlace ("revista.example.org"). */
export const hostOf = (url: string) => parse(url)?.hostname.replace(/^www\./, '') ?? url;

/** Videos verticales (YouTube Shorts): se muestran en formato 9:16 en vez de 16:9. */
export const isVertical = (url: string) => /youtube\.com\/shorts\//i.test(url);
