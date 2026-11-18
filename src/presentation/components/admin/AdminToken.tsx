import { useEffect, useState } from 'react';
import {
  ADMIN_SESSION,
  endAdminSession,
  hasAdminSession,
  startAdminSession,
} from '@/infrastructure/http/admin-session';

// Token compartido por las vistas ocultas de administración (/admin/fotos, /admin/centros, /admin/ranking).
// No se guarda en el navegador: el BFF lo cambia por una cookie de sesión HttpOnly (ver admin-session.ts).

/** Tolera pegar la línea completa del .env (`CRIS_ADMIN_TOKEN=…`), comillas o espacios. */
export const cleanToken = (raw: string) =>
  raw
    .trim()
    .replace(/^CRIS_ADMIN_TOKEN\s*=\s*/, '')
    .replace(/^["']|["']$/g, '')
    .trim();

/**
 * `token` es un marcador NO secreto ('' o ADMIN_SESSION): la credencial real vive en la cookie HttpOnly que
 * pone el servidor. Al montar se comprueba si ya hay sesión (sobrevive a recargas, 8 h).
 */
export function useAdminToken() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    void hasAdminSession().then((ok) => alive && ok && setToken(ADMIN_SESSION));
    return () => void (alive = false);
  }, []);

  const save = async (draft: string) => {
    setError('');
    if (await startAdminSession(cleanToken(draft))) setToken(ADMIN_SESSION);
    else setError('El servidor rechazó el token. Pega solo el valor que va después de CRIS_ADMIN_TOKEN=.');
  };
  const clear = (reason = '') => {
    setToken('');
    setError(reason);
    void endAdminSession();
  };
  const rejected = () => clear('La sesión de administración venció o el token cambió. Vuelve a ingresarlo.');

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
      className="mt-8 flex max-w-md flex-col gap-3 rounded-xl bg-surface-container-lowest p-6 border border-border-subtle"
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
