<script setup lang="ts">
import DashboardPage from './index.vue';

const runtimeConfig = useRuntimeConfig();
const siteUrl = (runtimeConfig.public.siteUrl || 'https://cargadores-aspe.onlineexpansions.com').replace(/\/+$/, '');
const canonicalUrl = `${siteUrl}/inteligencia`;
const socialImageUrl = `${siteUrl}/dashboard.png`;

useSeoMeta({
  title: 'Predicción de Carga en Aspe | Mejores Horas para Recargar',
  description: 'Consulta analítica y predicción para cargar tu coche eléctrico en Aspe: heatmap, franjas recomendadas y tendencias de ocupación.',
  keywords: 'mejor hora cargar coche electrico aspe, prediccion cargadores aspe, analitica recarga aspe, ocupacion cargadores aspe',
  ogTitle: 'Predicción de Carga en Aspe',
  ogDescription: 'Análisis histórico y predicción de disponibilidad de cargadores en Aspe.',
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
  twitterTitle: 'Predicción de Carga en Aspe',
  twitterDescription: 'Análisis histórico y predicción de disponibilidad de cargadores en Aspe.',
  twitterImage: socialImageUrl,
  twitterImageAlt: 'Panel de estado de cargadores en Aspe',
});

useHead({
  link: [{ rel: 'canonical', href: canonicalUrl }],
});
</script>

<template>
  <DashboardPage initial-tab="inteligencia" :disable-seo="true" />
</template>
