// nuxt.config.ts — Configuración principal para Nuxt 4 + Supabase + Tailwind CSS
// https://nuxt.com/docs/api/configuration/nuxt-config

import { resolve } from 'pathe';

export default defineNuxtConfig({
    alias: {
      '~/components': resolve(__dirname, 'app/components'),
      '#imports': resolve(__dirname, '.nuxt/imports'),
    },
  // ─── Compatibilidad Nuxt 4 ────────────────────────────────────────────────
  future: {
    compatibilityVersion: 4,
  },
  compatibilityDate: '2024-11-01',

  site: {
    name: 'Estado de Cargadores de Aspe',
    url: process.env.NUXT_PUBLIC_SITE_URL ?? 'https://cargadores-aspe.onlineexpansions.com',
  },

  // ─── Módulos ──────────────────────────────────────────────────────────────
  modules: [
    '@nuxtjs/supabase',
    '@nuxtjs/tailwindcss',
    'nuxt-seo-utils',
  ],

  // ─── Configuración de Supabase ────────────────────────────────────────────
  supabase: {
    // Redirigir al index si no se encuentra la ruta (sin módulo de auth)
    redirect: false,
  },

  // ─── Variables de entorno del lado del cliente ────────────────────────────
  // Las claves públicas se exponen al cliente; las privadas sólo al servidor.
  runtimeConfig: {
    // Sólo disponibles en el servidor (nunca expuestas al cliente)
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY ?? '',
    iberdrolaApiUrl:    process.env.IBERDROLA_API_URL ?? '',
    iberdrolaApiKey:    process.env.IBERDROLA_API_KEY ?? '',
    chargersVisibleStationIds: process.env.CHARGERS_VISIBLE_STATION_IDS ?? '',
    // Disponibles en cliente y servidor (prefijo "public")
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL ?? '',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL ?? 'https://cargadores-aspe.onlineexpansions.com',
      googleAnalyticsId: process.env.NUXT_PUBLIC_GA_ID?.trim() || 'G-E91PCLPFL3',
    },
  },

  // ─── Configuración de Tailwind CSS ───────────────────────────────────────
  tailwindcss: {
    exposeConfig: true,
  },

  // ─── Opciones de SSR ──────────────────────────────────────────────────────
  ssr: true,

  // ─── Metadatos globales de la aplicación ─────────────────────────────────
  app: {
    head: {
      title: 'Estado de Cargadores EV — Aspe',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'Monitor en tiempo real de los cargadores eléctricos Iberdrola 22 kW del Ayuntamiento de Aspe, Alicante.',
        },
        { name: 'theme-color', content: '#020617' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap' },
      ],
    },
  },

  // ─── Optimizaciones de Vite ───────────────────────────────────────────────
  vite: {
    optimizeDeps: {
      include: ['chart.js', 'vue-chartjs', 'lucide-vue-next'],
    },
  },

  // ─── Transpilación ────────────────────────────────────────────────────────
  build: {
    transpile: ['vue-chartjs', 'chart.js'],
  },

  // ─── Reglas de rutas (SEO friendly URLs) ────────────────────────────────
  routeRules: {
    '/resumen': { redirect: { to: '/', statusCode: 301 } },
    '/admin/**': {
      headers: {
        'x-robots-tag': 'noindex, nofollow',

        // ─── Caché de respuestas de la API en Vercel Edge ────────────────────────
        // Los analytics se cachean 10 min en Vercel: si múltiples usuarios cargan
        // la página al mismo tiempo, solo UNA petición llega a Supabase.
        // /api/chargers/current se cachea solo 15s porque muestra el estado en vivo.
        nitro: {
          routeRules: {
            '/api/chargers/current':                  { cache: { maxAge: 15,  swr: true } },
            '/api/analytics/heatmap':                 { cache: { maxAge: 600, swr: true } },
            '/api/analytics/recommendations':         { cache: { maxAge: 600, swr: true } },
            '/api/analytics/prediction':              { cache: { maxAge: 600, swr: true } },
            '/api/analytics/eta':                     { cache: { maxAge: 600, swr: true } },
            '/api/analytics/metrics':                 { cache: { maxAge: 600, swr: true } },
            '/api/analytics/rankings':                { cache: { maxAge: 600, swr: true } },
            '/api/analytics/charger-health':          { cache: { maxAge: 600, swr: true } },
            '/api/analytics/anomalies':               { cache: { maxAge: 600, swr: true } },
            '/api/analytics/diagnostic':              { cache: { maxAge: 600, swr: true } },
            '/api/analytics/occupation-duration':     { cache: { maxAge: 600, swr: true } },
            '/api/analytics/occupancy-by-hour':       { cache: { maxAge: 600, swr: true } },
            '/api/analytics/occupancy-by-day':        { cache: { maxAge: 600, swr: true } },
            '/api/analytics/estimated-release':       { cache: { maxAge: 600, swr: true } },
            '/api/analytics/expansion-recommendations': { cache: { maxAge: 600, swr: true } },
          },
        },
      },
    },
  },
});
