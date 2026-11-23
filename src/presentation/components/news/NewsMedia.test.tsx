import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { embedUrl, providerOf } from './media';
import { NewsMediaSections } from './NewsMedia';

test('reconoce el proveedor y arma el reproductor solo para YouTube/Vimeo (sin cookies)', () => {
  expect(providerOf('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube');
  expect(providerOf('https://www.tiktok.com/@u/video/1')).toBe('tiktok');
  expect(providerOf('https://revista.org/a')).toBeNull();
  for (const url of [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
  ])
    expect(embedUrl(url)).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0');
  expect(embedUrl('https://vimeo.com/76979871')).toBe(
    'https://player.vimeo.com/video/76979871?autoplay=1&dnt=1',
  );
  expect(embedUrl('https://www.facebook.com/watch/?v=1')).toBeNull(); // redes: tarjeta, no reproductor
  expect(embedUrl('javascript:alert(1)')).toBeNull();
});

test('videos: nada de terceros hasta pulsar "Reproducir"; redes y enlaces como tarjetas', async () => {
  render(
    <NewsMediaSections
      media={[
        { kind: 'video', url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Entrevista', provider: 'youtube' },
        { kind: 'video', url: 'https://www.tiktok.com/@u/video/1', provider: 'tiktok' },
        { kind: 'link', url: 'https://revista.org/articulo', title: 'Artículo científico' },
      ]}
    />,
  );
  expect(document.querySelector('iframe')).toBeNull();
  expect(screen.getByText('Al reproducir se cargará contenido de YouTube.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Reproducir video: Entrevista/ }));
  expect(document.querySelector('iframe')).toHaveAttribute(
    'src',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0',
  );
  const tiktok = screen.getByRole('link', { name: /Video en TikTok/ });
  expect(tiktok).toHaveAttribute('href', 'https://www.tiktok.com/@u/video/1');
  expect(tiktok).toHaveAttribute('rel', 'noopener noreferrer');
  const links = screen.getByRole('region', { name: 'Enlaces relacionados' });
  expect(within(links).getByRole('link', { name: /Artículo científico/ })).toHaveAttribute(
    'href',
    'https://revista.org/articulo',
  );
});

test('videos agrupados por formato: Shorts en vertical y la URL nunca como título', () => {
  render(
    <NewsMediaSections
      media={[
        {
          kind: 'video',
          url: 'https://www.tiktok.com/@u/video/9',
          title: 'https://www.tiktok.com/@u/video/9',
          provider: 'tiktok',
        },
        {
          kind: 'video',
          url: 'https://www.youtube.com/shorts/abcdefghijk',
          title: 'Short',
          provider: 'youtube',
        },
        { kind: 'video', url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Especial', provider: 'youtube' },
      ]}
    />,
  );
  const short = screen.getByRole('button', { name: /Reproducir video: Short/ }).parentElement!;
  expect(short.className).toContain('aspect-[9/16]');
  const wide = screen.getByRole('button', { name: /Reproducir video: Especial/ }).parentElement!;
  expect(wide.className).toContain('aspect-video');
  expect(screen.getByText('También en redes sociales')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Video en TikTok/ })).not.toHaveTextContent('https://');
});
