# Despliegue Directo En Cloudflare (Front + API En El Mismo Proyecto)

Esta guia deja el proyecto funcionando en Cloudflare manteniendo la misma estructura de rutas:

- Frontend SSR: `/`, `/mapa`, `/inteligencia`, `/diagnostico`, etc.
- API Nitro: `/api/*`
- Sitemap: `/sitemap.xml` y `/sitemap-pages.xml`

No hace falta separar frontend y backend en dos repos.

## 1) Requisitos Previos

- Cuenta en Cloudflare.
- Dominio gestionado en Cloudflare (o subdominio temporal `*.pages.dev`).
- Repositorio conectado a GitHub.

## 2) Ajustes Del Proyecto

### 2.1 Preset De Nitro Para Cloudflare

Para build en Cloudflare Pages usa el preset de Nitro en el entorno de build:

- `NITRO_PRESET=cloudflare_pages`

Con esto, Nuxt genera salida compatible con Cloudflare Pages + Functions.

### 2.2 WebSocket Polyfill (importante)

El archivo [server/plugins/websocket-polyfill.ts](server/plugins/websocket-polyfill.ts) importa `ws` (Node). En Cloudflare Workers no se debe usar ese polyfill.

Opciones:

1. Quitar temporalmente ese plugin en despliegue Cloudflare.
2. O convertirlo a import dinamico y ejecutarlo solo en runtime Node.

Si no se adapta, el bundle de Workers puede fallar por dependencias Node.

## 3) Variables De Entorno En Cloudflare

Configura estas variables en el proyecto de Cloudflare Pages:

- `NUXT_PUBLIC_SUPABASE_URL`
- `NUXT_PUBLIC_SUPABASE_KEY`
- `SUPABASE_SERVICE_KEY`
- `NUXT_PUBLIC_SITE_URL`
- `NUXT_PUBLIC_GA_ID` (opcional)
- `CHARGERS_VISIBLE_STATION_IDS` (opcional)

Opcionales solo si usas integracion privada de Iberdrola en runtime:

- `IBERDROLA_API_URL`
- `IBERDROLA_API_KEY`

Nota: las variables sensibles (como `SUPABASE_SERVICE_KEY`) deben ir como secret.

## 4) Despliegue Recomendado Con GitHub Actions

Ya esta creado el workflow:

- [.github/workflows/deploy-cloudflare.yml](.github/workflows/deploy-cloudflare.yml)

Se ejecuta en push a `master/main` y en `workflow_dispatch`.

### Secrets necesarios en GitHub

Configura estos secrets en `Settings -> Secrets and variables -> Actions`:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT_NAME`
- `NUXT_PUBLIC_SUPABASE_URL`
- `NUXT_PUBLIC_SUPABASE_KEY`
- `SUPABASE_SERVICE_KEY`
- `NUXT_PUBLIC_SITE_URL`
- `NUXT_PUBLIC_GA_ID` (opcional)
- `CHARGERS_VISIBLE_STATION_IDS` (opcional)

Opcionales solo si usas integracion privada de Iberdrola en runtime:

- `IBERDROLA_API_URL`
- `IBERDROLA_API_KEY`

### Permisos minimos del token de Cloudflare

Para `CLOUDFLARE_API_TOKEN`:

- `Cloudflare Pages:Edit`
- `Account:Read`

Una vez guardados los secrets, haz push y el deploy sera automatico.

## 5) Despliegue Manual (Cloudflare Pages Con Git)

1. En Cloudflare: `Workers & Pages` -> `Create` -> `Pages` -> `Connect to Git`.
2. Selecciona este repo.
3. Configura build:

- Framework preset: `Nuxt` (si aparece)
- Build command: `npm install && npm run build`
- Build output directory: `.output/public`
- Environment variable: `NITRO_PRESET=cloudflare_pages`

4. Guarda variables de entorno (seccion anterior).
5. Deploy.

Con esto tendras front y API en el mismo proyecto.

## 6) Rutas Y Dominio (igual que ahora)

Despues del deploy:

- Las paginas siguen en sus rutas actuales.
- Los endpoints siguen en `/api/*`.
- Puedes usar un dominio custom unico (ejemplo: `cargadores-aspe.onlineexpansions.com`).

## 7) Cache Y Route Rules

Tus `routeRules` ya estan definidas en [nuxt.config.ts](nuxt.config.ts), incluyendo:

- Redirect 301 de `/resumen` -> `/`
- Header `noindex` en `/admin/**`
- Cache para endpoints `/api/*`

Recomendacion: mantener esas reglas en Nuxt (no duplicarlas manualmente en Pages salvo necesidad concreta).

## 8) Opcion CLI (sin panel)

Si quieres desplegar por CLI:

1. Build local:

```bash
NITRO_PRESET=cloudflare_pages npm run build
```

2. Deploy con Wrangler (proyecto Pages ya creado):

```bash
npx wrangler pages deploy .output/public --project-name estado-cargadores-aspe
```

## 9) Checklist De Verificacion

- `GET /` responde 200.
- `GET /mapa` responde 200.
- `GET /api/chargers/current` responde 200.
- `GET /api/analytics/metrics` responde 200.
- `GET /sitemap.xml` responde 200.
- `GET /resumen` redirige 301 a `/`.

## 10) Troubleshooting Rapido

### Error por modulos Node en Workers

- Revisar [server/plugins/websocket-polyfill.ts](server/plugins/websocket-polyfill.ts).
- Evitar dependencias Node-only en runtime Cloudflare.

### Variables no cargadas

- Confirmar que estan en el entorno correcto (Production/Preview).
- Re-deploy despues de cambiar secrets.

### API responde 500

- Verificar `NUXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_KEY`.
- Revisar logs de Functions en Cloudflare Pages.
