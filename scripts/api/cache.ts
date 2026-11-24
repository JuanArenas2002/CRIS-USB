const TTL_MS = 10 * 60 * 1000;

/**
 * Caché con respaldo: si la fuente falla, se sirve la última copia buena.
 * ponytail: en memoria de un solo proceso; basta para ~600 investigadores y ~50 grupos.
 */
export function cached<T>(load: () => Promise<T>) {
  let entry: { at: number; data: T } | null = null;
  const get = async (): Promise<T> => {
    if (entry && Date.now() - entry.at < TTL_MS) return entry.data;
    try {
      entry = { at: Date.now(), data: await load() };
    } catch (err) {
      if (!entry) throw err;
    }
    return entry.data;
  };
  /** Tras escribir en Metri-K: la próxima lectura va a la fuente. */
  return Object.assign(get, { reset: () => void (entry = null) });
}

export type Cached<T> = ReturnType<typeof cached<T>>;

/**
 * Una caché por clave (persona, grupo, año…), creada al primer uso. Con `max`, al pasarlo se descarta la
 * entrada más antigua (orden de inserción).
 */
export function cachedByKey<K, T>(load: (key: K) => Promise<T>, max?: number) {
  const entries = new Map<K, Cached<T>>();
  return (key: K): Promise<T> => {
    let entry = entries.get(key);
    if (!entry) {
      entry = cached(() => load(key));
      entries.set(key, entry);
      if (max !== undefined && entries.size > max) entries.delete(entries.keys().next().value!);
    }
    return entry();
  };
}
