const CONSENT_KEY = 'cookie-consent-v1';

function hasAnalyticsConsent(): boolean {
  return window.localStorage.getItem(CONSENT_KEY) === 'accepted';
}

function cleanText(input: string | null | undefined): string {
  return String(input || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

export default defineNuxtPlugin((nuxtApp) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function sendEvent(name: string, params: Record<string, unknown> = {}) {
    if (!hasAnalyticsConsent()) return;
    if (!(window as any).__gaConfigured) return;
    const gtag = (window as any).gtag;
    if (typeof gtag !== 'function') return;
    gtag('event', name, params);
  }

  // Track SPA page views after each navigation.
  nuxtApp.hook('page:finish', () => {
    sendEvent('page_view', {
      page_title: document.title,
      page_location: window.location.href,
      page_path: window.location.pathname,
    });
  });

  // Generic click tracking for most interactive elements.
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const interactive = target.closest('a,button,[role="button"],input[type="button"],input[type="submit"]') as HTMLElement | null;
    if (!interactive) return;

    const tag = interactive.tagName.toLowerCase();
    const text = cleanText(interactive.textContent || interactive.getAttribute('aria-label'));

    let hrefPath = '';
    if (tag === 'a') {
      const href = (interactive as HTMLAnchorElement).getAttribute('href') || '';
      hrefPath = href.startsWith('http') ? href : href;
    }

    sendEvent('ui_click', {
      element_tag: tag,
      element_text: text || 'sin_texto',
      target_path: hrefPath || undefined,
      page_path: window.location.pathname,
    });
  }, { capture: true });

  // Generic filter/input tracking (no user-entered text values, only control name/id).
  document.addEventListener('change', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const isTrackableControl = target.matches('select,input[type="checkbox"],input[type="radio"]');
    if (!isTrackableControl) return;

    const control = target as HTMLInputElement | HTMLSelectElement;
    sendEvent('ui_change', {
      control_name: control.name || control.id || control.tagName.toLowerCase(),
      control_type: control.tagName.toLowerCase(),
      page_path: window.location.pathname,
    });
  }, { capture: true });
});
