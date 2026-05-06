const CONSENT_KEY = 'cookie-consent-v1';

function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(CONSENT_KEY) === 'accepted';
}

export function useAnalytics() {
  function trackAction(action: string, params: Record<string, unknown> = {}) {
    if (typeof window === 'undefined') return;
    if (!hasAnalyticsConsent()) return;
    if (!(window as any).__gaConfigured) return;

    const gtag = (window as any).gtag;
    if (typeof gtag !== 'function') return;

    gtag('event', action, {
      ...params,
      page_path: window.location.pathname,
    });
  }

  return { trackAction };
}
