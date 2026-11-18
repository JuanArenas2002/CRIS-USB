import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { RichTextEditor } from './RichTextEditor';

function Harness({
  initial,
  onUploadImage,
  uploadHint,
}: {
  initial: string;
  onUploadImage?: (file: File) => Promise<string | undefined>;
  uploadHint?: string;
}) {
  const [html, setHtml] = useState(initial);
  return (
    <>
      <RichTextEditor value={html} onChange={setHtml} onUploadImage={onUploadImage} uploadHint={uploadHint} />
      <output data-testid="html">{html}</output>
    </>
  );
}

test('modo visual muestra el contenido con formato y la barra de herramientas', async () => {
  render(<Harness initial="<h2>Resultados</h2><p>Texto <strong>importante</strong></p>" />);
  expect(await screen.findByRole('heading', { level: 2, name: 'Resultados' })).toBeInTheDocument();
  expect(screen.getByText('importante').tagName).toBe('STRONG');
  for (const label of [
    'Negrita (Ctrl+B)',
    'Cursiva (Ctrl+I)',
    'Lista con viñetas',
    'Cita',
    'Enlace',
    'Deshacer (Ctrl+Z)',
  ])
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Visual' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText(/palabras · 1 min de lectura/)).toBeInTheDocument();
});

test('modo HTML edita el código fuente y al volver a Visual se ve el cambio', async () => {
  render(<Harness initial="<p>Uno</p>" />);
  await screen.findByText('Uno');
  await userEvent.click(screen.getByRole('button', { name: 'HTML' }));
  const source = screen.getByRole('textbox', { name: 'Código HTML del contenido' });
  expect(source).toHaveValue('<p>Uno</p>');
  await userEvent.clear(source);
  await userEvent.type(source, '<h3>Dos</h3>');
  expect(screen.getByTestId('html')).toHaveTextContent('<h3>Dos</h3>');
  await userEvent.click(screen.getByRole('button', { name: 'Visual' }));
  expect(await screen.findByRole('heading', { level: 3, name: 'Dos' })).toBeInTheDocument();
});

test('sin subida disponible, insertar imagen explica por qué', async () => {
  render(<Harness initial="<p>x</p>" uploadHint="Guarda el borrador para poder insertar imágenes" />);
  await screen.findByText('x');
  const picker = screen.getByLabelText('Insertar imagen', { selector: 'input' });
  expect(picker).toBeDisabled();
  expect(picker.closest('label')).toHaveAttribute('title', 'Guarda el borrador para poder insertar imágenes');
});

test('una imagen subida se inserta en el contenido', async () => {
  const upload = vi.fn(async () => '/news-api/media/news/7-0123456789abcdef.png');
  render(<Harness initial="<p>Antes</p>" onUploadImage={upload} />);
  await screen.findByText('Antes');
  const file = new File([new Uint8Array([137, 80, 78, 71])], 'laboratorio.png', { type: 'image/png' });
  await userEvent.upload(screen.getByLabelText('Insertar imagen', { selector: 'input' }), file);
  expect(upload).toHaveBeenCalledWith(file);
  await waitFor(() =>
    expect(screen.getByTestId('html').textContent).toContain(
      'src="/news-api/media/news/7-0123456789abcdef.png"',
    ),
  );
  expect(screen.getByTestId('html').textContent).toContain('alt="laboratorio"');
});
