<template>
  <div class="relative bg-blue-950/30 border-b border-blue-900/50 px-4 py-4 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-7xl">
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0 pt-0.5">
          <AlertCircle class="h-5 w-5 text-blue-400" />
        </div>
        <div class="flex-1">
          <h3 class="text-sm font-semibold text-blue-100">
            Mejorando el servicio 🚀
          </h3>
          <p class="mt-1 text-sm text-blue-200">
            Estamos optimizando la infraestructura para ofrecerte mejor rendimiento. 
            Volveremos con todo el potencial el <strong>20 de junio</strong>.
            Faltan <strong>{{ daysRemaining }} {{ daysRemaining === 1 ? 'día' : 'días' }}</strong>.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AlertCircle } from 'lucide-vue-next';

const daysRemaining = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const resetDate = new Date(2026, 5, 20); // 20 de junio de 2026
  const diffTime = resetDate.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
});
</script>
