// nuxt.config.ts — Configuración principal para Nuxt 4 + Supabase + Tailwind CSS
// https://nuxt.com/docs/api/configuration/nuxt-config

export default defineNuxtConfig({
  // ─── Compatibilidad Nuxt 4 ────────────────────────────────────────────────
  future: {
    compatibilityVersion: 4,
  },
  compatibilityDate: '2024-11-01',

  // ─── Módulos ──────────────────────────────────────────────────────────────
  modules: [
    '@nuxtjs/supabase',
    '@nuxtjs/tailwindcss',
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
    // Disponibles en cliente y servidor (prefijo "public")
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL ?? '',
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
});
