export default defineEventHandler((event) => {
  const runtimeConfig = useRuntimeConfig(event);
  const siteUrl = (runtimeConfig.public.siteUrl || 'https://cargadores-aspe.onlineexpansions.com').replace(/\/+$/, '');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${siteUrl}/sitemap-pages.xml</loc>
  </sitemap>
</sitemapindex>`;

  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
  return xml;
});
