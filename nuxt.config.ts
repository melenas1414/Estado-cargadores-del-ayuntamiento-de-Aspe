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
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    telegramSessionSecret: process.env.TELEGRAM_SESSION_SECRET ?? '',
    telegramAuthChallengeTtlSeconds: Number(process.env.TELEGRAM_AUTH_CHALLENGE_TTL_SECONDS ?? '600'),
    telegramSessionTtlDays: Number(process.env.TELEGRAM_SESSION_TTL_DAYS ?? '14'),
    telegramClaimSecret: process.env.TELEGRAM_CLAIM_SECRET ?? '',
    notificationTriggerSecret: process.env.NOTIFICATION_TRIGGER_SECRET ?? '',
    priorityTelegramUsers: process.env.PRIORITY_TELEGRAM_USERS ?? '',
    priorityNotifyDelaySeconds: Number(process.env.PRIORITY_NOTIFY_DELAY_SECONDS ?? '120'),
    priorityMatchField: process.env.PRIORITY_MATCH_FIELD ?? 'telegram_user_id',
    // Disponibles en cliente y servidor (prefijo "public")
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL ?? '',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL ?? 'https://cargadores-aspe.onlineexpansions.com',
      googleAnalyticsId: process.env.NUXT_PUBLIC_GA_ID?.trim() || 'G-E91PCLPFL3',
      telegramBotUsername: process.env.NUXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? '',
      telegramBotId: process.env.NUXT_PUBLIC_TELEGRAM_BOT_ID ?? '',
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
      },
    },
  },
});
