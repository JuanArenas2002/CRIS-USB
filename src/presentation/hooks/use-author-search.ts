import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { DirectoryFilters } from '@/application/authors/author-queries';
import { AUTHOR_CATEGORIES, type AuthorCategoryId } from '@/domain/authors/author';
import { useDebounce } from './use-debounce';

/** Filtros del directorio en la URL (?q=&cat=&grupo=&page=): compartibles y con atrás/adelante. */
export function useAuthorSearch() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const catParam = params.get('cat');
  const category = AUTHOR_CATEGORIES.some((c) => c.id === catParam)
    ? (catParam as AuthorCategoryId)
    : undefined;
  const groupId = Number(params.get('grupo')) || undefined;
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);

  // ponytail: el input no se resincroniza si la URL cambia por atrás/adelante; añadirlo si molesta.
  const [term, setTerm] = useState(q);
  const debouncedTerm = useDebounce(term);

  const update = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        return next;
      },
      { replace: true },
    );

  useEffect(() => {
    if (debouncedTerm.trim() !== q) update({ q: debouncedTerm.trim() || null, page: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo reacciona al texto escrito
  }, [debouncedTerm]);

  const filters: DirectoryFilters = { search: q, category, groupId, page };

  return {
    term,
    setTerm,
    category,
    setCategory: (v: AuthorCategoryId | undefined) => update({ cat: v ?? null, page: null }),
    groupId,
    setGroupId: (v: number | undefined) => update({ grupo: v ? String(v) : null, page: null }),
    filters,
    hasActiveFilters: Boolean(q || category || groupId),
    isFiltered: params.size > 0,
    reset: () => {
      setTerm('');
      setParams({}, { replace: true });
    },
  };
}
