// Descarga a public/fonts la fuente de Material Symbols con solo los íconos de icon_names (index.html).
import fs from 'node:fs';

const url = /https:\/\/fonts\.googleapis\.com\/css2\?family=Material\+Symbols[^\s"]+/.exec(
  fs.readFileSync('index.html', 'utf8'),
)[0];
// Con un User-Agent de Chrome moderno Google entrega woff2.
const css = await (
  await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',
    },
  })
).text();
const font = /url\((\S+?)\) format\('woff2'\)/.exec(css)?.[1];
if (!font) throw new Error(`Google Fonts no devolvió woff2:\n${css}`);
fs.mkdirSync('public/fonts', { recursive: true });
fs.writeFileSync('public/fonts/material-symbols.woff2', Buffer.from(await (await fetch(font)).arrayBuffer()));
console.log('public/fonts/material-symbols.woff2 actualizado');
