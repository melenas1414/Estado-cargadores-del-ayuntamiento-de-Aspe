<script setup lang="ts">
import { ref, onMounted } from 'vue';

type ConsentValue = 'accepted' | 'rejected';

const CONSENT_KEY = 'cookie-consent-v1';
const runtimeConfig = useRuntimeConfig();
const gaId = String(runtimeConfig.public.googleAnalyticsId || '').trim();

const consent = ref<ConsentValue | null>(null);
const userRejected = ref(false);

function ensureGtagStub() {
  if (typeof window === 'undefined') return;
  (window as any).dataLayer = (window as any).dataLayer || [];
  if (!(window as any).gtag) {
    (window as any).gtag = function gtag() {
      (window as any).dataLayer.push(arguments);
    };
  }
}

function gtagConsentUpdate(granted: boolean) {
  if (typeof window === 'undefined') return;
  ensureGtagStub();
  const mode = granted ? 'granted' : 'denied';
  (window as any).gtag('consent', 'update', {
    ad_storage: mode,
    analytics_storage: mode,
    ad_user_data: mode,
    ad_personalization: mode,
  });
}

function gtagConsentDefaultDenied() {
  if (typeof window === 'undefined') return;
  ensureGtagStub();
  if ((window as any).__gaDefaultConsentSet) return;
  (window as any).gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500,
  });
  (window as any).__gaDefaultConsentSet = true;
}

function clearAnalyticsCookies() {
  if (typeof document === 'undefined') return;
  const cookieNames = ['_ga', '_gid', '_gat'];
  const host = window.location.hostname;
  const domainParts = host.split('.');
  const domains = [''];

  for (let i = 0; i < domainParts.length - 1; i += 1) {
    domains.push(`.${domainParts.slice(i).join('.')}`);
  }

  for (const name of cookieNames) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}; SameSite=Lax`;
    }
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
  }
}

function configureGoogleAnalyticsOnce() {
  if (typeof window === 'undefined') return;
  if ((window as any).__gaConfigured) return;
  ensureGtagStub();
  (window as any).gtag('js', new Date());
  (window as any).gtag('config', gaId, {
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_flags: 'SameSite=Lax;Secure',
  });
  (window as any).__gaConfigured = true;
}

function loadGoogleAnalytics() {
  if (!gaId || typeof document === 'undefined') return;

  gtagConsentDefaultDenied();

  // Initialize gtag queue + config before script load so early events have destination.
  configureGoogleAnalyticsOnce();

  const existingScript = document.querySelector(`script[data-ga-id="${gaId}"]`) as HTMLScriptElement | null;
  if (existingScript) {
    return;
  }

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
  script.setAttribute('data-ga-id', gaId);
  script.onload = () => {
    (window as any).__gaScriptLoaded = true;
  };
  script.onerror = () => {
    (window as any).__gaScriptLoaded = false;
    console.warn('[analytics] No se pudo cargar gtag.js. Revisa bloqueadores, CSP o red.');
  };
  document.head.appendChild(script);
}

function saveConsent(value: ConsentValue) {
  consent.value = value;
  localStorage.setItem(CONSENT_KEY, value);
}

function acceptCookies() {
  saveConsent('accepted');
  userRejected.value = false;
  loadGoogleAnalytics();
  gtagConsentUpdate(true);
}

function rejectCookies() {
  userRejected.value = true;
  gtagConsentUpdate(false);
  clearAnalyticsCookies();
}

function openCookieSettings() {
  showBanner.value = true;
}

onMounted(() => {
  loadGoogleAnalytics();

  const stored = localStorage.getItem(CONSENT_KEY);
  if (stored === 'accepted') {
    consent.value = 'accepted';
    gtagConsentUpdate(true);
  } else {
    consent.value = null;
    gtagConsentUpdate(false);
    clearAnalyticsCookies();
  }
});
</script>

<template>
  <div>
    <!-- Overlay bloqueante si no ha aceptado cookies o ha rechazado -->
    <div
      v-if="consent === null || userRejected"
      class="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm"
      aria-hidden="true"
    />

    <!-- Modal de aceptación de cookies -->
    <div
      v-if="consent === null && !userRejected"
      class="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-live="polite"
      aria-label="Aceptación de cookies requerida"
    >
      <div class="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div class="mb-4 flex items-center gap-3">
          <div class="rounded-full bg-emerald-500/20 p-3">
            <svg class="h-6 w-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 class="text-lg font-bold text-white">Configuración de Cookies</h2>
        </div>

        <div class="mb-6 space-y-3">
          <p class="text-sm text-slate-300">
            <strong>Las cookies son necesarias para que funcione la web.</strong>
          </p>
          <p class="text-sm text-slate-300">
            Utilizamos cookies para guardar tu progreso, mantener sesiones activas, y proporcionar una experiencia fluida mientras navegas por la plataforma.
          </p>
          <p class="text-xs text-slate-400">
            También usamos Google Analytics de forma anónima para medir cómo se utiliza la web y mejorar el servicio.
          </p>
        </div>

        <div class="flex gap-3">
          <button
            class="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 transition duration-200 hover:border-slate-500 hover:bg-slate-800 hover:text-white"
            type="button"
            @click="rejectCookies"
          >
            Rechazar
          </button>
          <button
            class="flex-1 rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-4 py-3 text-sm font-bold text-emerald-200 shadow-lg transition duration-200 hover:border-emerald-400 hover:bg-emerald-500/30 hover:text-emerald-100"
            type="button"
            @click="acceptCookies"
          >
            Aceptar
          </button>
        </div>

        <p class="mt-4 text-center text-xs text-slate-500">
          Al aceptar, confirmas que has leído nuestra
          <a href="/privacy" class="text-emerald-400 hover:text-emerald-300">política de cookies</a>
        </p>
      </div>
    </div>

    <!-- Modal bloqueante cuando rechaza cookies -->
    <div
      v-if="userRejected"
      class="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-live="polite"
      aria-label="Cookies requeridas para usar la web"
    >
      <div class="w-full max-w-md rounded-2xl border border-amber-600/50 bg-amber-950/40 p-6 shadow-2xl backdrop-blur">
        <div class="mb-4 flex items-center gap-3">
          <div class="rounded-full bg-amber-500/20 p-3">
            <svg class="h-6 w-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4v2m0 5v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 class="text-lg font-bold text-amber-100">Cookies Requeridas</h2>
        </div>

        <div class="mb-6 space-y-3">
          <p class="text-sm text-amber-100/90">
            <strong>No se puede continuar sin aceptar las cookies.</strong>
          </p>
          <p class="text-sm text-amber-100/70">
            Las cookies son esenciales para que la web funcione correctamente. Sin ellas, no podemos:
          </p>
          <ul class="ml-4 space-y-1 text-xs text-amber-100/70">
            <li>✓ Guardar tu progreso y preferencias</li>
            <li>✓ Mantener tu sesión activa</li>
            <li>✓ Procesar las interacciones en la plataforma</li>
            <li>✓ Ofrecerte una experiencia fluida</li>
          </ul>
        </div>

        <button
          class="w-full rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-4 py-3 text-sm font-bold text-emerald-200 shadow-lg transition duration-200 hover:border-emerald-400 hover:bg-emerald-500/30 hover:text-emerald-100"
          type="button"
          @click="userRejected = false"
        >
          Entendido, aceptar cookies
        </button>
      </div>
    </div>
  </div>
</template>
