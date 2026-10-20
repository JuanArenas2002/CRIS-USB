import { useState } from 'react';

// Token compartido por las vistas ocultas de administración (/admin/fotos, /admin/centros, /admin/ranking).
const TOKEN_KEY = 'cris-admin-token';

/** Tolera pegar la línea completa del .env (`CRIS_ADMIN_TOKEN=…`), comillas o espacios. */
export const cleanToken = (raw: string) =>
  raw
    .trim()
    .replace(/^CRIS_ADMIN_TOKEN\s*=\s*/, '')
    .replace(/^["']|["']$/g, '')
    .trim();

const readToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
};

/** El token vive solo en esta pestaña (sessionStorage) y se olvida si el servidor lo rechaza. */
export function useAdminToken() {
  const [token, setToken] = useState(readToken);
  const [error, setError] = useState('');

  const save = (draft: string) => {
    const t = cleanToken(draft);
    setToken(t);
    setError('');
    try {
      sessionStorage.setItem(TOKEN_KEY, t);
    } catch {
      /* sin almacenamiento: el token vive en memoria */
    }
  };
  const clear = (reason = '') => {
    setToken('');
    setError(reason);
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* nada que borrar */
    }
  };
  const rejected = () =>
    clear('El servidor rechazó el token. Pega solo el valor que va después de CRIS_ADMIN_TOKEN=.');

  return { token, error, save, clear, rejected };
}

export function AdminTokenForm({ error, onSubmit }: { error: string; onSubmit: (draft: string) => void }) {
  const [draft, setDraft] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(draft);
      }}
      className="mt-8 flex max-w-md flex-col gap-3 rounded-xl bg-surface-container-lowest p-6 shadow-sm"
    >
      <label htmlFor="admin-token" className="text-label-md font-semibold text-on-surface">
        Token de administración
      </label>
      <input
        id="admin-token"
        type="password"
        autoComplete="off"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby="admin-token-help"
        className="h-11 rounded-lg bg-canvas-cream px-3 text-body-sm focus:ring-2 focus:ring-secondary focus:outline-none"
      />
      <p id="admin-token-help" className={`text-label-sm ${error ? 'text-error' : 'text-neutral-muted'}`}>
        {error || 'Es el valor de CRIS_ADMIN_TOKEN en el archivo .env del servidor.'}
      </p>
      <button
        type="submit"
        disabled={!draft.trim()}
        className="h-11 rounded-lg bg-primary text-label-md font-semibold text-on-primary hover:bg-secondary disabled:opacity-50"
      >
        Continuar
      </button>
    </form>
  );
}
