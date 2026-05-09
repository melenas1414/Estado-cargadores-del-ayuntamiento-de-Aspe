<script setup lang="ts">
const runtimeConfig = useRuntimeConfig();
const siteUrl = (runtimeConfig.public.siteUrl || 'https://cargadores-aspe.onlineexpansions.com').replace(/\/+$/, '');
const canonicalUrl = `${siteUrl}/cargadores-gratis-aspe`;

useSeoMeta({
  title: 'Cargadores Gratis en Aspe | Estado y Disponibilidad',
  description: 'Consulta el estado de los cargadores públicos en Aspe y planifica tu recarga con datos de disponibilidad en tiempo real.',
  keywords: 'cargadores gratis aspe, recarga publica aspe, puntos recarga gratuitos aspe',
  ogTitle: 'Cargadores Públicos en Aspe',
  ogDescription: 'Disponibilidad de cargadores públicos en Aspe para planificar tu recarga.',
  ogUrl: canonicalUrl,
});

useHead({
  link: [{ rel: 'canonical', href: canonicalUrl }],
});
</script>

<template>
  <main class="min-h-screen bg-[#020617] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-4xl space-y-6">
      <header class="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h1 class="text-3xl font-extrabold text-white md:text-4xl">Cargadores públicos en Aspe</h1>
        <p class="mt-3 text-sm text-slate-300">
          Esta página reúne el estado de la red pública de recarga en Aspe. Comprueba disponibilidad antes de salir y evita esperas innecesarias.
        </p>
        <div class="mt-5 flex flex-wrap gap-3">
          <NuxtLink to="/" class="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Comprobar estado ahora</NuxtLink>
          <NuxtLink to="/mapa" class="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold hover:border-slate-500">Ver ubicaciones</NuxtLink>
        </div>
      </header>

      <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 class="text-lg font-semibold text-white">Preguntas frecuentes</h2>
        <div class="mt-4 space-y-3 text-sm text-slate-300">
          <p><strong class="text-slate-100">¿Son públicos?</strong> Sí, son puntos municipales monitorizados por esta plataforma.</p>
          <p><strong class="text-slate-100">¿Con qué frecuencia se actualizan?</strong> Se actualizan periódicamente para reflejar cambios reales de ocupación.</p>
          <p><strong class="text-slate-100">¿Qué ventajas ofrece esta web?</strong> Predicción de disponibilidad, diagnóstico de fiabilidad y recomendaciones automáticas.</p>
        </div>
      </section>
    </div>
  </main>
</template>
