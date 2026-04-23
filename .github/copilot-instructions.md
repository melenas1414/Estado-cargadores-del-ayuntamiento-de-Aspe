# Instrucciones de rutas y SEO del proyecto

- Mantener siempre URLs amigables para navegación principal: `/`, `/mapa`, `/inteligencia`, `/diagnostico`.
- No reintroducir parámetros de query para el estado de pestañas (`?tab=` o similares).
- Mantener `/` como ruta canónica de "Resumen".
- Mantener redirección permanente 301 de `/resumen` hacia `/`.
- Cuando se añadan o cambien secciones del dashboard, actualizar:
  - `server/routes/sitemap.xml.ts`
  - `server/routes/sitemap-pages.xml.ts`
  - reglas SEO/canonical relacionadas en `app/pages/index.vue` y `nuxt.config.ts`.
- Evitar crear rutas duplicadas que representen la misma vista.
- No hacer despliegues manuales: el despliegue lo gestiona GitHub Actions automáticamente.
