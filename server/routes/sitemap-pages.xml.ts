export default defineEventHandler((event) => {
  const runtimeConfig = useRuntimeConfig(event);
  const siteUrl = (runtimeConfig.public.siteUrl || 'https://cargadores-aspe.onlineexpansions.com').replace(/\/+$/, '');
  const lastmod = new Date().toISOString();

  const paths = [
    '/',
    '/mapa',
    '/inteligencia',
    '/diagnostico',
    '/cargar-coche-electrico-aspe',
    '/cargadores-gratis-aspe',
    '/mejores-puntos-recarga-alicante',
    '/mapa-ev-aspe-tiempo-real',
    '/charger/ESIBE22E0001001',
    '/charger/ESIBE22E0001002',
    '/charger/ESIBE22E0001003',
    '/charger/ESIBE22E0001004',
    '/charger/ESIBE22E0001005',
  ];

  const urls = paths
    .map((path) => {
      const loc = path === '/' ? siteUrl : `${siteUrl}${path}`;
      return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>hourly</changefreq>\n    <priority>${path === '/' ? '1.0' : '0.8'}</priority>\n  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
  return xml;
});
