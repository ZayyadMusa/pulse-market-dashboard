import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
const manifest = await readFile(path.join(root, 'lib/client-assets.ts'), 'utf8');
const boot = manifest.match(/boot:\s*"([^"]+)"/)?.[1];
const css = manifest.match(/css:\s*"([^"]+)"/)?.[1];
if (!boot || !css) throw new Error('Build the Pulse client before deploying.');
for (const asset of [boot, css]) await readFile(path.join(root, 'public', asset));

await rm(output, {recursive: true, force: true});
await mkdir(output, {recursive: true});
await cp(path.join(root, 'public'), output, {recursive: true});
const document = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#17191c"><title>Pulse — Crypto &amp; FX</title><meta name="description" content="Follow crypto prices, explore charts and convert currencies."><link rel="icon" href="/favicon.svg"><link rel="preload" href="/fonts/jakarta.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="${css}"><script defer src="${boot}"></script></head><body><div id="pulse-root"><main class="app-loading"><img src="/favicon.svg" width="42" height="42" alt="Pulse"><h1>Opening your market desk…</h1><p>Loading prices and currency tools.</p></main></div><noscript><p>Enable JavaScript to use the market tools and converter.</p></noscript></body></html>`;
await writeFile(path.join(output, 'index.html'), document);
await writeFile(path.join(output, '404.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found — Pulse</title><h1>Page not found</h1><p><a href="/">Return to Pulse markets</a></p></html>');
console.log('Built Pulse for Vercel using the bundled client assets.');
