import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

const root = process.cwd();
const indexPath = resolve(root, 'app/pages/index.vue');
const nuxtConfigPath = resolve(root, 'nuxt.config.ts');
const sitemapIndexPath = resolve(root, 'server/routes/sitemap.xml.ts');
const sitemapPagesPath = resolve(root, 'server/routes/sitemap-pages.xml.ts');

const indexContent = readFileSync(indexPath, 'utf8');
const nuxtConfigContent = readFileSync(nuxtConfigPath, 'utf8');
const sitemapIndexContent = readFileSync(sitemapIndexPath, 'utf8');
const sitemapPagesContent = readFileSync(sitemapPagesPath, 'utf8');

if (/\?tab\s*=/.test(indexContent)) {
  fail('Se detecto uso de query param ?tab= en app/pages/index.vue. Usa rutas friendly.');
}

if (!/resumen\s*:\s*'\/'/.test(indexContent)) {
  fail("TAB_PATHS.resumen debe apuntar a '/'.");
}

if (!/alias:\s*\[\s*'\/mapa'\s*,\s*'\/inteligencia'\s*,\s*'\/diagnostico'\s*\]/.test(indexContent)) {
  fail("definePageMeta.alias debe contener solo ['/mapa', '/inteligencia', '/diagnostico'].");
}

if (!/PATH_TO_TAB[\s\S]*'\/resumen'\s*:\s*'resumen'/.test(indexContent)) {
  fail("PATH_TO_TAB debe mantener compatibilidad de lectura para '/resumen'.");
}

if (!/['"]\/resumen['"]\s*:\s*\{\s*redirect\s*:\s*\{\s*to\s*:\s*['"]\/['"]\s*,\s*statusCode\s*:\s*301\s*\}\s*\}/.test(nuxtConfigContent)) {
  fail("Falta la redireccion 301 de '/resumen' a '/' en nuxt.config.ts routeRules.");
}

if (!/\$\{siteUrl\}\/sitemap-pages\.xml/.test(sitemapIndexContent)) {
  fail("server/routes/sitemap.xml.ts debe apuntar al sitemap de paginas en '/sitemap-pages.xml'.");
}

if (!/const\s+paths\s*=\s*\['\/',\s*'\/mapa',\s*'\/inteligencia',\s*'\/diagnostico'\]/.test(sitemapPagesContent)) {
  fail("server/routes/sitemap-pages.xml.ts debe contener exactamente ['/', '/mapa', '/inteligencia', '/diagnostico'].");
}

console.log('OK: Friendly routes, redirect and sitemap checks passed.');
