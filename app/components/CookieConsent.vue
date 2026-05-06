<script setup lang="ts">
import { ref, onMounted } from 'vue';

type ConsentValue = 'accepted' | 'rejected';

const CONSENT_KEY = 'cookie-consent-v1';
const runtimeConfig = useRuntimeConfig();
const gaId = String(runtimeConfig.public.googleAnalyticsId || '').trim();

const consent = ref<ConsentValue | null>(null);
const showBanner = ref(false);

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
  showBanner.value = false;
  loadGoogleAnalytics();
  gtagConsentUpdate(true);
}

function rejectCookies() {
  saveConsent('rejected');
  showBanner.value = false;
  gtagConsentUpdate(false);
  clearAnalyticsCookies();
}

function openCookieSettings() {
  showBanner.value = true;
}

onMounted(() => {
  loadGoogleAnalytics();

  const stored = localStorage.getItem(CONSENT_KEY);
  if (stored === 'accepted' || stored === 'rejected') {
    consent.value = stored;
    if (stored === 'accepted') {
      gtagConsentUpdate(true);
    } else {
      gtagConsentUpdate(false);
      clearAnalyticsCookies();
    }
  } else {
    showBanner.value = true;
  }
});
</script>

<template>
  <div>
    <button
      class="fixed bottom-4 left-4 z-50 rounded-full border border-slate-700 bg-slate-900/95 px-4 py-2 text-xs font-semibold text-slate-200 shadow-lg backdrop-blur transition hover:border-slate-500 hover:text-white"
      type="button"
      aria-label="Configurar cookies"
      @click="openCookieSettings"
    >
      Cookies
    </button>

    <div
      v-if="showBanner"
      class="fixed inset-x-0 bottom-0 z-50 border-t border-slate-700 bg-slate-950/95 px-4 py-4 backdrop-blur"
      role="dialog"
      aria-live="polite"
      aria-label="Configuración de cookies"
    >
      <div class="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div class="max-w-3xl">
          <p class="text-sm font-semibold text-white">Configuración de cookies</p>
          <p class="mt-1 text-xs text-slate-300">
            Usamos cookies analíticas para medir el uso de la web y mejorar el servicio.
            Si no aceptas, Google Analytics se mantiene con consentimiento denegado y sin almacenamiento analítico.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            class="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
            type="button"
            @click="rejectCookies"
          >
            Rechazar
          </button>
          <button
            class="rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400 hover:text-emerald-100"
            type="button"
            @click="acceptCookies"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
