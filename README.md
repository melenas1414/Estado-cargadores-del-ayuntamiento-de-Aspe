# ⚡ Estado de Cargadores EV — Ayuntamiento de Aspe

Monitor en tiempo real + analítica histórica para los **5 cargadores Iberdrola 22 kW** ubicados en Aspe, Alicante.

| Feature | Detalle |
|---|---|
| **Stack** | Nuxt 4, Supabase (PostgreSQL), Tailwind CSS, Chart.js |
| **Automatización** | Supabase Edge Functions + `pg_cron` cada 15 minutos |
| **Despliegue** | GitHub Actions -> Vercel (frontend) + Supabase (Edge Function) |
| **Visualización** | Heatmap semanal, predicción horaria, KPIs de uso |

---

## 📍 Cargadores monitorizados

| # | Ubicación | Station ID |
|---|---|---|
| 1 | Av. Navarra 67 | `ESIBE22E0001001` |
| 2 | Av. Constitución 42 | `ESIBE22E0001002` |
| 3 | Av. Padre Ismael 34 | `ESIBE22E0001003` |
| 4 | Av. Juan Carlos I 36 | `ESIBE22E0001004` |
| 5 | Calle Orihuela 100 | `ESIBE22E0001005` |

> **Nota:** Los `station_id` son identificadores de ejemplo.
> Actualízalos en `services/scraper.mjs` con los IDs reales de la red Iberdrola
> (visibles en la app *Iberdrola Smart Charging* o en la propia estación física).

---

## 🗄️ 1. Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor** y ejecuta el contenido de [`supabase/schema.sql`](./supabase/schema.sql).
3. Anota:
   - **Project URL** → `NUXT_PUBLIC_SUPABASE_URL`
   - **anon (public) key** → `NUXT_PUBLIC_SUPABASE_KEY`
   - **service_role key** → `SUPABASE_SERVICE_KEY` / `SUPABASE_KEY`

---

## 🔌 2. Automatización en Supabase (Edge Functions + pg_cron)

La captura se ejecuta en Supabase cada 15 minutos sin depender de GitHub Actions.

### 2.1 Desplegar la Edge Function

```bash
supabase functions deploy monitor-cargadores --project-ref <PROJECT_REF>
```

Archivo de la función:
- `supabase/functions/monitor-cargadores/index.ts`

### 2.2 Configurar secretos de la función

```bash
supabase secrets set OCM_API_KEY=<TU_OCM_API_KEY> --project-ref <PROJECT_REF>
```

> `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase automáticamente.

### 2.3 Programar ejecución cada 15 minutos

1. Abre **SQL Editor** en Supabase.
2. Ejecuta `supabase/cron.sql` reemplazando:
    - `<PROJECT_REF>`
    - `<SERVICE_ROLE_KEY>`

### 2.4 Test manual de la función

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/monitor-cargadores" \
   -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
   -H "Content-Type: application/json"
```

## 🚀 3. Despliegue automático con GitHub Actions

El workflow [`deploy.yml`](./.github/workflows/deploy.yml) publica automáticamente:

- El frontend en Vercel cuando cambian `app/`, `server/` o la configuración Nuxt/Vercel.
- La Edge Function `monitor-cargadores` cuando cambia `supabase/functions/`.

### Secretos necesarios en GitHub

Configura estos secretos en **Settings -> Secrets and variables -> Actions**:

| Secreto | Uso |
|---|---|
| `VERCEL_TOKEN` | Autenticación con Vercel CLI |
| `VERCEL_ORG_ID` | ID del equipo/organización en Vercel |
| `VERCEL_PROJECT_ID` | ID del proyecto en Vercel |
| `SUPABASE_ACCESS_TOKEN` | Token personal para desplegar con Supabase CLI |
| `SUPABASE_PROJECT_REF` | Ref del proyecto Supabase |
| `OCM_API_KEY` | Clave de OpenChargeMap para sincronizar el secreto de la función |

### Variables de entorno en Vercel

Además, el proyecto de Vercel debe tener configuradas estas variables:

