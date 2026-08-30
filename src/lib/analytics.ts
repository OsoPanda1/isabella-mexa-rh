/**
 * Isabella AI — Consent-gated advertising analytics.
 *
 * Design goals:
 * - No analytics loaded before explicit user consent.
 * - No prompts, responses, memory, documents, identity, emotions, credentials, or financial data.
 * - Events allowlisted: PageView, AdImpression, AdClick, AdDismissed, CampaignInfoOpened.
 * - Properties bounded and validated (max 12 events, key regex, string length 120).
 * - Provider loaded as external module only after consent grant.
 * - Consent persisted in localStorage under explicit key.
 */

type AnalyticsEvent =
  | "PageView"
  | "AdImpression"
  | "AdClick"
  | "AdDismissed"
  | "CampaignInfoOpened";

type AnalyticsProperties = Record<string, string | number | boolean>;

type IdlenWindow = Window & {
  idlen?: (...args: unknown[]) => void;
};

const CONSENT_KEY = "isabella.consent.advertising.v1";
const ALLOWED_EVENTS = new Set<AnalyticsEvent>([
  "PageView",
  "AdImpression",
  "AdClick",
  "AdDismissed",
  "CampaignInfoOpened",
]);

let consent: "unknown" | "granted" | "denied" = "unknown";
let providerPromise: Promise<void> | null = null;

const readConsent = (): typeof consent => {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : "unknown";
  } catch {
    return "unknown";
  }
};

const safeProperties = (properties: AnalyticsProperties = {}): AnalyticsProperties => {
  const result: AnalyticsProperties = {};
  for (const [key, value] of Object.entries(properties).slice(0, 12)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/.test(key)) continue;
    if (typeof value === "string" && value.length > 120) continue;
    result[key] = value;
  }
  return result;
};

export const restoreAdvertisingConsent = (): void => {
  consent = readConsent();
  if (consent === "granted") void loadAdvertisingProvider();
};

export const grantAdvertisingConsent = (): void => {
  consent = "granted";
  try {
    window.localStorage.setItem(CONSENT_KEY, consent);
  } catch {
    /* Storage may be unavailable; application remains functional. */
  }
  void loadAdvertisingProvider();
};

export const denyAdvertisingConsent = (): void => {
  consent = "denied";
  try {
    window.localStorage.setItem(CONSENT_KEY, consent);
  } catch {
    /* no-op */
  }
};

export const getAdvertisingConsent = (): typeof consent => consent;

const loadAdvertisingProvider = async (): Promise<void> => {
  if (consent !== "granted") return;
  if (providerPromise) return providerPromise;

  providerPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="pixel.idlen.io"]',
    );
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://pixel.idlen.io/v1/pixel.js";
    script.crossOrigin = "anonymous";
    script.referrerPolicy = "no-referrer";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("analytics_provider_load_failed"));
    document.head.appendChild(script);
  });

  return providerPromise;
};

export const trackAdvertisingEvent = async (
  event: AnalyticsEvent,
  properties: AnalyticsProperties = {},
): Promise<void> => {
  if (consent !== "granted" || !ALLOWED_EVENTS.has(event)) return;
  await loadAdvertisingProvider();
  const provider = (window as IdlenWindow).idlen;
  provider?.("track", event, {
    product: "isabella-ai",
    surface: "application",
    ...safeProperties(properties),
  });
};
