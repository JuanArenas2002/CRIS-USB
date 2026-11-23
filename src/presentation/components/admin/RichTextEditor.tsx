import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import { ARTICLE_PROSE } from '@/presentation/components/news/article-prose';
import { Icon } from '@/presentation/components/ui/Icon';

/**
 * Editor de contenido con dos modos:
 * - Visual (WYSIWYG, TipTap): títulos, formato, listas, citas, enlaces e imágenes.
 * - HTML: el código fuente, para quien prefiera escribirlo o pegarlo.
 * El HTML se sanitiza en el servidor (nh3): lo que no sea seguro (scripts, iframes, estilos en línea) se elimina.
 */
export interface RichTextEditorProps {
  id?: string;
  labelledBy?: string;
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Sube una imagen y devuelve su URL para el navegador. Sin ella, solo se insertan imágenes por URL. */
  onUploadImage?: (file: File) => Promise<string | undefined>;
  /** Por qué no se pueden subir imágenes todavía (p.ej. "Guarda el borrador primero"). */
  uploadHint?: string;
}

const IMAGE_TYPES = 'image/jpeg,image/png,image/webp';
const EMPTY = new Set(['', '<p></p>']);

export function RichTextEditor({
  id,
  labelledBy,
  value,
  onChange,
  disabled,
  placeholder,
  onUploadImage,
  uploadHint,
}: RichTextEditorProps) {
  const [mode, setMode] = useState<'visual' | 'html'>('visual');
  const lastEmitted = useRef(value);
  const editor = useEditor({
    immediatelyRender: false, // la app también se prerenderiza: el editor se monta solo en el navegador
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] }, // el título de la noticia es el h1
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      Image,
      Placeholder.configure({ placeholder: placeholder ?? 'Escribe la noticia…' }),
      CharacterCount,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: `min-h-[22rem] px-5 py-6 focus:outline-none ${ARTICLE_PROSE}`,
        ...(id ? { id } : {}),
        ...(labelledBy ? { 'aria-labelledby': labelledBy } : {}),
      },
    },
    onUpdate: ({ editor: e }) => {
      const html = EMPTY.has(e.getHTML()) ? '' : e.getHTML();
      lastEmitted.current = html;
      onChange(html);
    },
  });

  // Cambios que llegan de fuera (otra noticia, modo HTML, restaurar): se reflejan sin perder el cursor al escribir.
  useEffect(() => {
    if (editor && value !== lastEmitted.current) {
      lastEmitted.current = value;
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);
  useEffect(() => editor?.setEditable(!disabled), [editor, disabled]);

  const words =
    useEditorState({ editor, selector: (s) => s.editor?.storage.characterCount.words() ?? 0 }) ?? 0;

  return (
    <div
      className={`overflow-hidden rounded-xl border border-border-subtle bg-surface-container-lowest shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-secondary ${disabled ? 'opacity-70' : ''}`}
    >
      <div
        role="toolbar"
        aria-label="Formato del contenido"
        className="flex flex-wrap items-center gap-1 border-b border-border-subtle bg-canvas-cream/60 px-2 py-2"
      >
        {mode === 'visual' && editor ? (
          <Toolbar
            editor={editor}
            disabled={!!disabled}
            onUploadImage={onUploadImage}
            uploadHint={uploadHint}
          />
        ) : (
          <span className="px-2 text-label-sm text-neutral-muted">
            Código HTML. El servidor elimina lo que no sea seguro.
          </span>
        )}
        <span
          className="ml-auto flex shrink-0 rounded-lg bg-surface-container-lowest p-0.5 ring-1 ring-border-subtle"
          role="group"
          aria-label="Modo de edición"
        >
          {(['visual', 'html'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1.5 text-label-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${mode === m ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface hover:bg-surface-cream-alt'}`}
            >
              {m === 'visual' ? 'Visual' : 'HTML'}
            </button>
          ))}
        </span>
      </div>

      {mode === 'visual' ? (
        <EditorContent editor={editor} />
      ) : (
        <textarea
          aria-label="Código HTML del contenido"
          value={value}
          disabled={disabled}
          spellCheck={false}
          onChange={(e) => {
            lastEmitted.current = '';
            onChange(e.target.value);
          }}
          className="block min-h-[22rem] w-full resize-y bg-surface-container-lowest px-5 py-6 font-mono text-body-sm leading-6 text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary"
        />
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border-subtle bg-surface-container-lowest px-4 py-2 text-label-sm text-neutral-muted">
        <span>{mode === 'visual' ? 'Edición visual' : 'Código HTML'}</span>
        <span aria-live="polite" aria-atomic="true">
          {words} {words === 1 ? 'palabra' : 'palabras'} · {Math.max(1, Math.round(words / 200))} min de
          lectura
        </span>
      </div>
    </div>
  );
}

function Toolbar({
  editor,
  disabled,
  onUploadImage,
  uploadHint,
}: {
  editor: Editor;
  disabled: boolean;
  onUploadImage?: (file: File) => Promise<string | undefined>;
  uploadHint?: string;
}) {
  // Re-render de la barra cuando cambia la selección (estado activo de cada botón).
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : 'p',
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      link: e.isActive('link'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const chain = () => editor.chain().focus();

  const applyLink = () => {
    const href = url.trim();
    if (href)
      chain()
        .extendMarkRange('link')
        .setLink({ href: /^(https?:|mailto:)/i.test(href) ? href : `https://${href}` })
        .run();
    else chain().extendMarkRange('link').unsetLink().run();
    setLinking(false);
  };

  return (
    <>
      <select
        aria-label="Tipo de texto"
        disabled={disabled}
        value={s.block}
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'p') chain().setParagraph().run();
          else
            chain()
              .toggleHeading({ level: v === 'h2' ? 2 : 3 })
              .run();
        }}
        className="h-8 rounded-md border border-border-subtle bg-surface-container-lowest px-2 text-label-sm"
      >
        <option value="p">Párrafo</option>
        <option value="h2">Título de sección</option>
        <option value="h3">Subtítulo</option>
      </select>
      <Sep />
      <Tool
        icon="format_bold"
        label="Negrita (Ctrl+B)"
        active={s.bold}
        disabled={disabled}
        onClick={() => chain().toggleBold().run()}
      />
      <Tool
        icon="format_italic"
        label="Cursiva (Ctrl+I)"
        active={s.italic}
        disabled={disabled}
        onClick={() => chain().toggleItalic().run()}
      />
      <Tool
        icon="format_underlined"
        label="Subrayado (Ctrl+U)"
        active={s.underline}
        disabled={disabled}
        onClick={() => chain().toggleUnderline().run()}
      />
      <Tool
        icon="strikethrough_s"
        label="Tachado"
        active={s.strike}
        disabled={disabled}
        onClick={() => chain().toggleStrike().run()}
      />
      <Sep />
      <Tool
        icon="format_list_bulleted"
        label="Lista con viñetas"
        active={s.bullet}
        disabled={disabled}
        onClick={() => chain().toggleBulletList().run()}
      />
      <Tool
        icon="format_list_numbered"
        label="Lista numerada"
        active={s.ordered}
        disabled={disabled}
        onClick={() => chain().toggleOrderedList().run()}
      />
      <Tool
        icon="format_quote"
        label="Cita"
        active={s.quote}
        disabled={disabled}
        onClick={() => chain().toggleBlockquote().run()}
      />
      <Tool
        icon="horizontal_rule"
        label="Línea separadora"
        disabled={disabled}
        onClick={() => chain().setHorizontalRule().run()}
      />
      <Sep />
      <Tool
        icon="link"
        label="Enlace"
        active={s.link || linking}
        disabled={disabled}
        onClick={() => {
          setUrl(editor.getAttributes('link').href ?? '');
          setLinking((v) => !v);
        }}
      />
      {s.link && (
        <Tool
          icon="link_off"
          label="Quitar enlace"
          disabled={disabled}
          onClick={() => chain().extendMarkRange('link').unsetLink().run()}
        />
      )}
      <label
        title={onUploadImage ? 'Insertar imagen' : uploadHint}
        className={`flex h-8 w-8 items-center justify-center rounded-md ${
          onUploadImage && !disabled && !uploading
            ? 'cursor-pointer text-on-surface hover:bg-surface-cream-alt'
            : 'cursor-not-allowed text-neutral-muted opacity-60'
        }`}
      >
        <Icon name="add_photo_alternate" className={`text-[20px] ${uploading ? 'animate-pulse' : ''}`} />
        <input
          type="file"
          accept={IMAGE_TYPES}
          className="sr-only"
          aria-label="Insertar imagen"
          disabled={!onUploadImage || disabled || uploading}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file || !onUploadImage) return;
            setUploading(true);
            setError('');
            try {
              const src = await onUploadImage(file);
              if (src)
                chain()
                  .setImage({ src, alt: file.name.replace(/\.[^.]+$/, '') })
                  .run();
            } catch (err) {
              setError((err as Error).message || 'No se pudo subir la imagen');
            } finally {
              setUploading(false);
            }
          }}
        />
      </label>
      <Sep />
      <Tool
        icon="format_clear"
        label="Quitar formato"
        disabled={disabled}
        onClick={() => chain().unsetAllMarks().clearNodes().run()}
      />
      <Tool
        icon="undo"
        label="Deshacer (Ctrl+Z)"
        disabled={disabled || !s.canUndo}
        onClick={() => chain().undo().run()}
      />
      <Tool
        icon="redo"
        label="Rehacer (Ctrl+Y)"
        disabled={disabled || !s.canRedo}
        onClick={() => chain().redo().run()}
      />

      {linking && (
        <form
          className="flex w-full items-center gap-2 pt-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
        >
          <input
            autoFocus
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={url}
            aria-label="Dirección del enlace"
            onChange={(e) => setUrl(e.target.value)}
            className="h-8 flex-1 rounded-md border border-border-subtle bg-surface-container-lowest px-2 text-body-sm"
          />
          <SmallButton type="submit">{url.trim() ? 'Aplicar' : 'Quitar'}</SmallButton>
          <SmallButton onClick={() => setLinking(false)}>Cancelar</SmallButton>
        </form>
      )}
      {error && (
        <p role="alert" className="w-full px-1 pt-1 text-label-sm text-error">
          {error}
        </p>
      )}
    </>
  );
}

function Tool({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // no quitar el foco (ni la selección) del texto
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md disabled:opacity-40 ${
        active ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-surface-cream-alt'
      } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary`}
    >
      <Icon name={icon} className="text-[20px]" />
    </button>
  );
}

const Sep = () => <span aria-hidden="true" className="mx-1 h-5 w-px bg-border-subtle" />;

function SmallButton({
  children,
  type = 'button',
  onClick,
}: {
  children: ReactNode;
  type?: 'button' | 'submit';
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="h-8 rounded-md border border-border-subtle px-3 text-label-sm font-semibold text-on-surface hover:bg-surface-cream-alt"
    >
      {children}
    </button>
  );
}
