import { useContext, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import { displayName, initials, type Author } from '@/domain/authors/author';
import { currentAffiliation, normalizeOrcid, orcidUrl, type OrcidAffiliation } from '@/domain/orcid/orcid';
import { ApiError } from '@/infrastructure/http/api-client';
import type { NewsPerson } from '@/infrastructure/news/news-api';
import { orcidClient } from '@/infrastructure/orcid/orcid-client';
import { Icon } from '@/presentation/components/ui/Icon';
import { AuthorQueriesContext } from '@/presentation/hooks/use-authors';
import { useDebounce } from '@/presentation/hooks/use-debounce';
import { useOrcidProfile } from '@/presentation/hooks/use-orcid';
import { withBaseUrl } from '@/shared/base';
import { useCatalogs } from './queries';
import { Button, Card } from './ui';

/**
 * Personas de la noticia. Se busca a la persona por su NOMBRE (investigadores de la universidad primero,
 * luego cualquier persona en ORCID) o se pega su ORCID; al elegirla se confirman su tipo y su papel.
 * Solo se guarda el ORCID iD: nombre, foto y cargo se leen del directorio y del perfil público.
 */

interface Candidate {
  orcid: string;
  name: string;
  subtitle: string | null;
  photoUrl: string | null;
  source: 'institution' | 'orcid';
}

const MIN_CHARS = 3;
const DEFAULT_TYPE = 'researcher';
const DEFAULT_ROLE = 'protagonist';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const affiliationText = (a: OrcidAffiliation | null) =>
  a ? [a.role, a.organization].filter(Boolean).join(' · ') : null;

/** Directorio de investigadores de la universidad (ya cacheado por el portal), indexado por ORCID. */
function useDirectory() {
  const queries = useContext(AuthorQueriesContext);
  const all = useQuery({ ...queries!.all(), enabled: !!queries });
  return useMemo(() => {
    const byOrcid = new Map<string, Author>();
    for (const a of all.data ?? []) {
      const orcid = normalizeOrcid(a.orcid);
      if (orcid) byOrcid.set(orcid, a);
    }
    return { byOrcid, loading: all.isPending };
  }, [all.data, all.isPending]);
}

const fromAuthor = (a: Author, orcid: string): Candidate => ({
  orcid,
  name: displayName(a.name),
  subtitle: [a.degree, a.mainGroup?.name].filter(Boolean).join(' · ') || 'Investigador de la universidad',
  photoUrl: a.photoUrl ? withBaseUrl(a.photoUrl) : null,
  source: 'institution',
});

function Avatar({
  name,
  photoUrl,
  size = 'md',
}: {
  name: string;
  photoUrl: string | null;
  size?: 'md' | 'lg';
}) {
  const box = size === 'lg' ? 'h-14 w-14 text-body-md' : 'h-10 w-10 text-label-md';
  return photoUrl ? (
    <img src={photoUrl} alt="" className={`${box} shrink-0 rounded-full object-cover`} />
  ) : (
    <span
      aria-hidden="true"
      className={`${box} flex shrink-0 items-center justify-center rounded-full bg-badge-sage-bg font-bold text-primary-container`}
    >
      {initials(name) || 'iD'}
    </span>
  );
}

const OrcidBadge = ({ orcid }: { orcid: string }) => (
  <a
    href={orcidUrl(orcid)}
    target="_blank"
    rel="noopener noreferrer"
    onClick={(e) => e.stopPropagation()}
    className="inline-flex items-center gap-1 text-label-sm text-on-surface-variant hover:text-primary-container hover:underline"
  >
    <span
      aria-hidden="true"
      className="flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-[8px] font-bold text-white"
    >
      iD
    </span>
    {orcid}
  </a>
);

export function PeopleCard({
  people,
  onChange,
}: {
  people: NewsPerson[];
  onChange: (p: NewsPerson[]) => void;
}) {
  const catalogs = useCatalogs();
  const directory = useDirectory();
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [notice, setNotice] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const label = (list: { code: string; name: string }[] | undefined, code: string) =>
    list?.find((i) => i.code === code)?.name ?? code;

  const add = (person: NewsPerson, name: string) => {
    onChange([...people, person]);
    setSelected(null);
    setNotice(
      `${name} se agregó como ${label(catalogs.data?.relationship_types, person.relationship_type).toLowerCase()}.`,
    );
    requestAnimationFrame(() => searchRef.current?.focus()); // listo para agregar a otra persona
  };

  return (
    <Card
      title="Personas de la noticia"
      actions={
        people.length > 0 && (
          <span className="text-label-sm text-neutral-muted">
            {people.length} {people.length === 1 ? 'persona' : 'personas'}
          </span>
        )
      }
    >
      <p className="mb-4 text-label-sm text-neutral-muted">
        Opcional. Investigadores, estudiantes o invitados que aparecen en la noticia. Se identifican por su
        ORCID iD.
      </p>

      {people.length > 0 && (
        <ul className="mb-5 flex flex-col gap-2">
          {people.map((p, i) => (
            <PersonRow
              key={`${p.orcid}-${p.relationship_type}-${p.person_type}`}
              person={p}
              directory={directory.byOrcid}
              typeLabel={label(catalogs.data?.person_types, p.person_type)}
              roles={catalogs.data?.relationship_types ?? []}
              onRole={(relationship_type) =>
                onChange(people.map((x, j) => (j === i ? { ...x, relationship_type } : x)))
              }
              onRemove={() => {
                onChange(people.filter((_, j) => j !== i));
                setNotice('Persona quitada de la noticia.');
              }}
            />
          ))}
        </ul>
      )}

      {selected ? (
        <ConfirmPerson
          candidate={selected}
          people={people}
          onAdd={add}
          onCancel={() => {
            setSelected(null);
            requestAnimationFrame(() => searchRef.current?.focus());
          }}
        />
      ) : (
        <PersonSearch
          inputRef={searchRef}
          directory={directory.byOrcid}
          addedOrcids={new Set(people.map((p) => p.orcid))}
          onPick={(c) => {
            setNotice('');
            setSelected(c);
          }}
        />
      )}
      <p className="mt-2 min-h-5 text-label-sm text-secondary" role="status" aria-live="polite">
        {notice}
      </p>
    </Card>
  );
}

function PersonSearch({
  inputRef,
  directory,
  addedOrcids,
  onPick,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  directory: Map<string, Author>;
  addedOrcids: Set<string>;
  onPick: (c: Candidate) => void;
}) {
  const listId = useId();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const debounced = useDebounce(term.trim(), 300);
  const asOrcid = normalizeOrcid(term);
  const searchable = !asOrcid && debounced.replace(/\s/g, '').length >= MIN_CHARS;

  const direct = useOrcidProfile(asOrcid);
  const remote = useQuery({
    queryKey: ['orcid-search', norm(debounced)],
    queryFn: ({ signal }) => orcidClient.search(debounced, signal),
    enabled: searchable,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const institutional = useMemo(() => {
    if (!searchable) return [];
    const words = norm(debounced).split(/\s+/).filter(Boolean);
    return [...directory.entries()]
      .filter(([, a]) => words.every((w) => norm(a.name).includes(w)))
      .slice(0, 6)
      .map(([orcid, a]) => fromAuthor(a, orcid));
  }, [directory, debounced, searchable]);

  const external: Candidate[] = (remote.data ?? [])
    .map((h) => ({ ...h, orcid: normalizeOrcid(h.orcid) }))
    .filter((h): h is typeof h & { orcid: string } => !!h.orcid && !directory.has(h.orcid))
    .map((h) => ({
      orcid: h.orcid,
      name: h.name,
      subtitle: h.institutions.join(' · ') || null,
      photoUrl: null,
      source: 'orcid',
    }));

  const directCandidate: Candidate | null = asOrcid
    ? directory.has(asOrcid)
      ? fromAuthor(directory.get(asOrcid)!, asOrcid)
      : direct.data
        ? {
            orcid: asOrcid,
            name: direct.data.displayName,
            subtitle: affiliationText(currentAffiliation(direct.data)),
            photoUrl: null,
            source: 'orcid',
          }
        : null
    : null;
  const options = asOrcid ? (directCandidate ? [directCandidate] : []) : [...institutional, ...external];
  const showList = open && term.trim().length > 0;
  const pick = (c: Candidate | undefined) => {
    if (!c || addedOrcids.has(c.orcid)) return;
    onPick(c);
    setTerm('');
    setOpen(false);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      if (options.length)
        setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(options[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const status = (() => {
    if (asOrcid)
      return direct.isPending && !directory.has(asOrcid)
        ? 'Buscando ese ORCID…'
        : !directCandidate && direct.error instanceof ApiError && direct.error.status === 404
          ? 'No existe un perfil público en ORCID con ese iD.'
          : null;
    if (term.trim() && normalizeOrcid(term) === null && /^[\d\s-]{6,}[\dxX]?$/.test(term.trim()))
      return 'Parece un ORCID pero no es válido: revisa los 16 caracteres (el último puede ser X).';
    if (term.trim().replace(/\s/g, '').length < MIN_CHARS)
      return term.trim() ? `Escribe al menos ${MIN_CHARS} letras.` : null;
    if (debounced !== term.trim() || remote.isFetching) return options.length ? null : 'Buscando…';
    if (!options.length)
      return remote.isError
        ? 'No se pudo consultar ORCID ahora. Si conoces su ORCID iD, pégalo aquí.'
        : 'Sin resultados. Prueba con nombre y apellido, o pega su ORCID iD.';
    return null;
  })();

  const group = (title: string, items: Candidate[], offset = 0) =>
    items.length > 0 && (
      <li role="presentation">
        <p
          aria-hidden="true"
          className="px-3 pt-2 pb-1 text-label-sm font-bold tracking-wider text-neutral-muted uppercase"
        >
          {title}
        </p>
        <ul role="group" aria-label={title}>
          {items.map((c, k) => {
            const i = offset + k;
            const added = addedOrcids.has(c.orcid);
            return (
              <li
                key={c.orcid}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                aria-disabled={added}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(c)}
                className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${i === active ? 'bg-surface-cream-alt' : ''} ${added ? 'cursor-default opacity-60' : ''}`}
              >
                <Avatar name={c.name} photoUrl={c.photoUrl} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-sm font-semibold text-on-surface">{c.name}</span>
                  {c.subtitle && (
                    <span className="block truncate text-label-sm text-on-surface-variant">{c.subtitle}</span>
                  )}
                  <span className="block text-label-sm text-neutral-muted">{c.orcid}</span>
                </span>
                {added ? (
                  <span className="text-label-sm text-neutral-muted">Ya agregada</span>
                ) : (
                  c.source === 'institution' && (
                    <span className="rounded-full bg-badge-sage-bg px-2 py-0.5 text-label-sm text-badge-sage-text">
                      Universidad
                    </span>
                  )
                )}
              </li>
            );
          })}
        </ul>
      </li>
    );

  return (
    <div className="relative">
      <label htmlFor={`${listId}-input`} className="text-label-md font-semibold text-on-surface">
        Agregar persona
      </label>
      <div className="relative mt-1">
        <Icon
          name="person_search"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[20px] text-neutral-muted"
        />
        <input
          ref={inputRef}
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && options[active] ? optionId(active) : undefined}
          autoComplete="off"
          spellCheck={false}
          value={term}
          placeholder="Busca por nombre o pega su ORCID iD"
          onChange={(e) => {
            setTerm(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="h-12 w-full rounded-lg border border-border-subtle bg-surface-container-lowest pr-3 pl-10 text-body-sm focus:ring-2 focus:ring-secondary focus:outline-none"
        />
      </div>
      <p className="mt-1 text-label-sm text-neutral-muted">
        Primero aparecen los investigadores de la universidad; después, otras personas registradas en ORCID.
      </p>
      {showList && (options.length > 0 || status) && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border-subtle bg-surface-container-lowest shadow-xl">
          {options.length > 0 && (
            <ul
              id={listId}
              role="listbox"
              aria-label="Personas encontradas"
              className="max-h-80 overflow-y-auto pb-1"
            >
              {asOrcid ? (
                group('Por ORCID iD', options)
              ) : (
                <>
                  {group('Investigadores de la universidad', institutional)}
                  {group('Otras personas en ORCID', external, institutional.length)}
                </>
              )}
            </ul>
          )}
          {status && (
            <p className="px-3 py-3 text-label-sm text-on-surface-variant" role="status">
              {status}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ConfirmPerson({
  candidate,
  people,
  onAdd,
  onCancel,
}: {
  candidate: Candidate;
  people: NewsPerson[];
  onAdd: (p: NewsPerson, name: string) => void;
  onCancel: () => void;
}) {
  const catalogs = useCatalogs();
  const profile = useOrcidProfile(candidate.orcid);
  const [type, setType] = useState(DEFAULT_TYPE);
  const [role, setRole] = useState(DEFAULT_ROLE);
  const current = profile.data ? affiliationText(currentAffiliation(profile.data)) : null;
  const notFound = profile.error instanceof ApiError && profile.error.status === 404;
  const duplicate = people.some((p) => p.orcid === candidate.orcid && p.relationship_type === role);

  return (
    <div className="rounded-xl border-2 border-secondary/40 bg-badge-sage-bg/30 p-4">
      <div className="flex items-start gap-3">
        <Avatar name={candidate.name} photoUrl={candidate.photoUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-body-md font-bold text-on-surface">
            {profile.data?.displayName ?? candidate.name}
          </p>
          {(current ?? candidate.subtitle) && (
            <p className="text-body-sm text-on-surface-variant">{current ?? candidate.subtitle}</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <OrcidBadge orcid={candidate.orcid} />
            {profile.data && <span className="text-label-sm text-secondary">✓ Perfil ORCID verificado</span>}
            {notFound && <span className="text-label-sm text-error">Este ORCID no tiene perfil público</span>}
          </div>
        </div>
      </div>

      <ChoiceGroup
        label="¿Quién es?"
        options={catalogs.data?.person_types ?? []}
        value={type}
        onChange={setType}
      />
      <ChoiceGroup
        label="¿Qué papel tiene en la noticia?"
        options={catalogs.data?.relationship_types ?? []}
        value={role}
        onChange={setRole}
      />

      {duplicate && (
        <p className="mt-3 text-label-sm text-error">Esta persona ya está en la noticia con ese papel.</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={duplicate || notFound}
          className="inline-flex items-center gap-1"
          onClick={() =>
            onAdd(
              { person_type: type, orcid: candidate.orcid, relationship_type: role },
              profile.data?.displayName ?? candidate.name,
            )
          }
        >
          <Icon name="add" className="text-[18px]" /> Agregar a la noticia
        </Button>
        <Button onClick={onCancel}>Elegir otra persona</Button>
      </div>
    </div>
  );
}

/** Opciones visibles de un vistazo (en vez de un desplegable): un clic para elegir. */
function ChoiceGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { code: string; name: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const name = useId();
  return (
    <fieldset className="mt-4">
      <legend className="mb-2 text-label-md font-semibold text-on-surface">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.code}
            className={`cursor-pointer rounded-full border px-3 py-1.5 text-label-md transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-secondary ${
              value === o.code
                ? 'border-primary bg-primary text-on-primary'
                : 'border-border-subtle bg-surface-container-lowest text-on-surface hover:bg-surface-cream-alt'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={o.code}
              checked={value === o.code}
              onChange={() => onChange(o.code)}
              className="sr-only"
            />
            {o.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function PersonRow({
  person,
  directory,
  typeLabel,
  roles,
  onRole,
  onRemove,
}: {
  person: NewsPerson;
  directory: Map<string, Author>;
  typeLabel: string;
  roles: { code: string; name: string }[];
  onRole: (code: string) => void;
  onRemove: () => void;
}) {
  const author = directory.get(person.orcid);
  const profile = useOrcidProfile(person.orcid);
  const name = author
    ? displayName(author.name)
    : (profile.data?.displayName ?? (profile.isPending ? 'Cargando…' : person.orcid));
  const detail =
    (profile.data && affiliationText(currentAffiliation(profile.data))) ?? author?.mainGroup?.name ?? null;
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-border-subtle bg-surface-container-lowest px-3 py-2.5">
      <Avatar name={name} photoUrl={author?.photoUrl ? withBaseUrl(author.photoUrl) : null} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-sm font-semibold text-on-surface">{name}</span>
        <span className="block truncate text-label-sm text-on-surface-variant">
          {[typeLabel, detail].filter(Boolean).join(' · ')}
        </span>
        <OrcidBadge orcid={person.orcid} />
      </span>
      <select
        aria-label={`Papel de ${name}`}
        value={person.relationship_type}
        onChange={(e) => onRole(e.target.value)}
        className="h-9 rounded-lg border border-border-subtle bg-surface-container-lowest px-2 text-label-md"
      >
        {roles.map((r) => (
          <option key={r.code} value={r.code}>
            {r.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label={`Quitar a ${name}`}
        onClick={onRemove}
        className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-error/10 hover:text-error"
      >
        <Icon name="close" className="text-[18px]" />
      </button>
    </li>
  );
}