| Variable | Valor |
|---|---|
| `NUXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NUXT_PUBLIC_SUPABASE_KEY` | Clave anónima pública |
| `SUPABASE_SERVICE_KEY` | Clave service_role (sólo servidor) |

Cada push a `master` o `main` lanzará el despliegue si detecta cambios relevantes.

---

## 💻 4. Desarrollo local

```bash
# Instalar dependencias
npm install

# Copiar y rellenar variables de entorno
cp .env.example .env

# Iniciar servidor de desarrollo
npm run dev
```

El dashboard estará disponible en `http://localhost:3000`.

---

## 🏗️ Estructura del proyecto

```
├── app/
│   ├── app.vue                          # Entrada raíz de la aplicación
│   ├── pages/
│   │   └── index.vue                    # Dashboard principal
│   └── components/
│       ├── ChargerCard.vue              # Tarjeta de estado (glow verde/rojo)
│       ├── WeeklyHeatmap.vue            # Mapa de calor semanal
│       ├── PredictionWidget.vue         # Predicción del mejor momento
│       ├── UsageStats.vue               # KPIs y métricas de uso
│       └── FilterButtons.vue            # Filtros Hoy / 7d / Mes
├── server/
│   └── api/
│       ├── chargers/
│       │   └── current.get.ts           # Estado actual de cargadores
│       └── analytics/
│           ├── heatmap.get.ts           # Datos del heatmap semanal
│           ├── prediction.get.ts        # Predicción horaria
│           └── metrics.get.ts           # Métricas de uso
├── services/
│   ├── scraper.mjs                      # Script de monitorización local (opcional)
│   └── package.json                     # Dependencias del scraper local
├── supabase/
│   └── schema.sql                       # DDL de la tabla charging_logs
│   ├── cron.sql                         # Programación pg_cron para la Edge Function
│   └── functions/
│       └── monitor-cargadores/
│           └── index.ts                # Función serverless de captura cada 15 min
├── .github/
│   └── workflows/
│       └── monitor.yml                  # Alternativa opcional con GitHub Actions
├── nuxt.config.ts                       # Configuración de Nuxt 4
├── tailwind.config.ts                   # Tema oscuro (slate-950)
├── vercel.json                          # Configuración de Vercel
└── .env.example                         # Plantilla de variables de entorno
```

---

## 📊 Funcionalidades del Dashboard

### Estado en Tiempo Real
- 5 tarjetas de cargadores con **efecto glow**: 🟢 verde si libre, 🔴 rojo si ocupado
- Indicador de estado global (todos libres / todos ocupados / parcialmente)
- Refresco automático cada 60 segundos + botón de actualización manual

### Análisis e Inteligencia
- **Mapa de calor semanal**: ocupación por hora (0-23) y día de la semana
- **Predicción inteligente**: mejor hora para cargar hoy con % de confianza
- **Métricas de uso**: tasa de ocupación media, sesiones estimadas, duración media, cargador más usado
- **Diagnóstico avanzado**: saturación, posibles averías, ETA de disponibilidad e insights automáticos

### Navegación profesional por pestañas
- **Resumen**: visión operativa global y estado actual por punto
- **Mapa**: localización y disponibilidad por cargador
- **Inteligencia**: heatmap, predicción y KPIs de uso
- **Diagnóstico**: señales técnicas, recomendaciones y probabilidad al llegar

### Filtros
- **Hoy** — Últimas 24 horas
- **Últimos 7 días** — Semana completa
- **Mes completo** — 30 días
- **Cargador** — Filtro global por estación para analítica (heatmap, predicción, métricas, diagnóstico y ETA)

---

## 🔒 Seguridad

- Las claves `service_role` de Supabase **nunca** se exponen al cliente.
- Las variables sensibles se gestionan como **Supabase Secrets** y **Variables de Entorno de Vercel**.
- RLS de Supabase habilitado: lectura pública, escritura sólo para el service role.

---

## 📄 Licencia

[MIT](./LICENSE)