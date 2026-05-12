<template>
  <Teleport to="body">
    <!-- Fondo oscuro del modal con efecto blur -->
    <transition name="fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-40 bg-black/70 backdrop-blur-md"
        @click="closePopup('background')"
      />
    </transition>

    <!-- Popup centrado con animación espectacular -->
    <transition name="popup-enter">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-3 py-6 sm:p-4"
      >
        <div
          class="relative w-full max-w-[90vw] sm:max-w-[32rem]"
          @click.stop
        >
          <!-- Card con efecto glow y borde animado -->
          <div class="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-emerald-500/20 rounded-3xl blur-2xl animate-pulse" />
          
          <div class="relative bg-gradient-to-br from-slate-900 via-emerald-950/30 to-slate-950 rounded-3xl overflow-hidden shadow-2xl border-2 border-emerald-500/40 ring-1 ring-emerald-400/20">
            <!-- Animated background gradient -->
            <div class="absolute inset-0 opacity-30">
              <div class="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
              <div class="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
            </div>

            <!-- Badge de promoción flotante -->
            <div class="absolute -top-3 left-1/2 transform -translate-x-1/2 z-20">
              <div class="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-0.5 px-2 sm:py-1 sm:px-4 rounded-full text-[10px] sm:text-xs uppercase tracking-wider shadow-lg animate-bounce">
                ⚡ Oferta Limitada
              </div>
            </div>

            <!-- Botón cerrar -->
            <button
              @click="closePopup('button')"
              class="absolute top-3 sm:top-4 right-3 sm:right-4 z-10 p-1.5 sm:p-2 rounded-full bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-all hover:scale-110"
            >
              <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <!-- Imagen del Tesla M3 con overlay -->
            <div class="relative h-40 sm:h-56 overflow-hidden bg-gradient-to-b from-slate-700 to-slate-900">
              <img
                src="https://images.tesla.com/image/upload/f_auto,q_auto:best/Homepage-Model3-D-Desktop-Global"
                alt="Tesla Model 3"
                class="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500"
              />
              <!-- Overlay oscuro con gradiente -->
              <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              
              <!-- Badge de "POPULAR" -->
              <div class="absolute top-2 sm:top-3 right-2 sm:right-3 bg-red-500 text-white font-bold py-0.5 px-1.5 sm:py-1 sm:px-2 rounded text-[9px] sm:text-xs">
                🔥 MÁS VENDIDO
              </div>
            </div>

            <!-- Contenido principal -->
            <div class="relative p-3 sm:p-6 space-y-3 sm:space-y-4">
              <!-- Título principal con emoción -->
              <div class="space-y-1 sm:space-y-2">
                <h2 class="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-cyan-300 to-emerald-300 leading-tight">
                  Tesla Model 3
                </h2>
                <p class="text-xs sm:text-sm text-slate-300 font-semibold">
                  El coche eléctrico más emocionante del mercado 🚗⚡
                </p>
              </div>

              <!-- Precio destacado con animación -->
              <div class="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 rounded-xl p-3 sm:p-4 relative overflow-hidden">
                <div class="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-white/5 to-emerald-500/0 animate-shimmer" />
                <div class="relative">
                  <p class="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider">Precio especial</p>
                  <p class="text-3xl sm:text-4xl font-black text-emerald-300">
                    33.000€
                  </p>
                  <p class="text-[10px] sm:text-xs text-emerald-400 font-semibold">+ 1.000 km Supercarga gratis</p>
                </div>
              </div>

              <!-- Características principales con iconos -->
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div class="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2 sm:p-2.5 text-center hover:bg-emerald-500/10 transition-colors">
                  <p class="text-base sm:text-lg font-bold text-emerald-300">570</p>
                  <p class="text-[9px] sm:text-[10px] text-slate-400 font-semibold">km Autonomía</p>
                </div>
                <div class="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-2 sm:p-2.5 text-center hover:bg-cyan-500/10 transition-colors">
                  <p class="text-base sm:text-lg font-bold text-cyan-300">5.8s</p>
                  <p class="text-[9px] sm:text-[10px] text-slate-400 font-semibold">0-100 km/h</p>
                </div>
                <div class="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2 sm:p-2.5 text-center hover:bg-amber-500/10 transition-colors">
                  <p class="text-base sm:text-lg font-bold text-amber-300">25€</p>
                  <p class="text-[9px] sm:text-[10px] text-slate-400 font-semibold">/100km</p>
                </div>
              </div>

              <!-- Argumentos de venta principales -->
              <div class="space-y-2 text-xs sm:text-sm">
                <div class="flex items-start gap-2 sm:gap-3">
                  <span class="text-emerald-400 font-bold mt-0.5 flex-shrink-0">✓</span>
                  <p class="text-slate-200"><span class="font-semibold text-emerald-300">Conducción Autónoma:</span> Tecnología FSD incluida en tu Tesla</p>
                </div>
                <div class="flex items-start gap-2 sm:gap-3">
                  <span class="text-cyan-400 font-bold mt-0.5 flex-shrink-0">✓</span>
                  <p class="text-slate-200"><span class="font-semibold text-cyan-300">Carga en Aspe:</span> 5 puntos disponibles cerca de ti</p>
                </div>
                <div class="flex items-start gap-2 sm:gap-3">
                  <span class="text-amber-400 font-bold mt-0.5 flex-shrink-0">✓</span>
                  <p class="text-slate-200"><span class="font-semibold text-amber-300">Ahorro garantizado:</span> 70% menos que gasolina</p>
                </div>
              </div>

              <!-- Timer de urgencia -->
              <div class="bg-red-500/10 border-l-4 border-red-500 rounded p-2 sm:p-3">
                <p class="text-[10px] sm:text-xs text-red-300 font-bold uppercase tracking-wider">⏰ Oferta válida hasta fin de mes</p>
                <p class="text-[10px] text-slate-400 mt-0.5 sm:mt-1">2.347 clientes compraron este mes. Solo 152 unidades disponibles en España.</p>
              </div>

              <!-- CTA Button Principal - MEGA LLAMATIVO -->
              <a
                :href="teslaUrl"
                target="_blank"
                rel="noopener noreferrer"
                @click="recordClick"
                class="block relative group w-full overflow-hidden rounded-xl font-bold py-3 sm:py-4 px-4 text-center text-white uppercase tracking-widest shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 text-sm sm:text-lg"
              >
                <!-- Fondo animado -->
                <div class="absolute inset-0 bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-600 group-hover:via-emerald-400" />
                <div class="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-r from-emerald-400 to-cyan-400 blur group-hover:blur-lg transition-all" />
                
                <!-- Brillo animado -->
                <div class="absolute -inset-full top-1/2 h-1/2 w-full skew-x-12 bg-white/20 translate-x-full group-hover:translate-x-0 transition-transform duration-700" />
                
                <!-- Texto -->
                <span class="relative flex items-center justify-center gap-1 sm:gap-2">
                  🚗 QUIERO MI TESLA AHORA
                  <svg class="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </a>

              <!-- Secondary action -->
              <button
                @click="closePopup('button')"
                class="w-full text-slate-400 hover:text-slate-300 text-[11px] sm:text-xs py-2 transition-colors font-medium"
              >
                Quizás no estoy listo (pero lo estaré pronto 😏)
              </button>
            </div>

            <!-- Footer con testimonial -->
            <div class="relative px-3 sm:px-6 pb-3 sm:pb-4 border-t border-slate-700/50 pt-2 sm:pt-3 bg-slate-900/50">
              <div class="flex items-center gap-2 justify-center text-center">
                <div class="flex gap-0.5">
                  <span class="text-amber-400">★</span>
                  <span class="text-amber-400">★</span>
                  <span class="text-amber-400">★</span>
                  <span class="text-amber-400">★</span>
                  <span class="text-amber-400">★</span>
                </div>
              </div>
              <p class="text-[10px] sm:text-[11px] text-slate-400 text-center mt-1">
                <span class="text-emerald-300 font-bold">4.9/5</span> • 12.453 propietarios en España lo recomiendan
              </p>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';

