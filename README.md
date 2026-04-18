# ⚡ Estado de Cargadores EV — Ayuntamiento de Aspe

Monitor en tiempo real + analítica histórica para los **5 cargadores Iberdrola 22 kW** ubicados en Aspe, Alicante.

| Feature | Detalle |
|---|---|
| **Stack** | Nuxt 4, Supabase (PostgreSQL), Tailwind CSS, Chart.js |
| **Automatización** | GitHub Actions — cron cada 15 minutos |
| **Despliegue** | Vercel (frontend) + GitHub (scraper) |
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

## 🔌 2. Configurar el Scraper (GitHub Actions)

El scraper (`services/scraper.mjs`) se ejecuta en GitHub Actions **cada 15 minutos**.

### Variables de entorno / Secretos de GitHub

Añade los siguientes secretos en **Settings → Secrets and variables → Actions**:

| Secreto | Descripción |
|---|---|
| `SUPABASE_URL` | URL de tu proyecto Supabase |
| `SUPABASE_KEY` | Clave `service_role` de Supabase |
| `IBERDROLA_API_URL` | *(Opcional)* URL base de la API Iberdrola |
| `IBERDROLA_API_KEY` | *(Opcional)* Token de la API Iberdrola |
| `OCM_API_KEY` | *(Opcional)* API Key de [OpenChargeMap](https://openchargemap.org/site/developerinfo) (fallback gratuito) |

### Ejecución local del scraper

```bash
cd services
npm install
SUPABASE_URL=... SUPABASE_KEY=... node scraper.mjs
```

---

## 🌐 3. Desplegar el Dashboard (Vercel)

1. Conecta el repositorio en [vercel.com](https://vercel.com).
2. Añade las siguientes variables de entorno en Vercel:

| Variable | Valor |
|---|---|
| `NUXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NUXT_PUBLIC_SUPABASE_KEY` | Clave anónima pública |
| `SUPABASE_SERVICE_KEY` | Clave service_role (sólo servidor) |

3. Vercel detectará automáticamente el preset de Nuxt y desplegará la app.

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
│   ├── scraper.mjs                      # Script de monitorización
│   └── package.json                     # Dependencias del scraper
├── supabase/
│   └── schema.sql                       # DDL de la tabla charging_logs
├── .github/
│   └── workflows/
│       └── monitor.yml                  # Cron de GitHub Actions (cada 15 min)
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

### Filtros
- **Hoy** — Últimas 24 horas
- **Últimos 7 días** — Semana completa
- **Mes completo** — 30 días

---

## 🔒 Seguridad

- Las claves `service_role` de Supabase **nunca** se exponen al cliente.
- Las variables sensibles se gestionan como **Secretos de GitHub** y **Variables de Entorno de Vercel**.
- RLS de Supabase habilitado: lectura pública, escritura sólo para el service role.

---

## 📄 Licencia

[MIT](./LICENSE)