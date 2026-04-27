<script setup lang="ts">
import DashboardPage from './index.vue';

const runtimeConfig = useRuntimeConfig();
const siteUrl = (runtimeConfig.public.siteUrl || 'https://cargadores-aspe.onlineexpansions.com').replace(/\/+$/, '');
const canonicalUrl = `${siteUrl}/diagnostico`;
const socialImageUrl = `${siteUrl}/dashboard.png`;

useSeoMeta({
  title: 'Diagnóstico de Red de Cargadores en Aspe | Saturación y Prioridades',
  description: 'Diagnóstico avanzado de la red de recarga de Aspe: saturación, incidencias y zonas prioritarias para refuerzo de puntos.',
  keywords: 'diagnostico cargadores aspe, saturacion cargadores aspe, incidencias recarga aspe, zonas prioritarias cargadores aspe',
  ogTitle: 'Diagnóstico de Cargadores en Aspe',
  ogDescription: 'Estado de salud de la red de cargadores y prioridades de mejora en Aspe.',
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
  twitterTitle: 'Diagnóstico de Cargadores en Aspe',
  twitterDescription: 'Estado de salud de la red de cargadores y prioridades de mejora en Aspe.',
  twitterImage: socialImageUrl,
  twitterImageAlt: 'Panel de estado de cargadores en Aspe',
});

useHead({
  link: [{ rel: 'canonical', href: canonicalUrl }],
});
</script>

<template>
  <DashboardPage initial-tab="diagnostico" :disable-seo="true" />
</template>