const isOpen = ref(false);

// URL personalizada para comprar Tesla M3
const teslaUrl = 'https://www.tesla.com/es_ES/inventory/new/m3?arrangeby=plh&zip=03660&PaymentType=cash&referral=santiago767265';

// Mostrar popup después de 3 segundos (ajustable)
const POPUP_DELAY = 3000;
const POPUP_STORAGE_KEY = 'tesla_m3_popup_shown_session_v1';

const openPopup = () => {
  isOpen.value = true;
  // Registrar impresión
  recordPopupImpression();
};

const closePopup = (method: 'button' | 'background' | 'escape' = 'button') => {
  isOpen.value = false;
  // Registrar cierre en GA
  recordPopupClose(method);
  // Guardar en sessionStorage para no mostrar de nuevo en esta sesión
  sessionStorage.setItem(POPUP_STORAGE_KEY, 'true');
};

const recordClick = () => {
  // Registrar en analytics
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'tesla_m3_popup_cta_click', {
      event_category: 'engagement',
      event_label: 'tesla_referral_cta',
      value: 1,
    });
  }
};

const recordPopupImpression = () => {
  // Registrar impresión del popup
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'tesla_m3_popup_impression', {
      event_category: 'impression',
      event_label: 'tesla_referral_popup',
      value: 1,
    });
  }
};

const recordPopupClose = (closeMethod: 'button' | 'background' | 'escape') => {
  // Registrar cierre del popup
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'tesla_m3_popup_close', {
      event_category: 'engagement',
      event_label: `popup_close_${closeMethod}`,
      value: 1,
    });
  }
};

onMounted(() => {
  // No mostrar si ya se mostró en esta sesión
  if (sessionStorage.getItem(POPUP_STORAGE_KEY)) {
    return;
  }

  // Mostrar popup después del delay
  const timer = setTimeout(() => {
    openPopup();
  }, POPUP_DELAY);

  // Limpiar timeout al desmontar
  onBeforeUnmount(() => {
    clearTimeout(timer);
  });
});

// Permitir cierre con tecla Escape
onMounted(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen.value) {
      closePopup('escape');
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });
});
</script>

<style scoped>
/* Transiciones principales */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.popup-enter-enter-active {
  animation: popupEnter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.popup-enter-leave-active {
  animation: popupLeave 0.3s ease-in;
}

@keyframes popupEnter {
  0% {
    opacity: 0;
    transform: scale(0.8) rotateX(-10deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotateX(0);
  }
}

@keyframes popupLeave {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.95);
  }
}

/* Animaciones de blob */
@keyframes blob {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(30px, -50px) scale(1.1);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.9);
  }
}

.animate-blob {
  animation: blob 7s infinite;
}

.animation-delay-2000 {
  animation-delay: 2s;
}

/* Shimmer effect */
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.animate-shimmer {
  animation: shimmer 2s infinite;
}

/* Pulse extra */
@keyframes pulse-extra {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

:deep(.animate-pulse) {
  animation: pulse-extra 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
