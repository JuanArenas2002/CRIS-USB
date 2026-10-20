// Lector mínimo de .xlsx en el navegador, sin dependencias: un .xlsx es un ZIP de XML.
// - ZIP: directorio central + DecompressionStream('deflate-raw') (nativo en navegadores y Node).
// - XML: expresiones regulares sobre el formato que escribe Excel (celdas <c>, textos compartidos).
// ponytail: no entiende fórmulas sin valor guardado ni fechas con formato; el ranking solo trae
// textos y números. Si hace falta más, usar SheetJS.

const u16 = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8);
const u32 = (b: Uint8Array, o: number) => (u16(b, o) | (u16(b, o + 2) << 16)) >>> 0;

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Archivos del ZIP por nombre; cada uno se descomprime solo cuando se lee. */
function unzip(zip: Uint8Array): Map<string, () => Promise<string>> {
  let eocd = zip.length - 22;
  while (eocd >= 0 && u32(zip, eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('El archivo no es un Excel (.xlsx) válido');
  const files = new Map<string, () => Promise<string>>();
  const text = new TextDecoder();
  let p = u32(zip, eocd + 16);
  for (let i = 0, n = u16(zip, eocd + 10); i < n && u32(zip, p) === 0x02014b50; i++) {
    const method = u16(zip, p + 10);
    const size = u32(zip, p + 20);
    const nameLen = u16(zip, p + 28);
    const local = u32(zip, p + 42);
    const name = text.decode(zip.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + u16(zip, p + 30) + u16(zip, p + 32);
    files.set(name, async () => {
      const start = local + 30 + u16(zip, local + 26) + u16(zip, local + 28);
      const raw = zip.subarray(start, start + size);
      return text.decode(method === 0 ? raw : await inflate(raw));
    });
  }
  return files;
}

const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

const attrs = (tag: string) =>
  Object.fromEntries([...tag.matchAll(/([\w:]+)="([^"]*)"/g)].map((m) => [m[1]!, decode(m[2]!)]));

/** Todo el texto de los <t> dentro de un fragmento (texto enriquecido incluido). */
const texts = (xml: string) =>
  [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1]!)).join('');

/** "AB12" → 27 (columna base 0). */
const column = (ref: string) =>
  [...ref.replace(/\d+$/, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

/**
 * Filas de una hoja como texto (celdas vacías = ""). `sheet` es el nombre de la pestaña; si no
 * existe, se lee la primera.
 */
export async function readXlsxSheet(file: Blob, sheet: string): Promise<string[][]> {
  const files = unzip(new Uint8Array(await file.arrayBuffer()));
  const read = async (name: string) => {
    const f = files.get(name);
    if (!f) throw new Error(`Falta ${name} dentro del Excel`);
    return f();
  };
  const workbook = await read('xl/workbook.xml');
  const sheets = [...workbook.matchAll(/<sheet\b[^>]*>/g)].map((m) => attrs(m[0]));
  const target = sheets.find((s) => s.name === sheet) ?? sheets[0];
  if (!target) throw new Error('El Excel no tiene hojas');
  const rels = [...(await read('xl/_rels/workbook.xml.rels')).matchAll(/<Relationship\b[^>]*>/g)].map((m) =>
    attrs(m[0]),
  );
  const href = rels.find((r) => r.Id === target['r:id'])?.Target;
  if (!href) throw new Error(`No se encontró la hoja ${target.name}`);
  const path = href.startsWith('/') ? href.slice(1) : `xl/${href}`;

  const shared = files.has('xl/sharedStrings.xml')
    ? [...(await read('xl/sharedStrings.xml')).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) =>
        texts(m[1]!),
      )
    : [];

  const rows: string[][] = [];
  for (const row of (await read(path)).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const c of row[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const a = attrs(c[1]!);
      const inner = c[2] ?? '';
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      const value =
        a.t === 's'
          ? (shared[Number(v)] ?? '')
          : a.t === 'inlineStr'
            ? texts(inner)
            : v !== undefined
              ? decode(v)
              : '';
      const i = a.r ? column(a.r) : cells.length;
      while (cells.length < i) cells.push('');
      cells[i] = value.trim();
    }
    rows.push(cells);
  }
  return rows;
}
