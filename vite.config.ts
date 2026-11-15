import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function normalizeBase(raw: string | undefined): string {
  if (!raw || raw === './' || raw === '.') return './';
  let base = raw.trim();
  if (!base.startsWith('/')) base = `/${base}`;
  if (!base.endsWith('/')) base = `${base}/`;
  return base;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

function emitServiceWorker(): Plugin {
  return {
    name: 'spotter-service-worker',
    apply: 'build',
    closeBundle() {
      const dist = join(process.cwd(), 'dist');
      const files = walk(dist)
        .map((file) => relative(dist, file).split('\\').join('/'))
        .filter((file) => file !== 'sw.js' && !file.split('/').some((part) => part.startsWith('_')))
        .sort();
      const hash = createHash('sha256');
      for (const file of files) {
        hash.update(file);
        hash.update(readFileSync(join(dist, file)));
      }
      const cache = `spotter-${hash.digest('hex').slice(0, 12)}`;
      const assets = ["'./'", ...files.map((file) => `'./${file}'`)];
      const unique = [...new Set(assets)];
      const source = `/* Generated at build time. Do not edit. */
const CACHE = '${cache}';
const ASSETS = [
  ${unique.join(',\n  ')}
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          const cache = await caches.open(CACHE);
          cache.put(event.request, response.clone());
        }
        return response;
      } catch (error) {
        if (event.request.mode === 'navigate') {
          const fallback = (await caches.match('./index.html')) || (await caches.match('./'));
          if (fallback) return fallback;
        }
        throw error;
      }
    })(),
  );
});
`;
      writeFileSync(join(dist, 'sw.js'), source);
    },
  };
}

export default defineConfig({
  base: normalizeBase(process.env.VITE_BASE),
  plugins: [react(), emitServiceWorker()],
});
