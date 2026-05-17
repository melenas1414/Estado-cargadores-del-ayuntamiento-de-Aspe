<script setup lang="ts">
import DashboardPage from './index.vue';

const runtimeConfig = useRuntimeConfig();
const siteUrl = (runtimeConfig.public.siteUrl || 'https://cargadores-aspe.onlineexpansions.com').replace(/\/+$/, '');
const canonicalUrl = `${siteUrl}/expansion`;
const socialImageUrl = `${siteUrl}/dashboard.png`;

useSeoMeta({
  title: 'Mapa de Expansión de Cargadores | Ubicaciones Recomendadas para Aspe',
  description: 'Análisis inteligente de ubicaciones para nuevos puntos de carga basado en demanda real, cobertura geográfica y proximidad a parkings en Aspe.',
  keywords: 'expansión cargadores aspe, nuevos puntos carga aspe, ubicaciones recomendadas cargadores, demanda cargadores aspe',
  ogTitle: 'Mapa de Expansión de Cargadores en Aspe',
  ogDescription: 'Análisis inteligente de ubicaciones para nuevos puntos de carga basado en demanda real.',
  ogImage: socialImageUrl,
  ogImageSecureUrl: socialImageUrl,
  ogImageAlt: 'Mapa de expansión de cargadores en Aspe',
  ogImageWidth: '1200',
  ogImageHeight: '630',
  ogType: 'website',
  ogLocale: 'es_ES',
  ogUrl: canonicalUrl,
  robots: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Mapa de Expansión de Cargadores en Aspe',
  twitterDescription: 'Análisis inteligente de ubicaciones para nuevos puntos de carga.',
  twitterImage: socialImageUrl,
  twitterImageAlt: 'Mapa de expansión de cargadores en Aspe',
});

useHead({
  link: [{ rel: 'canonical', href: canonicalUrl }],
});

const maxWidth = ref(1280);
const screenWidth = ref(0);

onMounted(() => {
  screenWidth.value = window.innerWidth;
  window.addEventListener('resize', () => {
    screenWidth.value = window.innerWidth;
  });
});

const isMobile = computed(() => screenWidth.value < 768);
</script>

<template>
    <DashboardPage initial-tab="expansion" :disable-seo="true" />
</template>

<style scoped>
:deep(.leaflet-container) {
  border-radius: 0.5rem;
}
</style>
