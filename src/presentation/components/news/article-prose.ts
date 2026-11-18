/**
 * Tipografía del cuerpo de una noticia. La usan el editor (WYSIWYG) y la página pública:
 * lo que se ve al escribir es lo que se publica.
 */
export const ARTICLE_PROSE = [
  'text-body-lg leading-relaxed text-on-surface',
  '[&_p]:my-4 [&>*:first-child]:mt-0',
  '[&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-headline-sm [&_h2]:font-bold [&_h2]:text-primary',
  '[&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-body-lg [&_h3]:font-bold [&_h3]:text-primary',
  '[&_a]:font-semibold [&_a]:text-primary-container [&_a]:underline [&_a]:underline-offset-2',
  '[&_strong]:font-bold [&_u]:underline-offset-2',
  '[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_li>p]:my-0',
  '[&_blockquote]:my-6 [&_blockquote]:border-l-4 [&_blockquote]:border-secondary [&_blockquote]:bg-badge-sage-bg/50',
  '[&_blockquote]:py-2 [&_blockquote]:pl-5 [&_blockquote]:pr-3 [&_blockquote]:text-on-surface-variant [&_blockquote]:italic',
  '[&_hr]:my-8 [&_hr]:border-surface-container',
  '[&_img]:my-6 [&_img]:w-full [&_img]:rounded-xl',
  '[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-surface-container [&_pre]:p-4 [&_pre]:text-body-sm',
  '[&_code]:rounded [&_code]:bg-surface-container [&_code]:px-1 [&_code]:text-body-sm',
].join(' ');
