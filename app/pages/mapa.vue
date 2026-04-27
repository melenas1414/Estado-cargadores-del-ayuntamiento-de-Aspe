<script setup lang="ts">
import DashboardPage from './index.vue';

const runtimeConfig = useRuntimeConfig();
const siteUrl = (runtimeConfig.public.siteUrl || 'https://cargadores-aspe.onlineexpansions.com').replace(/\/+$/, '');
const canonicalUrl = `${siteUrl}/mapa`;
const socialImageUrl = `${siteUrl}/dashboard.png`;

useSeoMeta({
  title: 'Mapa de Cargadores de Coche en Aspe | Ubicaciones y Disponibilidad',
  description: 'Explora el mapa de cargadores de coche eléctrico en Aspe, Alicante. Consulta ubicación por punto y disponibilidad de conectores.',
  keywords: 'mapa cargadores aspe, donde cargar coche electrico aspe, puntos de recarga aspe mapa, ubicacion cargadores aspe',
  ogTitle: 'Mapa de Cargadores en Aspe',
  ogDescription: 'Ubicaciones de cargadores de coche en Aspe con estado de disponibilidad.',
  ogImage: socialImageUrl,
  ogImageSecureUrl: socialImageUrl,
  ogImageAlt: 'Panel de estado de cargadores en Aspe',
  ogImageWidth: '1200',
  ogImageHeight: '630',
  ogType: 'website',
  ogLocale: 'es_ES',
  ogUrl: canonicalUrl,
  robots: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Mapa de Cargadores en Aspe',
  twitterDescription: 'Ubicaciones de cargadores de coche en Aspe con estado de disponibilidad.',
  twitterImage: socialImageUrl,
  twitterImageAlt: 'Panel de estado de cargadores en Aspe',
});

useHead({
  link: [{ rel: 'canonical', href: canonicalUrl }],
});
</script>

<template>
  <DashboardPage initial-tab="mapa" :disable-seo="true" />
</template>
