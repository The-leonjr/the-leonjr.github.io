// After `vite build`: give every project its own HTML file with the right title and
// link-preview tags, and add a 404.html so unknown URLs still load the app.
import fs from 'node:fs';
import path from 'node:path';
import { projects, site } from '../src/data/projects.js';

// Output folder: `dist` by default, or the one passed in (e.g. `node scripts/spa-fallback.mjs dist-next`).
const dist = path.resolve(process.argv[2] || 'dist');
const base = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function withMeta(html, { title, description, url, image }) {
  return html
    .replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(description)}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(title)}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${esc(description)}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${url}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${url}`)
    .replace(/(<meta property="og:image" content=")[^"]*/, `$1${image}`);
}

for (const p of projects) {
  const dir = path.join(dist, 'work', p.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    withMeta(base, {
      title: `${p.name} · ${site.name}`,
      description: p.hook,
      url: `${site.url}/work/${p.id}/`,
      image: `${site.url}${p.cover.replace('.webp', '.jpg')}`,
    }),
  );
}

fs.writeFileSync(
  path.join(dist, '404.html'),
  withMeta(base, {
    title: `Page not found · ${site.name}`,
    description: 'Nothing lives at this address.',
    url: `${site.url}/`,
    image: `${site.url}/og.jpg`,
  }).replace('</head>', '  <meta name="robots" content="noindex" />\n  </head>'),
);
console.log(`Wrote ${projects.length} project pages and 404.html`);
