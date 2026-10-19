import { createContext, useContext, useEffect } from 'react';
import { applyHead, type PageMeta } from '@/shared/seo';

/** En el prerender, la página deja aquí sus metadatos para inyectarlos en <head>. */
export const HeadCollectorContext = createContext<((meta: PageMeta) => void) | null>(null);

export function useDocumentMetadata(meta: PageMeta): void {
  useContext(HeadCollectorContext)?.(meta);

  const { title, description, path, noindex, type, image } = meta;
  useEffect(() => {
    applyHead({ title, description, path, noindex, type, image });
  }, [title, description, path, noindex, type, image]);
}
